/**
 * APPOINTMENT MODEL
 * =================
 * Tracks every appointment with full revenue breakdown:
 * - doctorFee     → Doctor's income
 * - hospitalCharge → Hospital's income
 * - totalAmount   → Patient pays this
 *
 * Payment status tracked separately so reports are clean.
 */

const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true
  },

  appointmentDate: { type: Date, required: true },
  queueNumber:     { type: Number, required: true },

  // Session context (for doctors with multiple sessions per day)
  sessionId:       String, // index of the session in the doctor.sessions array or a unique ID
  sessionLabel:    String, // e.g. "Morning", "Evening"

  // ── Status Flow ─────────────────────────────────────────────
  // booked → arrived → in-progress → completed / absent / cancelled
  status: {
    type: String,
    enum: ['booked', 'arrived', 'in-progress', 'completed', 'absent', 'cancelled'],
    default: 'booked'
  },

  isEmergency: { type: Boolean, default: false },
  reason:      String,
  consultationNotes: String,

  // ── Revenue ──────────────────────────────────────────────────
  // Fees are COPIED from doctor at booking time (in case fees change later)
  fees: {
    doctorFee:      { type: Number, default: 0 },
    hospitalCharge: { type: Number, default: 0 },
    refundableFee:  { type: Number, default: 0 },
    totalAmount:    { type: Number, default: 0 }
  },

  isRefundableBooking: { type: Boolean, default: false },

  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'waived', 'refunded'],
    default: 'pending'
  },
  paidAt:        Date,
  paymentMethod: { type: String, enum: ['cash', 'card', 'online', 'waived'], default: 'cash' },

  // ── Refund Workflow ───────────────────────────────────────────
  refund: {
    status: {
      type: String,
      enum: ['none', 'requested', 'doctor_approved', 'completed', 'rejected'],
      default: 'none'
    },
    reason:          String,                       // Patient's reason for refund
    requestedAt:     Date,
    requestedBy:     String,                       // staff user name
    doctorApprovedAt: Date,
    doctorApprovedBy: String,                      // doctor name
    completedAt:     Date,
    completedBy:     String,                       // staff who processed refund
    rejectedAt:      Date,
    rejectedBy:      String,
    rejectionReason: String,
    refundAmount:    { type: Number, default: 0 }, // doctor fee amount refunded
    notes:           String,
  },

  // ── Timestamps ───────────────────────────────────────────────
  arrivedAt:              Date,
  consultationStartedAt:  Date,
  consultationEndedAt:    Date,

  bookedBy: {
    type: String,
    enum: ['patient', 'staff', 'admin'],
    default: 'patient'
  },

  // Token for guest tracking link
  guestToken: String,

  // WhatsApp notification tracking
  whatsapp: {
    confirmationSent: { type: Boolean, default: false },
    turnAlertSent:    { type: Boolean, default: false }
  }

}, { timestamps: true });

appointmentSchema.index({ hospitalId: 1, doctor: 1, appointmentDate: 1 });
appointmentSchema.index({ hospitalId: 1, appointmentDate: 1 });
appointmentSchema.index({ guestToken: 1 });

module.exports = mongoose.model('Appointment', appointmentSchema);
