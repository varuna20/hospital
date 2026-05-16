const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  role: {
    type: String,
    enum: ['admin', 'staff', 'doctor', 'superadmin'],
    required: true
  },
  title: String,
  message: String,
  type: {
    type: String,
    enum: ['doctor_request', 'system', 'booking'],
    default: 'system'
  },
  isRead: {
    type: Boolean,
    default: false
  },
  link: String,
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Notification', notificationSchema);
