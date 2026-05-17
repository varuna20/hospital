const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const mongoose = require('mongoose');
const AdmZip   = require('adm-zip');
const { protect, superAdminOnly } = require('../middleware/auth');
const { runBackup } = require('../utils/backup');

const BACKUP_DIR = process.env.BACKUP_DIR || path.resolve(__dirname, '../backups');
const UPLOADS_DIR = path.resolve(__dirname, '../uploads');

router.use(protect, superAdminOnly);

/**
 * Recursively fix ObjectIds and Dates in the restored document
 */
function fixDataTypes(obj) {
  if (!obj || typeof obj !== 'object') return obj;

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map(fixDataTypes);
  }

  const newObj = {};
  for (let [key, value] of Object.entries(obj)) {
    // 1. Fix _id (MongoDB JSON export format)
    if (key === '_id' && value && (value.$oid || typeof value === 'string')) {
      try {
        newObj[key] = new mongoose.Types.ObjectId(value.$oid || value);
      } catch (e) { newObj[key] = value; }
      continue;
    }

    // 2. Fix other ObjectId-like strings (heuristics)
    if (typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value)) {
      try {
        newObj[key] = new mongoose.Types.ObjectId(value);
      } catch (e) { newObj[key] = value; }
      continue;
    }

    // 3. Fix ISO Dates
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        newObj[key] = date;
        continue;
      }
    }

    // 4. Recurse
    newObj[key] = fixDataTypes(value);
  }
  return newObj;
}

// List backups
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ success: true, backups: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.zip') || f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename: f,
          size: (stat.size / 1024 / 1024).toFixed(2) + ' MB',
          createdAt: stat.mtime.toISOString(),
          bytes: stat.size
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, backups: files });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Trigger backup now
router.post('/now', async (req, res) => {
  const io = req.app.get('io');
  res.json({ success: true, message: 'Comprehensive backup started' });
  runBackup(io).catch(e => console.error('Backup error:', e));
});

// Download backup
router.get('/download/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    // Basic safety: no dots or slashes except the extension dot
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return res.status(400).json({ success: false, message: 'Invalid filename' });
    }

    const fp = path.join(BACKUP_DIR, filename);
    
    console.log('📥 Download request for:', filename);
    console.log('📂 Full path:', fp);

    if (!fs.existsSync(fp)) {
      console.warn('❌ Backup file not found at:', fp);
      return res.status(404).json({ success: false, message: 'Backup not found' });
    }

    const stats = fs.statSync(fp);
    console.log('📏 File size:', stats.size, 'bytes');

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Length', stats.size);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    
    // Direct stream for maximum reliability with large files
    const stream = fs.createReadStream(fp);
    stream.pipe(res);

    stream.on('error', (err) => {
      console.error('❌ Stream error:', err);
      if (!res.headersSent) {
        res.status(500).send('Download failed');
      }
    });

    res.on('finish', () => {
      console.log('✅ Stream finished:', filename);
    });
  } catch (err) { 
    console.error('❌ Download route error:', err);
    res.status(500).json({ success: false, message: err.message }); 
  }
});

// Restore from backup (replaces data and uploads!)
router.post('/restore/:filename', async (req, res) => {
  const io = req.app.get('io');
  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'Backup not found' });

    console.log('🔄 Starting restore from:', safe);
    if (io) io.emit('restore_progress', { percent: 5, message: 'Extracting archive...' });

    let dbData = null;

    if (safe.endsWith('.zip')) {
      const zip = new AdmZip(fp);
      const zipEntries = zip.getEntries();

      // 1. Extract Database JSON
      const dbEntry = zipEntries.find(e => e.entryName === 'database.json');
      if (dbEntry) {
        dbData = JSON.parse(dbEntry.getData().toString('utf8'));
      }

      // 2. Extract Uploads
      const uploadsExist = zipEntries.some(e => e.entryName.startsWith('uploads/'));
      if (uploadsExist) {
        console.log('📂 Restoring media files...');
        if (io) io.emit('restore_progress', { percent: 15, message: 'Extracting media assets (this may take a minute)...' });
        
        // Yield event loop so the 15% socket message actually flushes to the client
        await new Promise(resolve => setTimeout(resolve, 100));

        // Extract only the uploads directory
        zipEntries.forEach(entry => {
          if (entry.entryName.startsWith('uploads/')) {
            zip.extractEntryTo(entry, path.join(__dirname, '../'), true, true);
          }
        });
        
        if (io) io.emit('restore_progress', { percent: 30, message: 'Media assets recovered. Reconstructing database...' });
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } else {
      // Legacy JSON backup
      dbData = JSON.parse(fs.readFileSync(fp, 'utf-8'));
    }

    if (!dbData || !dbData.collections) {
      return res.status(400).json({ success: false, message: 'Invalid backup format' });
    }

    // 3. Restore Database
    const collectionEntries = Object.entries(dbData.collections);
    const totalCols = collectionEntries.length;
    let restoredCount = 0;
    let currentColIndex = 0;

    for (const [colName, docs] of collectionEntries) {
      currentColIndex++;
      const progressPercent = 30 + Math.round((currentColIndex / totalCols) * 60); // 30% to 90%
      
      if (io) io.emit('restore_progress', { 
        percent: progressPercent, 
        message: `Restoring ${colName}... (${currentColIndex}/${totalCols})` 
      });

      if (['system.indexes', 'system.users'].includes(colName)) continue;
      
      const col = mongoose.connection.db.collection(colName);
      await col.deleteMany({}); // CLEAR CURRENT DATA
      
      if (docs && docs.length > 0) {
        const fixedDocs = docs.map(fixDataTypes);
        await col.insertMany(fixedDocs);
        restoredCount += docs.length;
      }
    }

    if (io) io.emit('restore_progress', { percent: 100, message: 'Restore complete!' });

    console.log('✅ Restore complete. Documents:', restoredCount);
    res.json({ success: true, message: `System restored successfully. ${restoredCount} records and media assets recovered.` });

  } catch (err) {
    console.error('❌ Restore failed:', err);
    if (io) io.emit('restore_progress', { percent: 0, status: 'error', message: err.message });
    res.status(500).json({ success: false, message: 'Restore failed: ' + err.message });
  }
});

// Delete a backup file
router.delete('/:filename', (req, res) => {
  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'Not found' });
    fs.unlinkSync(fp);
    res.json({ success: true, message: 'Backup deleted' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
