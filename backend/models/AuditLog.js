/**
 * AUDIT LOG MODEL
 * ===============
 * Tracks critical changes in the system for accountability.
 * Scoped to hospital level.
 */
const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  userName: String,      // Redundant for performance
  userRole: String,

  action: {
    type: String,
    required: true       // e.g., "UPDATE_DOCTOR_SESSION", "DELETE_BOOKING"
  },
  targetType: String,    // e.g., "Doctor", "Appointment"
  targetId:   mongoose.Schema.Types.ObjectId,
  targetName: String,

  description: String,   // Human-readable summary of what changed

  oldValues: mongoose.Schema.Types.Mixed,
  newValues: mongoose.Schema.Types.Mixed,

  ipAddress: String,
  userAgent: String,
  metadata:  mongoose.Schema.Types.Mixed

}, { timestamps: true });

// Index for fast audit lookups
auditLogSchema.index({ hospitalId: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
