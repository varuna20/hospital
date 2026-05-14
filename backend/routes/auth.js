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

// ── Patient OTP Auth ─────────────────────────────────────────────
router.post('/patient/request-otp', async (req, res) => {
  try {
    let { phone, hospitalId } = req.body;
    if (!phone || !hospitalId) return res.status(400).json({ success: false, message: 'Phone and hospital required' });

    phone = phone.replace(/[^0-9+]/g, '');

    let patient = await Patient.findOne({ phone, hospitalId });
    if (!patient) {
      // First time? Create as guest until verified
      patient = await Patient.create({
        hospitalId, phone, name: 'Patient', isGuest: true
      });
    }

    const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
    patient.otpCode = await bcrypt.hash(otpCode, 10);
    patient.otpExpires = new Date(Date.now() + 10 * 60000); // 10 mins
    await patient.save();

    const { sendHospitalSms } = require('../utils/sms');
    const hospital = await Hospital.findById(hospitalId);
    
    await sendHospitalSms({
      hospitalId,
      to: phone,
      templateType: 'custom',
      customText: `Your ${hospital?.name || 'Hospital'} verification code is: ${otpCode}. It expires in 10 minutes.`
    });

    res.json({ success: true, message: 'OTP sent to mobile' });
  } catch (err) {
    console.error('OTP Request Error:', err);
    res.status(500).json({ success: false, message: 'Failed to send OTP' });
  }
});

router.post('/patient/verify-otp', async (req, res) => {
  try {
    const { phone, hospitalId, otpCode, name } = req.body;
    const patient = await Patient.findOne({ phone: phone.replace(/[^0-9+]/g, ''), hospitalId }).select('+otpCode +otpExpires');
    
    if (!patient || !patient.otpCode) return res.status(400).json({ success: false, message: 'Invalid request' });
    if (new Date() > patient.otpExpires) return res.status(400).json({ success: false, message: 'OTP expired' });

    const isValid = await bcrypt.compare(otpCode, patient.otpCode);
    if (!isValid) return res.status(400).json({ success: false, message: 'Invalid OTP' });

    patient.isPhoneVerified = true;
    patient.isGuest = false; // Upgrade from guest
    if (name && patient.name === 'Patient') patient.name = name;
    patient.otpCode = undefined;
    patient.otpExpires = undefined;
    await patient.save();

    const token = generateToken(patient._id);
    res.json({ success: true, token, patient: { id: patient._id, name: patient.name, phone: patient.phone, role: 'patient' } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Verification failed' });
  }
});

// ── Patient Login (Password) ─────────────────────────────────────
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

// ── Patient Google SSO ───────────────────────────────────────────
router.post('/patient/google', async (req, res) => {
  try {
    const { token, hospitalId, email, name, googleId, picture } = req.body;
    // In production, verify 'token' using google-auth-library here.
    // Since Client ID is pending, we mock the verification and trust the frontend payload for now.

    if (!email || !hospitalId) return res.status(400).json({ success: false, message: 'Invalid payload' });

    let patient = await Patient.findOne({ email, hospitalId });
    if (!patient) {
      // First time SSO login -> register them
      patient = await Patient.create({
        hospitalId, name, email, googleId, avatar: picture, isGuest: false, phone: 'Pending'
      });
    } else {
      // Link Google ID if not present
      if (!patient.googleId) patient.googleId = googleId;
      if (!patient.avatar) patient.avatar = picture;
      patient.isGuest = false;
      await patient.save();
    }

    const jwtToken = generateToken(patient._id);
    res.json({ success: true, token: jwtToken, patient: { id: patient._id, name: patient.name, email: patient.email, role: 'patient', avatar: patient.avatar } });
  } catch (err) {
    console.error('Google SSO Error:', err);
    res.status(500).json({ success: false, message: 'SSO login failed' });
  }
});

// ── Update Patient Profile ───────────────────────────────────────
router.put('/patient/profile', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ success: false, message: 'Patients only' });
    const { name, phone, address, avatar } = req.body;
    
    const patient = await Patient.findById(req.user._id);
    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    if (name) patient.name = name;
    if (phone) patient.phone = phone;
    if (address !== undefined) patient.address = address;
    if (avatar) patient.avatar = avatar;

    await patient.save();
    res.json({ success: true, message: 'Profile updated' });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update profile' });
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
