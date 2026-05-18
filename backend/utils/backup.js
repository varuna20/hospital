/**
 * BACKUP UTILITY
 * ==============
 * - Daily automated backup via node-cron
 * - Backs up all MongoDB collections to JSON files
 * - Supports local and network destinations
 * - Manual trigger via API
 */
const fs   = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { SystemSettings } = require('../models/SystemSettings');

const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');

async function runBackup() {
  const startTime = Date.now();
  console.log('📦 Starting database backup...');

  global.backupProgress = {
    active: true,
    type: 'backup',
    progress: 5,
    step: 'Initializing backup directory...',
    error: null,
    success: false
  };

  try {
    if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

    const timestamp  = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);

    global.backupProgress.step = 'Listing database collections...';
    global.backupProgress.progress = 10;

    // Collect all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const backup = { timestamp: new Date(), version: '3.0', collections: {}, uploads: [] };

    // Export collections
    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      const pct = Math.floor(10 + ((i / collections.length) * 50)); // 10% to 60%
      global.backupProgress.step = `Exporting collection ${col.name} (${i + 1}/${collections.length})...`;
      global.backupProgress.progress = pct;

      const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
      backup.collections[col.name] = docs;
    }

    // Export uploads directory files recursively
    global.backupProgress.step = 'Scanning and packing uploaded branding, logos, slideshows and videos...';
    global.backupProgress.progress = 62;

    const UPLOADS_DIR = path.join(__dirname, '../uploads');
    const packedFiles = [];

    const walkDir = (dir, baseDir = UPLOADS_DIR) => {
      if (!fs.existsSync(dir)) return;
      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');
        const stat = fs.statSync(fullPath);
        if (stat.isDirectory()) {
          walkDir(fullPath, baseDir);
        } else {
          try {
            const content = fs.readFileSync(fullPath, 'base64');
            packedFiles.push({ path: relPath, content });
          } catch (e) {
            console.warn(`Failed to read file ${fullPath}:`, e.message);
          }
        }
      }
    };

    walkDir(UPLOADS_DIR);
    backup.uploads = packedFiles;

    global.backupProgress.step = `Packed ${packedFiles.length} upload assets. Writing backup JSON payload...`;
    global.backupProgress.progress = 85;

    fs.writeFileSync(backupFile, JSON.stringify(backup, null, 2));
    const sizeMB = (fs.statSync(backupFile).size / 1024 / 1024).toFixed(2);

    // Clean up old backups (keep last 30 days)
    cleanOldBackups(30);

    // Copy to network path if configured
    const settings = await SystemSettings.findOne();
    if (settings?.backup?.destination === 'network' || settings?.backup?.destination === 'both') {
      if (settings.backup.networkPath) {
        global.backupProgress.step = 'Copying backup file to network storage path...';
        global.backupProgress.progress = 95;
        const netFile = path.join(settings.backup.networkPath, `backup_${timestamp}.json`);
        try { fs.copyFileSync(backupFile, netFile); console.log('📡 Backup copied to network:', netFile); }
        catch (e) { console.warn('Network backup failed:', e.message); }
      }
    }

    // Update last backup time
    await SystemSettings.findOneAndUpdate({}, { 'backup.lastBackup': new Date(), 'backup.lastBackupStatus': 'success' });

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Backup complete: ${backupFile} (${sizeMB} MB, ${duration}s)`);

    global.backupProgress.step = `Backup completed successfully! Packed ${packedFiles.length} media files and ${collections.length} tables.`;
    global.backupProgress.progress = 100;
    global.backupProgress.active = false;
    global.backupProgress.success = true;

    return { success: true, file: backupFile, sizeMB, duration };

  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    await SystemSettings.findOneAndUpdate({}, { 'backup.lastBackupStatus': 'failed' }).catch(() => {});
    
    global.backupProgress.step = 'Backup failed: ' + err.message;
    global.backupProgress.progress = 100;
    global.backupProgress.active = false;
    global.backupProgress.error = err.message;
    global.backupProgress.success = false;

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
  // Default: 1 AM every day
  const schedule = process.env.BACKUP_CRON || '0 1 * * *';
  cron.schedule(schedule, async () => {
    console.log('⏰ Scheduled backup triggered');
    await runBackup();
  });
  console.log('📅 Backup scheduler started (schedule:', schedule, ')');
}

module.exports = { runBackup, startBackupScheduler };
