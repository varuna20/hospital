/**
 * AUTH ROUTES
 * ===========
 * POST /api/auth/login              - Login (all roles)
 * POST /api/auth/patient-login      - Patient login
 * POST /api/auth/patient-register   - Patient register
 * GET  /api/auth/me                 - Current user + hospital info
 */

const express  = require('express');
const router   = express.Router();
const User     = require('../models/User');
const Patient  = require('../models/Patient');
const Hospital = require('../models/Hospital');
const { generateToken, protect } = require('../middleware/auth');

// ── Staff / Doctor / Admin / SuperAdmin Login ──────────────────
router.post('/login', async (req, res) => {
  try {
    const { email, password, hospitalSlug, hospitalId } = req.body;
    if (!email || !password)
      return res.status(400).json({ success: false, message: 'Email and password required' });

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+password')
      .populate('hospitalId', 'name shortName theme slug logo logoUrl isActive payment queueSettings whatsapp')
      .populate('doctorProfile');

    if (!user || !(await user.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid email or password' });

    if (!user.isActive)
      return res.status(403).json({ success: false, message: 'Account is disabled. Contact your administrator.' });

    // ── TENANT ISOLATION ─────────────────────────────────────────
    // If logging in via a hospital-specific page (slug or hospitalId provided),
    // verify the user belongs to THAT hospital (super admin can login anywhere)
    if (user.role !== 'superadmin') {
      const userHospitalId = user.hospitalId?._id?.toString() || user.hospitalId?.toString();

      if (hospitalSlug) {
        // Verify the hospital slug matches the user's hospital
        const userSlug = user.hospitalId?.slug;
        if (!userSlug || userSlug !== hospitalSlug) {
          return res.status(403).json({
            success: false,
            message: "You are not registered with this hospital. Please use your hospital's login page."
          });
        }
      }

      if (hospitalId && userHospitalId && userHospitalId !== hospitalId) {
        return res.status(403).json({
          success: false,
          message: 'Access denied. You do not belong to this hospital.'
        });
      }

      // Check hospital is active
      if (user.hospitalId && !user.hospitalId.isActive) {
        return res.status(403).json({ success: false, message: 'This hospital account is currently disabled.' });
      }
    }

    const token = require('jsonwebtoken').sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE || '7d' }
    );

    const hospitalData = user.hospitalId ? {
      ...user.hospitalId.toObject(),
      _id: user.hospitalId._id,
    } : null;

    res.json({
      success: true,
      token,
      user: {
        id:            user._id,
        name:          user.name,
        email:         user.email,
        role:          user.role,
        phone:         user.phone,
        hospital:      hospitalData,
        doctorProfile: user.doctorProfile,
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login' });
  }
});
// ── Patient Registration ────────────────────────────────────────
router.post('/patient-register', async (req, res) => {
  try {
    const { name, phone, email, password, hospitalId, gender, dateOfBirth } = req.body;
    if (!name || !phone || !hospitalId)
      return res.status(400).json({ success: false, message: 'Name, phone, hospitalId required' });

    const existing = email ? await Patient.findOne({ email, hospitalId }) : null;
    if (existing)
      return res.status(400).json({ success: false, message: 'Email already registered' });

    const patient = await Patient.create({
      hospitalId, name, phone, email, password,
      gender, dateOfBirth, isGuest: false
    });

    const token = generateToken(patient._id);
    res.status(201).json({ success: true, token, patient: { id: patient._id, name: patient.name, phone: patient.phone, role: 'patient' } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Patient Login ────────────────────────────────────────────────
router.post('/patient-login', async (req, res) => {
  try {
    const { email, password, hospitalId } = req.body;
    const patient = await Patient.findOne({ email, hospitalId, isGuest: false }).select('+password');
    if (!patient || !(await patient.comparePassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid credentials' });

    const token = generateToken(patient._id);
    res.json({ success: true, token, patient: { id: patient._id, name: patient.name, role: 'patient' } });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Current User ─────────────────────────────────────────────────
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('hospitalId', 'name theme slug logo logoUrl payment queueSettings whatsapp clinicHours')
      .populate('doctorProfile');
    res.json({ success: true, user: { ...user.toObject(), password: undefined } });
  } catch {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// ── Get hospital by slug (public - for dedicated login page) ──────
router.get('/hospital/:slug', async (req, res) => {
  try {
    const hospital = await require('../models/Hospital').findOne(
      { slug: req.params.slug, isActive: true },
      'name shortName slug logo logoUrl theme city phone'
    );
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    res.json({ success: true, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});


module.exports = router;
