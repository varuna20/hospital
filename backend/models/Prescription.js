/**
 * PRESCRIPTION MODEL
 * ==================
 * Stores doctor's prescriptions per visit.
 * Each prescription is linked to:
 *  - One patient (searchable by name/phone)
 *  - One doctor (doctor sees ONLY their own)
 *  - One appointment
 *  - One hospital
 *
 * Supports: custom letterhead, print, drug history retrieval
 */
const mongoose = require('mongoose');

const drugSchema = new mongoose.Schema({
  name:          { type: String, required: true, trim: true },
  dosage:        { type: String, trim: true },        // "500mg"
  frequency:     { type: String, trim: true },        // "3 times daily"
  duration:      { type: String, trim: true },        // "7 days"
  route:         { type: String, trim: true },        // "Oral / Topical / IV"
  instructions:  { type: String, trim: true },        // "Take after food"
  quantity:      { type: String, trim: true },        // "21 tablets"
}, { _id: true });

const prescriptionSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Hospital',
    required: true,
    index: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Doctor',
    required: true,
    index: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Patient',
    required: true,
    index: true
  },
  appointment: {
    type: mongoose.Schema.Types.ObjectId,
    ref:  'Appointment'
  },

  // ── Visit Info ────────────────────────────────────────────────
  visitDate:   { type: Date, default: Date.now },
  chiefComplaint: String,
  diagnosis:   String,
  notes:       String,            // Doctor's private notes
  followUpDate: Date,
  followUpNotes: String,

  // ── Drugs ─────────────────────────────────────────────────────
  drugs: [drugSchema],

  // ── Vitals (optional) ─────────────────────────────────────────
  vitals: {
    bloodPressure: String,   // "120/80"
    pulse:         String,   // "72 bpm"
    temperature:   String,   // "37.2°C"
    weight:        String,   // "65 kg"
    height:        String,   // "170 cm"
    spo2:          String    // "98%"
  },

  // ── Letterhead config (per prescription) ──────────────────────
  // Pre-filled from doctor + hospital, but can be customized
  letterhead: {
    hospitalName:   String,
    hospitalAddress: String,
    hospitalPhone:  String,
    hospitalLogo:   String,
    doctorName:     String,
    doctorDegree:   String,   // "MBBS, MD"
    doctorSpecialty: String,
    doctorRegNo:    String,   // Medical registration number
    showLogo:       { type: Boolean, default: true },
    footerText:     String
  },

  isPrinted:  { type: Boolean, default: false },
  printedAt:  Date,

  // Confidential flag - always true for reports
  isConfidential: { type: Boolean, default: true }

}, { timestamps: true });

// Compound indexes for fast patient history lookup
prescriptionSchema.index({ doctor: 1, patient: 1, visitDate: -1 });
prescriptionSchema.index({ hospitalId: 1, patient: 1 });
prescriptionSchema.index({ doctor: 1, visitDate: -1 });

module.exports = mongoose.model('Prescription', prescriptionSchema);
