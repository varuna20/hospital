/**
 * BACKUP ROUTES — Super Admin only
 * =================================
 * GET  /api/backup/progress-status   - Poll active backup/restore progress
 * GET  /api/backup/list              - List available backup ZIPs
 * POST /api/backup/now               - Trigger manual backup (async, non-blocking)
 * GET  /api/backup/download/:file    - Stream-download a backup ZIP
 * POST /api/backup/restore/:filename - Restore from ZIP (streaming, low-RAM)
 * DELETE /api/backup/:filename       - Delete a backup file
 */
const express = require('express');
const router  = express.Router();
const path    = require('path');
const fs      = require('fs');
const readline = require('readline');
const { pipeline } = require('stream/promises');
const { protect, superAdminOnly } = require('../middleware/auth');
const { runBackup } = require('../utils/backup');

const BACKUP_DIR  = process.env.BACKUP_DIR  || path.join(__dirname, '../../backups');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

router.use(protect, superAdminOnly);

// ── Poll backup/restore progress ─────────────────────────────────────────────
router.get('/progress-status', (req, res) => {
  res.json({ success: true, status: global.backupProgress || { active: false, progress: 0, step: '', success: false, error: null } });
});

// ── List backup files ─────────────────────────────────────────────────────────
router.get('/list', (req, res) => {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return res.json({ success: true, backups: [] });
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.zip') || f.endsWith('.json'))
      .map(f => {
        const stat = fs.statSync(path.join(BACKUP_DIR, f));
        return {
          filename:  f,
          size:      (stat.size / 1024 / 1024).toFixed(2) + ' MB',
          createdAt: stat.mtime.toISOString(),
          bytes:     stat.size,
          format:    f.endsWith('.zip') ? 'zip' : 'json-legacy'
        };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, backups: files });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Trigger backup (returns immediately; backup runs in background) ─────────────
router.post('/now', (req, res) => {
  res.json({ success: true, message: 'Backup started in background' });
  runBackup().catch(e => console.error('Background backup error:', e));
});

// ── Download backup file ─────────────────────────────────────────────────────
router.get('/download/:filename', (req, res) => {
  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);
    if (!fs.existsSync(fp)) return res.status(404).json({ success: false, message: 'Backup not found' });
    res.download(fp, safe);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Streaming restore ────────────────────────────────────────────────────────
router.post('/restore/:filename', async (req, res) => {
  global.backupProgress = {
    active: true, type: 'restore', progress: 3,
    step: 'Opening backup archive…', error: null, success: false
  };

  // Return 202 immediately so the client can start polling
  res.json({ success: true, message: 'Restore started in background — poll /backup/progress-status' });

  try {
    const safe = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const fp   = path.join(BACKUP_DIR, safe);

    if (!fs.existsSync(fp)) {
      global.backupProgress = { active: false, type: 'restore', progress: 100,
        step: 'Restore failed: backup file not found', error: 'Not found', success: false };
      return;
    }

    const mongoose = require('mongoose');

    // ── ZIP restore (new format) ─────────────────────────────────────────────
    if (safe.endsWith('.zip')) {
      const unzipper = require('unzipper');

      global.backupProgress.step     = 'Reading ZIP manifest…';
      global.backupProgress.progress = 6;

      const directory = await unzipper.Open.file(fp);

      // Read manifest first
      const manifestEntry = directory.files.find(f => f.path === 'manifest.json');
      let manifest = {};
      if (manifestEntry) {
        const buf = await manifestEntry.buffer();
        manifest = JSON.parse(buf.toString('utf-8'));
      }

      const colEntries   = directory.files.filter(f => f.path.startsWith('collections/') && f.path.endsWith('.ndjson'));
      const assetEntries = directory.files.filter(f => f.path.startsWith('uploads/') && !f.path.endsWith('/'));
      const total        = colEntries.length + assetEntries.length;
      let   done         = 0;
      let   totalDocs    = 0;
      let   totalFiles   = 0;

      // Restore collections
      for (const entry of colEntries) {
        const colName = path.basename(entry.path, '.ndjson');
        if (['system.indexes','system.users'].includes(colName)) { done++; continue; }

        const pct = Math.floor(6 + ((done / total) * 68)); // 6 → 74 %
        global.backupProgress.step     = `Restoring collection: ${colName}…`;
        global.backupProgress.progress = pct;

        const col = mongoose.connection.db.collection(colName);
        await col.deleteMany({});

        // Stream NDJSON line-by-line, insert in 100-doc batches
        const stream = entry.stream();
        const rl     = readline.createInterface({ input: stream, crlfDelay: Infinity });
        let   batch  = [];

        for await (const line of rl) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            batch.push(JSON.parse(trimmed));
          } catch (_) { continue; }

          if (batch.length >= 100) {
            await col.insertMany(batch, { ordered: false }).catch(() => {});
            totalDocs += batch.length;
            batch = [];
          }
        }
        if (batch.length > 0) {
          await col.insertMany(batch, { ordered: false }).catch(() => {});
          totalDocs += batch.length;
        }

        console.log(`  ✓ restored ${colName}`);
        done++;
      }

      // Restore upload files (piped directly — zero base64 overhead)
      for (const entry of assetEntries) {
        const relPath  = entry.path.replace(/^uploads\//, '');
        const destPath = path.join(UPLOADS_DIR, relPath);
        const destDir  = path.dirname(destPath);

        const pct = Math.floor(74 + ((done / total) * 22)); // 74 → 96 %
        global.backupProgress.step     = `Restoring asset: ${relPath}…`;
        global.backupProgress.progress = pct;

        if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
        try {
          await pipeline(entry.stream(), fs.createWriteStream(destPath));
          totalFiles++;
        } catch (e) { console.warn('Asset restore failed:', relPath, e.message); }
        done++;
      }

      global.backupProgress = {
        active: false, type: 'restore', progress: 100,
        step: `Restore complete — ${totalDocs} records · ${totalFiles} media files restored`,
        error: null, success: true
      };
      console.log(`✅ Restore complete: ${totalDocs} docs, ${totalFiles} files`);

    } else {
      // ── Legacy JSON restore (old format) ──────────────────────────────────
      global.backupProgress.step     = 'Loading legacy JSON backup (this may take a moment)…';
      global.backupProgress.progress = 10;

      const backup  = JSON.parse(fs.readFileSync(fp, 'utf-8'));
      const entries = Object.entries(backup.collections || {});
      let restored  = 0;

      for (let i = 0; i < entries.length; i++) {
        const [colName, docs] = entries[i];
        const pct = Math.floor(10 + ((i / entries.length) * 80));
        global.backupProgress.step     = `Restoring collection ${colName}…`;
        global.backupProgress.progress = pct;

        if (['system.indexes','system.users'].includes(colName)) continue;
        const col = mongoose.connection.db.collection(colName);
        if (docs.length > 0) {
          await col.deleteMany({});
          await col.insertMany(docs, { ordered: false }).catch(() => {});
          restored += docs.length;
        }
      }

      global.backupProgress = {
        active: false, type: 'restore', progress: 100,
        step: `Legacy restore complete — ${restored} records restored`,
        error: null, success: true
      };
    }

  } catch (err) {
    console.error('Restore error:', err);
    global.backupProgress = {
      active: false, type: 'restore', progress: 100,
      step: 'Restore failed: ' + err.message,
      error: err.message, success: false
    };
  }
});

// ── Delete a backup file ─────────────────────────────────────────────────────
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
