/**
 * DOCTOR MODEL
 * ============
 * Full doctor profile including:
 * - Professional details
 * - Fee structure (hospital charge + doctor fee)
 * - Session schedule with start/end times (editable by staff)
 * - Today's WhatsApp notification status
 */

const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  dayOfWeek: {             // 0=Sunday … 6=Saturday
    type: Number,
    min: 0, max: 6
  },
  startTime: String,       // "09:00"
  endTime:   String,       // "17:00"
  isActive:  { type: Boolean, default: true },
  maxPatients: { type: Number, default: 30 },
  slotDuration: { type: Number, default: 15 },  // minutes per patient
  sessionName: { type: String, default: 'Session 1' }, // e.g. "Morning", "Evening", "Night"
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital' }
});

const doctorSchema = new mongoose.Schema({
  // ── Hospital Link ────────────────────────────────────────
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  hospitalIds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    index: true
  }],
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },

  // ── Personal / Professional Info ─────────────────────────
  name:           { type: String, required: true, trim: true },
  email:          String,
  phone:          String,
  specialization: { type: String, required: true },
  qualifications: [String],
  experience:     Number,      // years
  bio:            String,
  profileImage:   String,
  room:           String,      // "Room 101", "OPD 3"
  language:       [String],    // Languages spoken
  avgConsultMinutes: { type: Number, default: 5 }, // Override global queue settings

  // ── Fee Structure ─────────────────────────────────────────
  // BOTH fees are collected at booking / check-in
  fees: {
    doctorFee:      { type: Number, default: 0 },   // Goes to doctor
    hospitalCharge: { type: Number, default: 0 },   // Goes to hospital
    totalFee: {
      type: Number,
      default: function() {
        return (this.fees?.doctorFee || 0) + (this.fees?.hospitalCharge || 0);
      }
    }
  },

  // ── Weekly Schedule ───────────────────────────────────────
  // Each day can have different start/end times
  sessions: [sessionSchema],

  // ── Today's Live Status ───────────────────────────────────
  // Updated by staff each morning
  todayStatus: {
    isArrived:           { type: Boolean, default: false },
    arrivalTime:         Date,
    expectedArrivalTime: String,    // "10:30 AM"
    sessionStart:        String,    // Overrides for today
    sessionEnd:          String,
    sessionNotes:        String,
    whatsappSummarysent: { type: Boolean, default: false }
  },

  isActive: { type: Boolean, default: true },
  vacation: {
    enabled: { type: Boolean, default: false },
    startDate: Date,
    endDate: Date,
    untilFurtherNotice: { type: Boolean, default: false },
    note: String
  },
  notificationSettings: {
    notifyReschedule: { type: Boolean, default: true },
    notifySessionSummary: { type: Boolean, default: true },
    summaryLeadTimeMinutes: { type: Number, default: 60 }, // 1 hour before
    summarySendTime: { type: String, default: "19:00" }
  }

}, { timestamps: true });

// Auto-calculate total fee before save
doctorSchema.pre('save', function(next) {
  if (this.fees) {
    this.fees.totalFee = (this.fees.doctorFee || 0) + (this.fees.hospitalCharge || 0);
  }
  next();
});

// Index for fast hospital queries
doctorSchema.index({ hospitalId: 1, isActive: 1 });

module.exports = mongoose.model('Doctor', doctorSchema);
