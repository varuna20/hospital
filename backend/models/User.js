/**
 * USER MODEL
 * ==========
 * Handles all staff accounts: superadmin, admin, staff, doctor
 *
 * ROLES:
 *  superadmin  — No hospitalId, manages everything
 *  admin       — Hospital admin, hospitalId required
 *  staff       — Reception staff, hospitalId required
 *  doctor      — Doctor user account, hospitalId required
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name:  { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: 6, select: false },
  phone: { type: String, trim: true },

  role: {
    type: String,
    enum: ['superadmin', 'admin', 'staff', 'doctor'],
    required: true
  },

  // Every non-superadmin user belongs to ONE hospital
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: function() { return this.role !== 'superadmin'; }
  },

  // For doctor role — link to Doctor profile with full details
  doctorProfile: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor'
  },

  isActive:  { type: Boolean, default: true },
  lastLogin: Date

}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
