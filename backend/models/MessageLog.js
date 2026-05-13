/**
 * MESSAGE LOG MODEL
 * =================
 * Tracks all outgoing SMS and WhatsApp messages for debugging and accountability.
 */
const mongoose = require('mongoose');

const messageLogSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    index: true
  },
  type: {
    type: String,
    enum: ['sms', 'whatsapp'],
    required: true,
    index: true
  },
  recipient: {
    type: String,
    required: true,
    index: true
  },
  message: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['sent', 'failed', 'pending', 'skipped'],
    default: 'sent',
    index: true
  },
  provider: String,        // 'textlk', 'twilio'
  providerResponse: mongoose.Schema.Types.Mixed,
  error: String,
  metadata: mongoose.Schema.Types.Mixed // e.g. { doctorName, templateType }
}, { timestamps: true });

// Auto-delete logs older than 30 days to keep DB clean
messageLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('MessageLog', messageLogSchema);
