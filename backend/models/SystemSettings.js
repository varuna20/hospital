/**
 * SUBSCRIPTION PLAN MODEL
 * ========================
 * Super admin creates and manages plans.
 * Each hospital is assigned one plan.
 * Plans control which features are enabled/disabled.
 */
const mongoose = require('mongoose');

const subscriptionPlanSchema = new mongoose.Schema({
  name:        { type: String, required: true, trim: true },  // "Basic", "Premium"
  code:        { type: String, unique: true, lowercase: true }, // "basic"
  description: String,
  price:       { type: Number, default: 0 },           // Monthly fee in system currency
  currency:    { type: String, default: 'LKR' },
  billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },

  // Per-booking commission (percentage taken from hospital revenue)
  commissionPercent: { type: Number, default: 0, min: 0, max: 100 },

  // Feature flags — super admin toggles these
  features: {
    maxDoctors:         { type: Number, default: 5 },
    maxPatients:        { type: Number, default: 1000 },
    whatsappNotify:     { type: Boolean, default: false },
    smsNotify:          { type: Boolean, default: false },
    prescriptions:      { type: Boolean, default: true },
    revenueReports:     { type: Boolean, default: true },
    displayScreen:      { type: Boolean, default: true },
    videoWaitingRoom:   { type: Boolean, default: false },
    customTheme:        { type: Boolean, default: true },
    apiAccess:          { type: Boolean, default: false },
    multiDoctor:        { type: Boolean, default: true },
    advancedReports:    { type: Boolean, default: false },
    emailNotify:        { type: Boolean, default: false },
    backupRestore:      { type: Boolean, default: false },
  },

  isActive: { type: Boolean, default: true },
  sortOrder: { type: Number, default: 0 }

}, { timestamps: true });

/**
 * SYSTEM SETTINGS MODEL
 * ======================
 * Global settings for the super admin — email, SMS, backup config.
 * Only one document ever exists.
 */
const systemSettingsSchema = new mongoose.Schema({
  singleton: { type: Boolean, default: true, unique: true },

  // ── Email / SMTP ──────────────────────────────────────────────
  email: {
    enabled:    { type: Boolean, default: false },
    provider:   { type: String, enum: ['smtp', 'gmail', 'sendgrid'], default: 'smtp' },
    host:       String,
    port:       { type: Number, default: 587 },
    secure:     { type: Boolean, default: false },
    user:       String,
    password:   String,
    fromName:   { type: String, default: 'Hospital eChanneling' },
    fromEmail:  String,
    // Auto-billing settings
    autoBilling: {
      enabled:  { type: Boolean, default: false },
      dayOfMonth: { type: Number, default: 1 },
      subject:  { type: String, default: 'Monthly Invoice — Hospital eChanneling' }
    }
  },

  // ── SMS Gateway ───────────────────────────────────────────────
  sms: {
    enabled:   { type: Boolean, default: false },
    provider:  { type: String, enum: ['textlk', 'twilio', 'nexmo', 'aws-sns', 'custom'], default: 'textlk' },
    apiKey:    String,
    textLkApiKey: String,  // text.lk Bearer API key
    senderId:  String,   // Sender ID (max 11 chars)
    apiSecret: String,
    senderId:  String,
    apiUrl:    String     // For custom providers
  },

  // ── Backup Settings ───────────────────────────────────────────
  backup: {
    enabled:        { type: Boolean, default: false },
    schedule:       { type: String, default: '0 1 * * *' },   // cron: 1 AM daily
    retentionDays:  { type: Number, default: 30 },
    destination:    { type: String, enum: ['local', 'network', 'both'], default: 'local' },
    localPath:      { type: String, default: './backups' },
    networkPath:    String,                                     // UNC path or FTP
    lastBackup:     Date,
    lastBackupStatus: { type: String, enum: ['success', 'failed', 'running'], default: 'success' }
  },

  // ── Security ──────────────────────────────────────────────────
  security: {
    maxLoginAttempts:   { type: Number, default: 5 },
    lockoutMinutes:     { type: Number, default: 15 },
    sessionHours:       { type: Number, default: 8 },
    requireStrongPassword: { type: Boolean, default: true },
    twoFactorEnabled:   { type: Boolean, default: false }
  },
  
  // ── Branding ──────────────────────────────────────────────────
  branding: {
    logo:        String,
    brandName:   { type: String, default: 'Chevara Labs' },
    website:     { type: String, default: 'https://chevaralabs.com' },
    footerText:  { type: String, default: 'Powered by' }
  },

  // ── Payment Gateway ───────────────────────────────────────────
  payment: {
    paypalClientId: { type: String, default: '' },
    paypalEmail:    { type: String, default: 'varuna.20@gmail.com' },
    currency:       { type: String, default: 'USD' }
  }

}, { timestamps: true });

const SubscriptionPlan = mongoose.model('SubscriptionPlan', subscriptionPlanSchema);
const SystemSettings   = mongoose.model('SystemSettings', systemSettingsSchema);

module.exports = { SubscriptionPlan, SystemSettings };
