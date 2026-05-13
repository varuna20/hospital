/**
 * INIT DEFAULTS
 * =============
 * Creates default subscription plans, system settings, and drug library on first boot.
 * Called automatically from server.js on startup.
 */
const { SubscriptionPlan, SystemSettings } = require('../models/SystemSettings');

async function initDefaults() {
  // ── Default subscription plans ─────────────────────────────────
  const planCount = await SubscriptionPlan.countDocuments();
  if (planCount === 0) {
    await SubscriptionPlan.insertMany([
      {
        name: 'Trial', code: 'trial', description: 'Free trial — limited features', price: 0,
        commissionPercent: 0, sortOrder: 1,
        features: { maxDoctors:2, maxPatients:100, whatsappNotify:false, smsNotify:false,
          prescriptions:true, revenueReports:false, displayScreen:true, videoWaitingRoom:false,
          customTheme:false, multiDoctor:false, advancedReports:false, emailNotify:false, backupRestore:false }
      },
      {
        name: 'Basic', code: 'basic', description: 'For small clinics', price: 5000,
        commissionPercent: 2, sortOrder: 2,
        features: { maxDoctors:5, maxPatients:1000, whatsappNotify:true, smsNotify:false,
          prescriptions:true, revenueReports:true, displayScreen:true, videoWaitingRoom:false,
          customTheme:true, multiDoctor:true, advancedReports:false, emailNotify:true, backupRestore:false }
      },
      {
        name: 'Premium', code: 'premium', description: 'Full-featured for hospitals', price: 15000,
        commissionPercent: 1.5, sortOrder: 3,
        features: { maxDoctors:20, maxPatients:10000, whatsappNotify:true, smsNotify:true,
          prescriptions:true, revenueReports:true, displayScreen:true, videoWaitingRoom:true,
          customTheme:true, multiDoctor:true, advancedReports:true, emailNotify:true, backupRestore:true }
      },
      {
        name: 'Enterprise', code: 'enterprise', description: 'Unlimited — dedicated support', price: 50000,
        commissionPercent: 1, sortOrder: 4,
        features: { maxDoctors:9999, maxPatients:999999, whatsappNotify:true, smsNotify:true,
          prescriptions:true, revenueReports:true, displayScreen:true, videoWaitingRoom:true,
          customTheme:true, multiDoctor:true, advancedReports:true, emailNotify:true, backupRestore:true, apiAccess:true }
      }
    ]);
    console.log('✅ Default subscription plans created');
  }

  // ── System settings ─────────────────────────────────────────────
  const settingsCount = await SystemSettings.countDocuments();
  if (settingsCount === 0) {
    await SystemSettings.create({
      branding: {
        brandName: 'Chevara Labs',
        footerText: 'Powered by',
        website: 'https://chevaralabs.com'
      }
    });
    console.log('✅ Default system settings created');
  }

  // ── Default drug library ────────────────────────────────────────
  try {
    const { seedDefaultDrugs } = require('./seedDrugs');
    await seedDefaultDrugs();
  } catch (e) {
    console.warn('Drug seed skipped:', e.message);
  }

  console.log('✅ Defaults initialized');
}

module.exports = initDefaults;
