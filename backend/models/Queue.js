const mongoose = require('mongoose');

const queueSchema = new mongoose.Schema({
  hospitalId:          { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  doctor:              { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  date:                { type: Date, required: true },
  currentNumber:       { type: Number, default: 0 },
  lastAssignedNumber:  { type: Number, default: 0 },
  sessionId:           String, // unique label or ID from doctor.sessions
  isActive:            { type: Boolean, default: true },
  announcement:        { type: String, default: '' }
}, { timestamps: true });

queueSchema.index({ hospitalId: 1, doctor: 1, date: 1, sessionId: 1 }, { unique: true });

module.exports = mongoose.model('Queue', queueSchema);
