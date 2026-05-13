/**
 * SUPER ADMIN ROUTES
 * ==================
 * Only accessible by role=superadmin
 *
 * POST /api/superadmin/hospitals          - Create hospital
 * GET  /api/superadmin/hospitals          - List all hospitals
 * PUT  /api/superadmin/hospitals/:id      - Update hospital (theme, info)
 * POST /api/superadmin/hospitals/:id/admin - Add admin to hospital
 * GET  /api/superadmin/stats              - System-wide stats
 * PUT  /api/superadmin/hospitals/:id/toggle - Enable/disable hospital
 */

const express  = require('express');
const router   = express.Router();
const Hospital = require('../models/Hospital');
const User     = require('../models/User');
const Doctor   = require('../models/Doctor');
const Patient  = require('../models/Patient');
const Appointment = require('../models/Appointment');
const { protect, superAdminOnly } = require('../middleware/auth');

const { SystemSettings } = require('../models/SystemSettings');
const multer   = require('multer');
const path     = require('path');
const fs       = require('fs');

// All routes require superadmin
router.use(protect, superAdminOnly);

// ── Multer for Global Logo ───────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/branding');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, 'global_logo_' + Date.now() + path.extname(file.originalname));
  }
});

const logoUpload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Invalid file type'));
  }
});

// ── Global Logo Upload ───────────────────────────────────────────
router.post('/system/logo', logoUpload.single('logo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
    const logoPath = '/uploads/branding/' + req.file.filename;
    
    let settings = await SystemSettings.findOne();
    if (!settings) settings = new SystemSettings();
    
    settings.branding = settings.branding || {};
    settings.branding.logo = logoPath;
    await settings.save();
    
    res.json({ success: true, logo: logoPath });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Update Global Branding ────────────────────────────────────────
router.put('/system/branding', async (req, res) => {
  try {
    let settings = await SystemSettings.findOne();
    if (!settings) settings = new SystemSettings();
    
    settings.branding = { ...settings.branding, ...req.body };
    await settings.save();
    
    res.json({ success: true, branding: settings.branding });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── System Stats ──────────────────────────────────────────────────
router.get('/stats', async (req, res) => {
  try {
    const [hospitals, doctors, patients, appointments] = await Promise.all([
      Hospital.countDocuments(),
      Doctor.countDocuments(),
      Patient.countDocuments(),
      Appointment.countDocuments()
    ]);

    // Revenue across all hospitals
    const revenueResult = await Appointment.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: {
        _id: null,
        totalHospitalRevenue: { $sum: '$fees.hospitalCharge' },
        totalDoctorRevenue:   { $sum: '$fees.doctorFee' },
        total:                { $sum: '$fees.totalAmount' }
      }}
    ]);

    res.json({
      success: true,
      stats: {
        hospitals, doctors, patients, appointments,
        revenue: revenueResult[0] || { total: 0, totalHospitalRevenue: 0, totalDoctorRevenue: 0 }
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── List All Hospitals ─────────────────────────────────────────────
router.get('/hospitals', async (req, res) => {
  try {
    const hospitals = await Hospital.find().sort({ createdAt: -1 });

    // Enrich with counts
    const enriched = await Promise.all(hospitals.map(async h => {
      const [doctors, patients, todayApts] = await Promise.all([
        Doctor.countDocuments({ hospitalId: h._id }),
        Patient.countDocuments({ hospitalId: h._id }),
        Appointment.countDocuments({
          hospitalId: h._id,
          appointmentDate: {
            $gte: new Date(new Date().setHours(0,0,0,0)),
            $lte: new Date(new Date().setHours(23,59,59,999))
          }
        })
      ]);
      return { ...h.toObject(), _counts: { doctors, patients, todayApts } };
    }));

    res.json({ success: true, hospitals: enriched });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Create Hospital ────────────────────────────────────────────────
router.post('/hospitals', async (req, res) => {
  try {
    const hospital = await Hospital.create(req.body);
    res.status(201).json({ success: true, hospital });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Update Hospital (theme, info, settings) ────────────────────────
router.put('/hospitals/:id', async (req, res) => {
  try {
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    res.json({ success: true, hospital });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Toggle Hospital Active ─────────────────────────────────────────
router.put('/hospitals/:id/toggle', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.id);
    hospital.isActive = !hospital.isActive;
    await hospital.save();
    res.json({ success: true, isActive: hospital.isActive });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Add Admin to Hospital ──────────────────────────────────────────
router.post('/hospitals/:id/admin', async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;
    const hospital = await Hospital.findById(req.params.id);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });

    const admin = await User.create({
      name, email, password, phone,
      role: 'admin',
      hospitalId: req.params.id
    });

    res.status(201).json({ success: true, admin: { ...admin.toObject(), password: undefined } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Get Hospital Admins ────────────────────────────────────────────
router.get('/hospitals/:id/admins', async (req, res) => {
  try {
    const admins = await User.find({ hospitalId: req.params.id, role: 'admin' }).select('-password');
    res.json({ success: true, admins });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Global Revenue Report ──────────────────────────────────────────
router.get('/revenue', async (req, res) => {
  try {
    const { period = 'month', year, month } = req.query;
    const now = new Date();
    let start, end;
    if (period === 'day') {
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end   = new Date(start.getTime() + 86400000);
    } else if (period === 'year') {
      const y = year ? Number(year) : now.getFullYear();
      start = new Date(y, 0, 1);
      end   = new Date(y + 1, 0, 1);
    } else { // month (default)
      const m = month ? Number(month) - 1 : now.getMonth();
      const y = year  ? Number(year)      : now.getFullYear();
      start = new Date(y, m, 1);
      end   = new Date(y, m + 1, 1);
    }

    // Revenue by hospital + commission calculation
    const byHospital = await Appointment.aggregate([
      { $match: { paymentStatus: 'paid', appointmentDate: { $gte: start, $lt: end } } },
      { $group: {
        _id:             '$hospitalId',
        hospitalRevenue: { $sum: '$fees.hospitalCharge' },
        doctorRevenue:   { $sum: '$fees.doctorFee' },
        totalRevenue:    { $sum: '$fees.totalAmount' },
        appointments:    { $sum: 1 }
      }},
      { $lookup: { from: 'hospitals', localField: '_id', foreignField: '_id', as: 'hospital' } },
      { $unwind: '$hospital' }
    ]);

    // Add commission and plan fee per hospital
    const Hospital = require('../models/Hospital');
    const { SubscriptionPlan } = require('../models/SystemSettings');
    const plans = await SubscriptionPlan.find({});
    const planMap = {};
    plans.forEach(p => { planMap[p.code] = p; });

    let totalCommission = 0;
    let totalPlanFees   = 0;

    const enriched = byHospital.map(row => {
      const plan = planMap[row.hospital?.subscriptionPlan];
      const commPct  = plan?.commissionPercent || row.hospital?.billing?.commissionPercent || 0;
      const commission = (row.hospitalRevenue * commPct) / 100;
      const planFee    = plan?.price || 0;
      totalCommission += commission;
      totalPlanFees   += planFee;
      return {
        ...row,
        hospitalName:    row.hospital?.name || 'Unknown',
        subscriptionPlan: row.hospital?.subscriptionPlan || 'trial',
        commissionPercent: commPct,
        commission,
        planFee,
        platformRevenue: commission + planFee
      };
    });

    // Also add hospitals that have no appointments (still owe plan fee)
    const allHospitals = await Hospital.find({ isActive: true });
    const coveredIds = new Set(enriched.map(r => r._id.toString()));
    const noAppointmentHospitals = allHospitals
      .filter(h => !coveredIds.has(h._id.toString()))
      .map(h => {
        const plan = planMap[h.subscriptionPlan];
        const planFee = plan?.price || 0;
        totalPlanFees += planFee;
        return {
          _id: h._id, hospitalName: h.name,
          hospitalRevenue: 0, doctorRevenue: 0, totalRevenue: 0, appointments: 0,
          subscriptionPlan: h.subscriptionPlan || 'trial',
          commissionPercent: plan?.commissionPercent || 0,
          commission: 0, planFee, platformRevenue: planFee
        };
      });

    const allRows = [...enriched, ...noAppointmentHospitals].sort((a,b) => b.totalRevenue - a.totalRevenue);

    res.json({
      success: true,
      byHospital: allRows,
      period,
      summary: {
        totalHospitalRevenue: allRows.reduce((s,r) => s + r.hospitalRevenue, 0),
        totalDoctorRevenue:   allRows.reduce((s,r) => s + r.doctorRevenue, 0),
        totalRevenue:         allRows.reduce((s,r) => s + r.totalRevenue, 0),
        totalCommission,
        totalPlanFees,
        totalPlatformRevenue: totalCommission + totalPlanFees,
        totalAppointments:    allRows.reduce((s,r) => s + r.appointments, 0),
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Message Logs (SMS/WhatsApp) ───────────────────────────────────
router.get('/message-logs', async (req, res) => {
  try {
    const { type, status, hospitalId, limit = 100, page = 1 } = req.query;
    const MessageLog = require('../models/MessageLog');
    
    const query = {};
    if (type) query.type = type;
    if (status) query.status = status;
    if (hospitalId) query.hospitalId = hospitalId;

    const logs = await MessageLog.find(query)
      .sort({ createdAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))
      .populate('hospitalId', 'name shortName');

    const total = await MessageLog.countDocuments(query);

    res.json({ success: true, logs, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
