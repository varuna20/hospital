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
    global.backupProgress.progress = 12;

    // Collect all collections
    const collections = await mongoose.connection.db.listCollections().toArray();
    const backup = { timestamp: new Date(), version: '3.0', collections: {} };

    for (let i = 0; i < collections.length; i++) {
      const col = collections[i];
      const pct = Math.floor(15 + ((i / collections.length) * 70));
      global.backupProgress.step = `Exporting collection ${col.name} (${i + 1}/${collections.length})...`;
      global.backupProgress.progress = pct;

      const docs = await mongoose.connection.db.collection(col.name).find({}).toArray();
      backup.collections[col.name] = docs;
    }

    global.backupProgress.step = 'Writing JSON backup file to local disk...';
    global.backupProgress.progress = 88;

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

    global.backupProgress.step = 'Database backup complete!';
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
