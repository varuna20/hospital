/**
 * AUTH MIDDLEWARE — Tenant-isolated
 * ===================================
 * Every hospital's data is completely isolated.
 * Staff/admin/doctor can ONLY access their own hospital's data.
 * Super admin can access all.
 */
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');
const Patient  = require('../models/Patient');

// ── Verify JWT token ───────────────────────────────────────────────
const protect = async (req, res, next) => {
  try {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer '))
      return res.status(401).json({ success: false, message: 'Not authorised — no token' });

    const token = auth.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check User collection first (staff/doctor/admin/superadmin)
    let user = await User.findById(decoded.id)
      .populate('hospitalId', 'name shortName slug theme logo logoUrl isActive payment queueSettings whatsapp')
      .populate('doctorProfile');

    if (user) {
      if (!user.isActive)
        return res.status(401).json({ success: false, message: 'Account not found or disabled' });
      if (user.role !== 'superadmin' && user.hospitalId && !user.hospitalId.isActive)
        return res.status(403).json({ success: false, message: 'Hospital account is disabled' });
      req.user = user;
      return next();
    }

    // Fall back to Patient collection
    const patient = await Patient.findById(decoded.id).populate('hospitalId', 'name shortName slug theme logo isActive');
    if (patient) {
      req.user = { ...patient.toObject(), role: 'patient', _id: patient._id };
      return next();
    }

    return res.status(401).json({ success: false, message: 'Account not found or disabled' });
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
};

// ── Role check ─────────────────────────────────────────────────────
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: `Access denied — requires: ${roles.join(', ')}` });
  next();
};

// ── Super admin only ───────────────────────────────────────────────
const superAdminOnly = (req, res, next) => {
  if (req.user.role !== 'superadmin')
    return res.status(403).json({ success: false, message: 'Super admin access required' });
  next();
};

// ── Tenant scope guard ─────────────────────────────────────────────
// Ensures non-superadmin users can only access their own hospital's data
const tenantScope = (req, res, next) => {
  if (req.user.role === 'superadmin') return next();

  const userHid = req.user.hospitalId?._id?.toString() || req.user.hospitalId?.toString();
  if (!userHid)
    return res.status(403).json({ success: false, message: 'No hospital assigned to this account' });

  // Inject hospitalId into query and body so routes always use the correct hospital
  req.tenantHospitalId = userHid;

  // Override any hospitalId in query/body to prevent spoofing
  if (req.query.hospitalId && req.query.hospitalId !== userHid) {
    return res.status(403).json({ success: false, message: 'Cross-hospital access denied' });
  }
  if (req.body.hospitalId && req.body.hospitalId !== userHid) {
    return res.status(403).json({ success: false, message: 'Cross-hospital access denied' });
  }

  // Auto-inject correct hospitalId
  req.query.hospitalId = userHid;

  next();
};

// ── Safe hospitalId extractor ─────────────────────────────────────
// Use this in every route instead of raw req.query.hospitalId
const getHospitalId = (req) => {
  if (req.user.role === 'superadmin') return req.query.hospitalId || req.body.hospitalId || null;
  const hid = req.user.hospitalId;
  if (!hid) return null;
  return hid._id ? hid._id.toString() : hid.toString();
};

module.exports = { protect, authorize, superAdminOnly, tenantScope, getHospitalId };
