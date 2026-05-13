/**
 * SYSTEM SETTINGS ROUTES (Super Admin only)
 * GET  /api/system/settings          - Get all settings
 * PUT  /api/system/settings          - Update settings
 * POST /api/system/email/test        - Test email
 * POST /api/system/sms/test          - Test SMS
 * GET  /api/system/backups           - List backups
 * POST /api/system/backup/now        - Trigger manual backup
 */
const express = require('express');
const router  = express.Router();
const { SystemSettings } = require('../models/SystemSettings');
const { protect, superAdminOnly } = require('../middleware/auth');

// Public route for branding (logo, name)
router.get('/branding', async (req, res) => {
  try {
    const s = await SystemSettings.findOne().select('branding');
    res.json({ success: true, branding: s?.branding || {} });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.use(protect, superAdminOnly);

// Get settings
router.get('/settings', async (req, res) => {
  try {
    let s = await SystemSettings.findOne();
    if (!s) s = await SystemSettings.create({});
    // Never return sensitive passwords to client in plaintext
    const safe = s.toObject();
    if (safe.email?.password)  safe.email.password  = '••••••••';
    if (safe.sms?.apiSecret)   safe.sms.apiSecret   = '••••••••';
    res.json({ success: true, settings: safe });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update settings
router.put('/settings', async (req, res) => {
  try {
    let s = await SystemSettings.findOne();
    if (!s) s = new SystemSettings();
    // Don't overwrite passwords with masked values
    const data = req.body;
    if (data.email?.password  === '••••••••') delete data.email.password;
    if (data.sms?.apiSecret   === '••••••••') delete data.sms.apiSecret;
    Object.assign(s, data);
    await s.save();
    res.json({ success: true, message: 'Settings saved' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Test email
router.post('/email/test', async (req, res) => {
  try {
    const { testEmail } = req.body;
    const s = await SystemSettings.findOne();
    if (!s?.email?.enabled || !s.email.host) return res.status(400).json({ success: false, message: 'Email not configured' });
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransporter({
      host: s.email.host, port: s.email.port, secure: s.email.secure,
      auth: { user: s.email.user, pass: s.email.password }
    });
    await transporter.verify();
    await transporter.sendMail({
      from: `"${s.email.fromName}" <${s.email.fromEmail}>`,
      to: testEmail, subject: 'Test Email — Hospital eChanneling',
      html: '<h2>✅ Email is working!</h2><p>Your SMTP configuration is correct.</p>'
    });
    res.json({ success: true, message: 'Test email sent to ' + testEmail });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Test SMS
router.post('/sms/test', async (req, res) => {
  try {
    const { testPhone } = req.body;
    const s = await SystemSettings.findOne();
    if (!s?.sms?.enabled) return res.status(400).json({ success: false, message: 'SMS not configured' });

    const { sendSms } = require('../utils/sms');
    const { provider, apiKey, textLkApiKey, apiSecret, senderId } = s.sms;

    let result;
    if (provider === 'textlk') {
      const key = (textLkApiKey || apiKey || apiSecret || '').trim();
      result = await sendSms({
        to: testPhone,
        message: 'Test SMS from Hospital eChanneling ✅',
        apiKey: key,
        senderId: (senderId || 'HOSPITAL').trim()
      });
    } else if (provider === 'twilio') {
      const twilio = require('twilio');
      const client = twilio(apiKey, apiSecret);
      result = await client.messages.create({
        body: 'Test SMS from Hospital eChanneling ✅',
        from: senderId,
        to: testPhone
      });
    } else {
      return res.status(400).json({ success: false, message: `Provider ${provider} test not implemented yet` });
    }

    res.json({ success: true, message: 'Test SMS sent', result });
  } catch (err) {
    console.error('SMS test error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// List backup files
router.get('/backups', async (req, res) => {
  try {
    const fs   = require('fs');
    const path = require('path');
    const backupDir = path.join(__dirname, '../../backups');
    if (!fs.existsSync(backupDir)) return res.json({ success: true, backups: [] });
    const files = fs.readdirSync(backupDir)
      .filter(f => f.endsWith('.json') || f.endsWith('.zip'))
      .map(f => {
        const stat = fs.statSync(path.join(backupDir, f));
        return { name: f, size: stat.size, createdAt: stat.mtime };
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json({ success: true, backups: files });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Trigger manual backup
router.post('/backup/now', async (req, res) => {
  try {
    const { runBackup } = require('../utils/backup');
    res.json({ success: true, message: 'Backup started in background' });
    // Run async (don't await so response is immediate)
    runBackup().then(r => console.log('Manual backup:', r)).catch(e => console.error('Backup error:', e));
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Download backup file
router.get('/backup/download/:filename', async (req, res) => {
  try {
    const path = require('path');
    const safeName = req.params.filename.replace(/[^a-zA-Z0-9._-]/g, '');
    const filePath = path.join(__dirname, '../../backups', safeName);
    if (!require('fs').existsSync(filePath)) return res.status(404).json({ success: false, message: 'File not found' });
    res.download(filePath);
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
