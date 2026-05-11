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
  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'Backup not found' });

    const mongoose = require('mongoose');
    const backup   = JSON.parse(fs.readFileSync(fp, 'utf-8'));

    let restored = 0;
    for (const [colName, docs] of Object.entries(backup.collections || {})) {
      // Skip system collections
      if (['system.indexes','system.users'].includes(colName)) continue;
      const col = mongoose.connection.db.collection(colName);
      if (docs.length > 0) {
        await col.deleteMany({});
        await col.insertMany(docs.map(d => ({ ...d, _id: mongoose.Types.ObjectId.createFromHexString(d._id.$oid || d._id) })));
        restored += docs.length;
      }
    }
    console.log('✅ Restore complete:', restored, 'documents');
    res.json({ success: true, message: `Restored ${restored} documents from ${safe}` });
  } catch (err) {
    console.error('Restore error:', err);
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
