const fs   = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron');
const archiver = require('archiver');
const { SystemSettings } = require('../models/SystemSettings');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../backups');
const UPLOADS_DIR = path.join(__dirname, '../uploads');

/**
 * Enhanced Backup: Database + Uploads Media
 */
async function runBackup(io = null) {
  const startTime = Date.now();
  console.log('📦 Starting comprehensive backup (DB + Media)...');

  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const finalZipPath = path.join(BACKUP_DIR, `full_backup_${timestamp}.zip`);
    const tempZipPath = finalZipPath + '.tmp';
    
    const output = fs.createWriteStream(tempZipPath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    // Handle archive events
    const archiveFinished = new Promise((resolve, reject) => {
      output.on('close', resolve);
      archive.on('error', reject);
    });

    archive.pipe(output);

    // Progress tracking
    let totalEntries = 0;
    if (io) {
      archive.on('progress', (data) => {
        const progress = {
          percent: data.entries.total ? Math.round((data.entries.processed / data.entries.total) * 100) : 0,
          processed: data.entries.processed,
          total: data.entries.total || '...'
        };
        io.emit('backup_progress', progress);
      });
    }
    
    // 1. Database Dump
    const collections = await mongoose.connection.db.listCollections().toArray();
    const dbDump = { timestamp: new Date(), version: '4.0', collections: {} };

    for (const col of collections) {
      if (col.name.startsWith('system.')) continue;
      const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
      dbDump.collections[col.name] = docs;
    }
    
    archive.append(JSON.stringify(dbDump, null, 2), { name: 'database.json' });

    // 2. Uploads Directory
    if (fs.existsSync(UPLOADS_DIR)) {
      archive.directory(UPLOADS_DIR, 'uploads');
    }

    // Finalize
    await archive.finalize();
    await archiveFinished;

    // Rename temp to final only after it's finished!
    fs.renameSync(tempZipPath, finalZipPath);
    const backupZip = finalZipPath;

    const sizeMB = (fs.statSync(backupZip).size / 1024 / 1024).toFixed(2);

    if (io) io.emit('backup_progress', { percent: 100, status: 'complete', file: path.basename(backupZip) });

    // Clean up old backups (keep last 30 days)
    cleanOldBackups(30);

    // Copy to network path if configured
    const settings = await SystemSettings.findOne();
    if (settings?.backup?.destination === 'network' || settings?.backup?.destination === 'both') {
      if (settings.backup.networkPath) {
        if (!fs.existsSync(settings.backup.networkPath)) {
          fs.mkdirSync(settings.backup.networkPath, { recursive: true });
        }
        const netFile = path.join(settings.backup.networkPath, `full_backup_${timestamp}.zip`);
        try { fs.copyFileSync(backupZip, netFile); console.log('📡 Backup copied to network:', netFile); }
        catch (e) { console.warn('Network backup failed:', e.message); }
      }
    }

    // Update last backup time
    await SystemSettings.findOneAndUpdate({}, { 
      'backup.lastBackup': new Date(), 
      'backup.lastBackupStatus': 'success' 
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Backup complete: ${backupZip} (${sizeMB} MB, ${duration}s)`);
    return { success: true, file: backupZip, sizeMB, duration };

  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    await SystemSettings.findOneAndUpdate({}, { 'backup.lastBackupStatus': 'failed' }).catch(() => {});
    return { success: false, error: err.message };
  }
}

function cleanOldBackups(retentionDays = 30) {
  try {
    if (!fs.existsSync(BACKUP_DIR)) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    fs.readdirSync(BACKUP_DIR).forEach(f => {
      const fp = path.join(BACKUP_DIR, f);
      if (fs.statSync(fp).mtimeMs < cutoff) { fs.unlinkSync(fp); console.log('🗑 Old backup removed:', f); }
    });
  } catch (e) { console.warn('Cleanup warning:', e.message); }
}

function startBackupScheduler() {
  const schedule = process.env.BACKUP_CRON || '0 1 * * *';
  cron.schedule(schedule, async () => {
    console.log('⏰ Scheduled backup triggered');
    await runBackup();
  });
  console.log('📅 Backup scheduler started (schedule:', schedule, ')');
}

module.exports = { runBackup, startBackupScheduler };
