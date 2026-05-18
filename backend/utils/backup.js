/**
 * BACKUP UTILITY — Streaming ZIP-based Full System Backup
 * ========================================================
 * Strategy: archiver streams every MongoDB document and every upload file
 * directly to a ZIP on disk — peak RAM usage is ~10MB regardless of backup size.
 *
 * Backup layout inside ZIP:
 *   manifest.json                  — metadata (timestamp, version, counts)
 *   collections/<name>.ndjson      — one JSON doc per line, streamed
 *   uploads/<relative/path>        — binary files, piped directly
 */
const fs       = require('fs');
const path     = require('path');
const { Readable } = require('stream');
const archiver = require('archiver');
const mongoose = require('mongoose');
const { EJSON }  = require('bson');          // bundled with mongoose → faithful BSON round-trip
const cron     = require('node-cron');
const { SystemSettings } = require('../models/SystemSettings');

const BACKUP_DIR  = process.env.BACKUP_DIR  || path.join(__dirname, '../../backups');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

// ── Helper: stream one MongoDB collection into the archive as NDJSON ──────────
function streamCollection(archive, colName, db) {
  return new Promise((resolve, reject) => {
    const readable = new Readable({ read() {} });
    archive.append(readable, { name: `collections/${colName}.ndjson` });

    const cursor = db.collection(colName).find({});
    let count = 0;

    const pump = async () => {
      try {
        let doc;
        while ((doc = await cursor.next()) !== null) {
          readable.push(EJSON.stringify(doc) + '\n');  // preserves ObjectId, Date, Binary…
          count++;
        }
        readable.push(null); // signal end-of-stream
        resolve(count);
      } catch (err) {
        readable.destroy(err);
        reject(err);
      }
    };
    pump();
  });
}

// ── Main backup function ───────────────────────────────────────────────────────
async function runBackup() {
  const startTime = Date.now();
  console.log('📦 Starting streaming ZIP backup...');

  global.backupProgress = {
    active: true, type: 'backup', progress: 3,
    step: 'Initialising backup directory…', error: null, success: false
  };

  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.zip`);

    // ── Create streaming ZIP archive ─────────────────────────────────────────
    const output  = fs.createWriteStream(backupFile);
    const archive = archiver('zip', { zlib: { level: 6 } });

    const archiveClosed = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // ── 1. Export MongoDB collections ─────────────────────────────────────────
    global.backupProgress.step = 'Listing database collections…';
    global.backupProgress.progress = 8;

    const db          = mongoose.connection.db;
    const collections = await db.listCollections().toArray();
    const colNames    = collections.map(c => c.name).filter(n => !n.startsWith('system.'));
    let totalDocs = 0;

    for (let i = 0; i < colNames.length; i++) {
      const name = colNames[i];
      const pct  = Math.floor(8 + ((i / colNames.length) * 52)); // 8 → 60 %
      global.backupProgress.step     = `Exporting collection ${name} (${i + 1}/${colNames.length})…`;
      global.backupProgress.progress = pct;

      const count = await streamCollection(archive, name, db);
      totalDocs += count;
      console.log(`  ✓ ${name}: ${count} docs`);
    }

    // ── 2. Pack uploads folder (binary, no base64) ────────────────────────────
    global.backupProgress.step     = 'Scanning upload assets (logos, branding, videos)…';
    global.backupProgress.progress = 62;

    let fileCount = 0;
    if (fs.existsSync(UPLOADS_DIR)) {
      const walkDir = (dir) => {
        const items = fs.readdirSync(dir);
        for (const item of items) {
          const full = path.join(dir, item);
          if (fs.statSync(full).isDirectory()) {
            walkDir(full);
          } else {
            const rel = path.relative(UPLOADS_DIR, full).replace(/\\/g, '/');
            archive.file(full, { name: `uploads/${rel}` });
            fileCount++;
          }
        }
      };
      walkDir(UPLOADS_DIR);
    }

    global.backupProgress.step     = `Packing ${fileCount} media files into archive…`;
    global.backupProgress.progress = 75;

    // ── 3. Write manifest ─────────────────────────────────────────────────────
    const manifest = {
      timestamp: new Date().toISOString(),
      version:   '4.0',
      format:    'streaming-zip',
      collections: colNames,
      totalDocs,
      totalFiles: fileCount
    };
    archive.append(JSON.stringify(manifest, null, 2), { name: 'manifest.json' });

    // ── 4. Finalise archive ───────────────────────────────────────────────────
    global.backupProgress.step     = 'Compressing and finalising ZIP archive…';
    global.backupProgress.progress = 82;

    archive.finalize();
    await archiveClosed;

    const sizeMB = (fs.statSync(backupFile).size / 1024 / 1024).toFixed(2);
    cleanOldBackups(30);

    // Copy to network if configured
    const settings = await SystemSettings.findOne();
    if ((settings?.backup?.destination === 'network' || settings?.backup?.destination === 'both')
        && settings.backup.networkPath) {
      global.backupProgress.step     = 'Copying archive to network path…';
      global.backupProgress.progress = 94;
      const netFile = path.join(settings.backup.networkPath, `backup_${timestamp}.zip`);
      try { fs.copyFileSync(backupFile, netFile); }
      catch (e) { console.warn('Network copy failed:', e.message); }
    }

    await SystemSettings.findOneAndUpdate(
      {}, { 'backup.lastBackup': new Date(), 'backup.lastBackupStatus': 'success' }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Backup complete: ${backupFile} (${sizeMB} MB, ${duration}s)`);

    global.backupProgress = {
      active: false, type: 'backup', progress: 100,
      step: `Backup complete — ${totalDocs} records · ${fileCount} media files · ${sizeMB} MB · ${duration}s`,
      error: null, success: true
    };

    return { success: true, file: backupFile, sizeMB, duration };

  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    await SystemSettings.findOneAndUpdate(
      {}, { 'backup.lastBackupStatus': 'failed' }
    ).catch(() => {});

    global.backupProgress = {
      active: false, type: 'backup', progress: 100,
      step: 'Backup failed: ' + err.message,
      error: err.message, success: false
    };
    return { success: false, error: err.message };
  }
}

// ── Housekeeping ───────────────────────────────────────────────────────────────
function cleanOldBackups(retentionDays = 30) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const cutoff = Date.now() - retentionDays * 86400000;
    fs.readdirSync(BACKUP_DIR)
      .filter(f => f.endsWith('.zip') || f.endsWith('.json'))
      .forEach(f => {
        const fp = path.join(BACKUP_DIR, f);
        if (fs.statSync(fp).mtimeMs < cutoff) {
          fs.unlinkSync(fp);
          console.log('🗑 Removed old backup:', f);
        }
      });
  } catch (e) { console.warn('Cleanup error:', e.message); }
}

// ── Scheduled backup ───────────────────────────────────────────────────────────
function scheduleBackup() {
  cron.schedule('0 1 * * *', async () => {
    try {
      const s = await SystemSettings.findOne();
      if (s?.backup?.enabled) {
        console.log('⏰ Running scheduled backup…');
        await runBackup();
      }
    } catch (e) { console.error('Scheduled backup error:', e.message); }
  });
}

module.exports = { runBackup, scheduleBackup };
