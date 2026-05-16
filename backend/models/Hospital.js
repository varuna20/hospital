/**
 * HOSPITAL MODEL
 * ==============
 * Each hospital is a completely isolated tenant.
 * All other data (doctors, patients, appointments) belongs to one hospital.
 *
 * The 'theme' object drives the entire UI color scheme per hospital.
 */

const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({
  // ── Basic Info ──────────────────────────────────────────
  name: {
    type: String,
    required: [true, 'Hospital name is required'],
    trim: true
  },
  shortName: {          // Used in compact displays
    type: String,
    trim: true
  },
  registrationNumber: String,
  address: String,
  city: String,
  country: { type: String, default: 'Sri Lanka' },
  phone: String,
  email: String,
  website: String,

  // ── Branding ────────────────────────────────────────────
  logo: String,         // Path to uploaded logo file
  logoUrl: String,      // External URL (alternative)

  // Color theme — applied via CSS variables across the entire UI
  theme: {
    primary:    { type: String, default: '#0d9488' },  // Teal
    secondary:  { type: String, default: '#0f172a' },  // Dark slate
    accent:     { type: String, default: '#f59e0b' },  // Amber
    background: { type: String, default: '#0f172a' },
    surface:    { type: String, default: '#1e293b' },
    surface2:   { type: String, default: '#334155' },
    text:       { type: String, default: '#e2e8f0' },
    success:    { type: String, default: '#10b981' },
    danger:     { type: String, default: '#ef4444' },
    glassEffect: { type: Boolean, default: true }
  },

  displayLayout: {
    type: String,
    enum: ['futuristic_3d', 'classic_list', 'split_view', 'grid_compact'],
    default: 'futuristic_3d'
  },

  // ── WhatsApp Integration ─────────────────────────────────
  whatsapp: {
    enabled:        { type: Boolean, default: false },
    twilioSid:      String,    // Hospital's own Twilio account (optional)
    twilioToken:    String,
    fromNumber:     String,    // whatsapp:+14155238886
    // Which events trigger WhatsApp messages
    notifyOnBook:   { type: Boolean, default: true },
    notifyOnTurn:   { type: Boolean, default: true },
    notifyDoctor:   { type: Boolean, default: true },  // Session summary to doctor
    templates: {
      booking: String,
      arrival: String,
      late:    String,
      cancel:  String,
      turn:    String,
      reminder:String
    }
  },

  // ── Payment / Charges ────────────────────────────────────
  payment: {
    enabled:           { type: Boolean, default: false },
    currency:          { type: String, default: 'LKR' },
    currencySymbol:    { type: String, default: 'Rs.' },
    defaultHospitalCharge: { type: Number, default: 0 },
    onlineEnabled:     { type: Boolean, default: false }
  },

  // ── Queue Settings ───────────────────────────────────────
  queueSettings: {
    autoResetAtMidnight:  { type: Boolean, default: true },
    avgConsultMinutes:    { type: Number, default: 15 },
    notifyWhenAhead:      { type: Number, default: 3 },
    showPatientNameOnDisplay: { type: Boolean, default: true },
    announcement:         { type: String, default: '' },
    announcementTemplates: [{
      title: String,
      message: String
    }]
  },

  // ── Clinic Hours ─────────────────────────────────────────
  clinicHours: {
    open:  { type: String, default: '08:00' },
    close: { type: String, default: '20:00' }
  },

  // ── Status ───────────────────────────────────────────────

  // ── Display Slideshow ──────────────────────────────────────────
  slideshow: [{
    url:      String,
    filename: String,
    type:     { type: String, enum: ['image','video'], default:'image' },
    duration: { type: Number, default: 10 },
    order:    { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    caption:  String,
  }],
  // ── Waiting Room Video ────────────────────────────────────────────
  waitingVideo: {
    url:      String,       // /uploads/videos/...
    filename: String,
    enabled:  { type: Boolean, default: false },
    // Auto-stop video when doctor arrives
    autoStopOnArrival: { type: Boolean, default: true }
  },


  isActive: { type: Boolean, default: true },
  subscriptionPlan: {
    type: String,
    enum: ['trial', 'basic', 'premium', 'enterprise'],
    default: 'trial'
  },
  subscriptionExpiry: Date,



  // ── Per-hospital SMS (text.lk) ────────────────────────────────
  sms: {
    enabled:       { type: Boolean, default: false },
    provider:      { type: String, default: 'textlk' }, // textlk | twilio | custom
    textLkApiKey:  String,   // text.lk Bearer API key
    senderId:      String,   // Max 11 chars shown on phone e.g. 'CITYMEDI'
    notifyOnBook:  { type: Boolean, default: true },
    notifyOnTurn:  { type: Boolean, default: true },
    notifyArrival: { type: Boolean, default: true },
    templates: {
      booking: String,   // Custom template for booking
      arrival: String,   // Custom template for doctor arrival
      late:    String,   // Custom template for doctor late
      change:  String,   // Custom template for appointment change
      cancel:  String,   // Custom template for session cancellation
      turn:    String,   // Custom template for turn alert
      reminder:String    // Custom template for booking reminder
    }
  },

  // ── Billing ───────────────────────────────────────────────────────
  billing: {
    commissionPercent: { type: Number, default: 0 },   // % taken from hospital revenue
    billingEmail:      String,                          // override billing email
    lastBilledAt:      Date,
    lastBillAmount:    Number
  },

  // Unique slug for URL routing (e.g. /hospital/central-hospital)
  slug: {
    type: String,
    unique: true,
    lowercase: true,
    trim: true
  }

}, { timestamps: true });

// Auto-generate slug from name if not provided
hospitalSchema.pre('save', function(next) {
  if (!this.slug && this.name) {
    this.slug = this.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  }
  if (!this.shortName && this.name) {
    this.shortName = this.name.split(' ').slice(0, 2).join(' ');
  }
  next();
});

module.exports = mongoose.model('Hospital', hospitalSchema);

// Note: waitingVideo added via patch
