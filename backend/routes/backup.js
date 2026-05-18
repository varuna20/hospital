/**
 * BACKUP ROUTES — Super Admin only
 * GET  /api/backup/list           - List backup files
 * POST /api/backup/now            - Trigger manual backup
 * GET  /api/backup/download/:file - Download a backup file
 * POST /api/backup/restore        - Restore from backup file
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const { protect, superAdminOnly } = require('../middleware/auth');
const { runBackup } = require('../utils/backup');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');

router.use(protect, superAdminOnly);

// Get backup/restore progress
router.get('/progress-status', (req, res) => {
  res.json({ success: true, status: global.backupProgress });
});

// List backups
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ success: true, backups: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.json'))
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
  res.json({ success: true, message: 'Backup started in background' });
  runBackup().catch(e => console.error('Backup error:', e));
});

// Download backup
router.get('/download/:filename', (req, res) => {
  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'Backup not found' });
    res.download(fp, safe);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Restore from backup (replaces data!)
router.post('/restore/:filename', async (req, res) => {
  global.backupProgress = {
    active: true,
    type: 'restore',
    progress: 5,
    step: 'Analyzing backup payload file...',
    error: null,
    success: false
  };

  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) {
      global.backupProgress.step = 'Restore failed: Backup file not found';
      global.backupProgress.progress = 100;
      global.backupProgress.active = false;
      global.backupProgress.error = 'Backup not found';
      return res.status(404).json({ success: false, message: 'Backup not found' });
    }

    const mongoose = require('mongoose');
    const backup   = JSON.parse(fs.readFileSync(fp, 'utf-8'));

    global.backupProgress.step = 'Backup payload analyzed. Preparing collection targets...';
    global.backupProgress.progress = 12;

    const entries = Object.entries(backup.collections || {});
    let restored = 0;

    for (let i = 0; i < entries.length; i++) {
      const [colName, docs] = entries[i];
      const pct = Math.floor(15 + ((i / entries.length) * 60));
      global.backupProgress.step = `Restoring collection ${colName} (${docs.length} documents)...`;
      global.backupProgress.progress = pct;

      // Skip system collections
      if (['system.indexes','system.users'].includes(colName)) continue;

      const col = mongoose.connection.db.collection(colName);
      if (docs.length > 0) {
        await col.deleteMany({});
        await col.insertMany(docs.map(d => ({ ...d, _id: mongoose.Types.ObjectId.createFromHexString(d._id.$oid || d._id) })));
        restored += docs.length;
      }
    }

    console.log('✅ Collection restore complete. Recreating upload media assets...');

    // Restore uploads files recursively
    let restoredFiles = 0;
    if (backup.uploads && Array.isArray(backup.uploads)) {
      const UPLOADS_DIR = path.join(__dirname, '../uploads');
      for (let j = 0; j < backup.uploads.length; j++) {
        const item = backup.uploads[j];
        const pct = Math.floor(75 + ((j / backup.uploads.length) * 20)); // 75% to 95%
        global.backupProgress.step = `Restoring upload asset (${j + 1}/${backup.uploads.length}): ${item.path}...`;
        global.backupProgress.progress = pct;

        const destPath = path.join(UPLOADS_DIR, item.path);
        const destDir = path.dirname(destPath);
        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        
        try {
          fs.writeFileSync(destPath, Buffer.from(item.content, 'base64'));
          restoredFiles++;
        } catch (e) {
          console.warn(`Failed to write file ${destPath}:`, e.message);
        }
      }
    }

    console.log(`✅ Restore complete: ${restored} documents, ${restoredFiles} upload assets`);
    
    global.backupProgress.step = `Restore complete! Successfully recovered ${restored} tables and ${restoredFiles} media/logo files.`;
    global.backupProgress.progress = 100;
    global.backupProgress.active = false;
    global.backupProgress.success = true;

    res.json({ success: true, message: `Restored ${restored} documents and ${restoredFiles} assets from ${safe}` });
  } catch (err) {
    console.error('Restore error:', err);
    
    global.backupProgress.step = 'Restore failed: ' + err.message;
    global.backupProgress.progress = 100;
    global.backupProgress.active = false;
    global.backupProgress.error = err.message;
    global.backupProgress.success = false;

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
