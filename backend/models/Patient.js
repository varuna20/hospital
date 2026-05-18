const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const patientSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
    index: true
  },
  name:   { type: String, required: true, trim: true },
  phone:  { type: String, required: true, trim: true },
  email:  { type: String, lowercase: true, trim: true, sparse: true },
  password: { type: String, select: false },
  isGuest:  { type: Boolean, default: true },
  dateOfBirth: Date,
  gender:      { type: String, enum: ['male', 'female', 'other'] },
  address:     String,
  bloodGroup:  String,
  notes:       String,
  isActive:    { type: Boolean, default: true },
  
  // -- Auth & Profile Features --
  googleId:    { type: String, sparse: true, index: true },
  avatar:      { type: String },
  otpCode:     { type: String, select: false },
  otpExpires:  { type: Date, select: false },
  isPhoneVerified: { type: Boolean, default: false },

  // Opt-in for WhatsApp notifications
  whatsappOptIn: { type: Boolean, default: true },

  // Family members under the same login
  familyMembers: [{
    name: { type: String, required: true },
    relationship: { type: String, required: true },
    phone: String,
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] }
  }]
}, { timestamps: true });

patientSchema.pre('save', async function(next) {
  if (!this.isModified('password') || !this.password) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

patientSchema.methods.comparePassword = async function(p) {
  return bcrypt.compare(p, this.password);
};

patientSchema.index({ hospitalId: 1, phone: 1 });

module.exports = mongoose.model('Patient', patientSchema);
