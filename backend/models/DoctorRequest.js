const mongoose = require('mongoose');

const doctorRequestSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true, index: true },
  doctorId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true, index: true },
  
  type: {
    type: String,
    enum: ['cancel', 'reschedule'],
    required: true
  },
  
  // Target session
  date: { type: Date, required: true },
  sessionId: String,
  sessionLabel: String,
  
  // If rescheduling
  proposedDate: Date,
  proposedTime: String,
  
  reason: String,
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled'],
    default: 'pending'
  },
  
  staffNotes: String,
  
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }

}, { timestamps: true });

module.exports = mongoose.model('DoctorRequest', doctorRequestSchema);
