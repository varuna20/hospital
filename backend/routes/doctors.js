/**
 * DOCTOR ROUTES
 * =============
 * GET  /api/doctors                   - List doctors (scoped to hospital)
 * POST /api/doctors                   - Create (admin)
 * PUT  /api/doctors/:id               - Full profile edit (admin)
 * PUT  /api/doctors/:id/session       - Update session times (staff/admin)
 * PUT  /api/doctors/:id/arrival       - Mark arrived (staff)
 * GET  /api/doctors/:id/stats         - Doctor stats
 * POST /api/doctors/:id/notify        - Send WhatsApp summary (staff)
 */

const express  = require('express');
const router   = express.Router();
const Doctor   = require('../models/Doctor');
const User     = require('../models/User');
const Appointment = require('../models/Appointment');
const DoctorRequest = require('../models/DoctorRequest');
const Hospital = require('../models/Hospital');
const { protect, authorize } = require('../middleware/auth');
const { sendDoctorSessionSummary, sendDoctorArrival } = require('../utils/whatsapp');
const { sendHospitalSms, templates } = require('../utils/sms');
const moment = require('moment');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Photo upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/doctors');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => cb(null, `doc_${req.params.id}_${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({ storage, limits: { fileSize: 3 * 1024 * 1024 } });

// ── Scope helper: get hospitalId from user or query ───────────────
function getHospitalId(req) {
  if (req.user.role === 'superadmin') return req.query.hospitalId || req.body.hospitalId;
  const hid = req.user.hospitalId;
  if (!hid) return null;
  // hospitalId may be a populated object {_id, name,...} or a plain ObjectId/string
  return hid._id ? hid._id.toString() : hid.toString();
}

// ── List Doctors (public within hospital) ─────────────────────────
// Optional auth middleware - protect if no hospitalId in query
const optionalProtect = async (req, res, next) => {
  if (req.query.hospitalId) return next(); // public access with hospitalId
  return protect(req, res, next);           // must be logged in otherwise
};

router.get('/', optionalProtect, async (req, res) => {
  try {
    let hospitalId = req.query.hospitalId;
    let query = { isActive: true };

    if (!hospitalId && req.user) {
      const hid = req.user.hospitalId;
      hospitalId = hid?._id ? hid._id.toString() : hid?.toString();
    }

    if (hospitalId) query.hospitalId = hospitalId;

    const doctors = await Doctor.find(query)
      .populate('hospitalId', 'name logo city')
      .sort({ name: 1 });

    res.json({ success: true, doctors });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Create Doctor ─────────────────────────────────────────────────
router.post('/', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const {
      name, email, phone, password, specialization, qualifications,
      experience, bio, room, language, fees, sessions
    } = req.body;

    // Create user account
    const user = await User.create({
      name, email,
      password: password || 'Doctor@123',
      phone, role: 'doctor', hospitalId
    });

    // Create doctor profile
    const doctor = await Doctor.create({
      hospitalId, userId: user._id,
      name, email, phone, specialization,
      qualifications: Array.isArray(qualifications) ? qualifications : (qualifications || '').split(',').map(q => q.trim()).filter(Boolean),
      experience, bio, room, language,
      fees: {
        doctorFee:      fees?.doctorFee || 0,
        hospitalCharge: fees?.hospitalCharge || 0,
        totalFee:       (fees?.doctorFee || 0) + (fees?.hospitalCharge || 0)
      },
      sessions: sessions || []
    });

    user.doctorProfile = doctor._id;
    await user.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'CREATE_DOCTOR_PROFILE',
      targetType: 'Doctor',
      targetId: doctor._id,
      targetName: doctor.name,
      newValues: { email, specialization, phone }
    });

    res.status(201).json({ success: true, doctor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Full Profile Edit (admin) ──────────────────────────────────────

// ── Single doctor (full profile for edit form) ────────────────────
router.get('/:id', protect, async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, doctor });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

router.put('/:id', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const {
      name, email, phone, specialization, qualifications,
      experience, bio, room, language, fees, isActive, sessions
    } = req.body;

    const update = {
      name, email, phone, specialization, experience, bio, room, language, isActive,
      qualifications: Array.isArray(qualifications) ? qualifications
        : (qualifications || '').split(',').map(q => q.trim()).filter(Boolean)
    };

    if (sessions) update.sessions = sessions;

    if (fees) {
      update['fees.doctorFee']      = Number(fees.doctorFee || 0);
      update['fees.hospitalCharge'] = Number(fees.hospitalCharge || 0);
      update['fees.totalFee']       = Number(fees.doctorFee || 0) + Number(fees.hospitalCharge || 0);
    }

    const doctorBefore = await Doctor.findById(req.params.id);
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );

    // Audit log if sessions changed
    if (sessions && JSON.stringify(doctorBefore.sessions) !== JSON.stringify(doctor.sessions)) {
      const { logAudit } = require('../utils/audit');
      await logAudit(req, {
        action: 'UPDATE_DOCTOR_SCHEDULE',
        targetType: 'Doctor',
        targetId: doctor._id,
        targetName: doctor.name,
        oldValues: { sessions: doctorBefore.sessions },
        newValues: { sessions: doctor.sessions }
      });
    }

    // Also update name in User account
    if (name && doctor?.userId) {
      await User.findByIdAndUpdate(doctor.userId, { name });
    }

    res.json({ success: true, doctor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Upload Doctor Photo ────────────────────────────────────────────
router.post('/:id/photo', protect, authorize('admin', 'superadmin'),
  upload.single('photo'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: 'No file' });
    const photoPath = `/uploads/doctors/${req.file.filename}`;
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, { profileImage: photoPath }, { new: true });

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'UPDATE_DOCTOR_PHOTO',
      targetType: 'Doctor',
      targetId: doctor._id,
      targetName: doctor.name,
      newValues: { photo: photoPath }
    });

    res.json({ success: true, profileImage: photoPath, doctor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Update Session Times (staff/admin) ────────────────────────────
router.put('/:id/session', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const {
      sessionStart, sessionEnd, sessionNotes,
      sessions  // full schedule array update
    } = req.body;

    const update = {};

    // Today's session override
    if (sessionStart) update['todayStatus.sessionStart'] = sessionStart;
    if (sessionEnd)   update['todayStatus.sessionEnd']   = sessionEnd;
    if (sessionNotes) update['todayStatus.sessionNotes'] = sessionNotes;

    // Full weekly schedule update
    if (sessions) update.sessions = sessions;

    const doctorBefore = await Doctor.findById(req.params.id);
    const doctor = await Doctor.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'UPDATE_DOCTOR_SESSION',
      targetType: 'Doctor',
      targetId: doctor._id,
      targetName: doctor.name,
      oldValues: doctorBefore.toObject(),
      newValues: doctor.toObject()
    });

    // Emit via socket
    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${doctor.hospitalId}`).emit('session_updated', {
        doctorId: doctor._id,
        sessionStart: doctor.todayStatus.sessionStart,
        sessionEnd:   doctor.todayStatus.sessionEnd
      });
    }

    res.json({ success: true, doctor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Mark Doctor Arrival ────────────────────────────────────────────
router.put('/:id/arrival', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { isArrived, expectedArrivalTime } = req.body;
    const doctor = await Doctor.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          'todayStatus.isArrived':           isArrived,
          'todayStatus.arrivalTime':         isArrived ? new Date() : null,
          'todayStatus.expectedArrivalTime': expectedArrivalTime || null
        }
      },
      { new: true }
    );

    // If doctor arrived, notify waiting patients (WhatsApp & SMS)
    if (isArrived) {
      const hospital = await Hospital.findById(doctor.hospitalId);
      const { SystemSettings } = require('../models/SystemSettings');
      const settings = await SystemSettings.findOne();

      const today = moment().startOf('day').toDate();
      const todayEnd = moment().endOf('day').toDate();
      const waitingPatients = await Appointment
        .find({ doctor: req.params.id, appointmentDate: { $gte: today, $lte: todayEnd }, status: { $in: ['booked', 'arrived'] } })
        .populate('patient', 'name phone whatsappOptIn');

      for (const apt of waitingPatients) {
        // WhatsApp notification
        if (hospital?.whatsapp?.enabled && hospital.whatsapp.notifyDoctor && apt.patient?.whatsappOptIn !== false) {
          sendDoctorArrival(hospital, apt.patient, doctor).catch(() => {});
        }

        // SMS notification
        const smsEnabled = hospital?.sms?.enabled || settings?.sms?.enabled;
        if (smsEnabled && hospital?.sms?.notifyArrival !== false) {
          const arrivalTime = moment(doctor.todayStatus.arrivalTime || new Date()).format('hh:mm A');
          
          // Fallback for missing tokens
          if (!apt.guestToken) {
            const crypto = require('crypto');
            apt.guestToken = crypto.randomBytes(20).toString('hex');
            await apt.save();
          }

          const trackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/queue-status/${apt.guestToken}`;
          
          sendHospitalSms({
            hospitalId: hospital._id,
            to: apt.patient?.phone,
            templateType: 'arrival',
            templateData: {
              hospitalName: hospital.shortName || hospital.name,
              doctorName:   doctor.name,
              patientName:  apt.patient?.name || 'Patient',
              arrivalTime:  arrivalTime,
              queueNumber:  apt.queueNumber,
              trackUrl:     trackUrl
            }
          }).catch(() => {});
        }
      }
    } else {
      // If doctor LEFT, send session summary to doctor
      const hospital = await Hospital.findById(doctor.hospitalId);
      if (hospital?.whatsapp?.enabled) {
        const today = moment().startOf('day').toDate();
        const todayEnd = moment().endOf('day').toDate();
        const appointments = await Appointment
          .find({ doctor: req.params.id, appointmentDate: { $gte: today, $lte: todayEnd } })
          .populate('patient', 'name phone');
        
        if (appointments.length > 0) {
          sendDoctorSessionSummary(hospital, doctor, appointments).catch(e => console.error('Summary error:', e));
          await Doctor.findByIdAndUpdate(req.params.id, { 'todayStatus.whatsappSummarysent': true });
        }
      }
    }

    const io = req.app.get('io');
    if (io) {
      io.to(`hospital_${doctor.hospitalId}`).emit('doctor_arrival', { doctorId: doctor._id, isArrived });
      io.to(`display_${doctor.hospitalId}`).emit('doctor_arrival', { doctorId: doctor._id, isArrived });
      io.to(`display_${doctor.hospitalId}_${doctor._id}`).emit('doctor_arrival', { doctorId: doctor._id, isArrived });
    }

    res.json({ success: true, doctor });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Send WhatsApp Session Summary to Doctor ────────────────────────
router.post('/:id/notify-session', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });

    const hospital = await Hospital.findById(doctor.hospitalId);
    if (!hospital?.whatsapp?.enabled)
      return res.status(400).json({ success: false, message: 'WhatsApp not enabled for this hospital' });

    const today = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    const appointments = await Appointment
      .find({ doctor: req.params.id, appointmentDate: { $gte: today, $lte: todayEnd } })
      .populate('patient', 'name phone');

    const result = await sendDoctorSessionSummary(hospital, doctor, appointments);

    if (result.sent) {
      await Doctor.findByIdAndUpdate(req.params.id, { 'todayStatus.whatsappSummarysent': true });
    }

    res.json({ success: result.sent, message: result.sent ? 'Summary sent!' : result.reason });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Doctor: Detailed Revenue Report for Charts ─────────────────────
router.get('/:id/revenue-report', protect, async (req, res) => {
  try {
    const doctorId = require('mongoose').Types.ObjectId.createFromHexString(req.params.id);
    const now = moment();
    
    // 1. Weekly (Last 7 days)
    const sevenDaysAgo = moment().subtract(6, 'days').startOf('day').toDate();
    const weeklyAgg = await Appointment.aggregate([
      { $match: { doctor: doctorId, appointmentDate: { $gte: sevenDaysAgo }, paymentStatus: 'paid' } },
      { $group: { 
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$appointmentDate" } }, 
        revenue: { $sum: '$fees.doctorFee' } 
      } },
      { $sort: { "_id": 1 } }
    ]);

    // 2. Monthly (Last 6 months)
    const sixMonthsAgo = moment().subtract(5, 'months').startOf('month').toDate();
    const monthlyAgg = await Appointment.aggregate([
      { $match: { doctor: doctorId, appointmentDate: { $gte: sixMonthsAgo }, paymentStatus: 'paid' } },
      { $group: { 
        _id: { $dateToString: { format: "%Y-%m", date: "$appointmentDate" } }, 
        revenue: { $sum: '$fees.doctorFee' } 
      } },
      { $sort: { "_id": 1 } }
    ]);

    // 3. Status Breakdown (Pie Chart)
    const statusAgg = await Appointment.aggregate([
      { $match: { doctor: doctorId, appointmentDate: { $gte: moment().subtract(30, 'days').toDate() } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      weekly: weeklyAgg.map(i => ({ name: moment(i._id).format('ddd'), revenue: i.revenue })),
      monthly: monthlyAgg.map(i => ({ name: moment(i._id).format('MMM'), revenue: i.revenue })),
      pie: statusAgg.map(i => ({ name: i._id, value: i.count }))
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Doctor Stats ───────────────────────────────────────────────────
router.get('/:id/stats', protect, async (req, res) => {
  try {
    const today      = moment().startOf('day').toDate();
    const monthStart = moment().startOf('month').toDate();

    const [todayAgg, monthCount, monthRevenue] = await Promise.all([
      Appointment.aggregate([
        { $match: { doctor: require('mongoose').Types.ObjectId.createFromHexString(req.params.id), appointmentDate: { $gte: today } } },
        { $group: { _id: '$status', count: { $sum: 1 },
          docRev: { $sum: '$fees.doctorFee' }, hospRev: { $sum: '$fees.hospitalCharge' } } }
      ]),
      Appointment.countDocuments({ doctor: req.params.id, appointmentDate: { $gte: monthStart }, status: 'completed' }),
      Appointment.aggregate([
        { $match: { doctor: require('mongoose').Types.ObjectId.createFromHexString(req.params.id),
            appointmentDate: { $gte: monthStart }, paymentStatus: 'paid' } },
        { $group: { _id: null, doctorRevenue: { $sum: '$fees.doctorFee' }, hospitalRevenue: { $sum: '$fees.hospitalCharge' } } }
      ])
    ]);

    const todayObj = {};
    todayAgg.forEach(s => { todayObj[s._id] = { count: s.count, docRev: s.docRev, hospRev: s.hospRev }; });

    res.json({
      success: true,
      today: {
        total:      Object.values(todayObj).reduce((a, s) => a + s.count, 0),
        completed:  todayObj.completed?.count || 0,
        absent:     todayObj.absent?.count    || 0,
        waiting:    (todayObj.booked?.count || 0) + (todayObj.arrived?.count || 0),
        inProgress: todayObj['in-progress']?.count || 0,
        todayDoctorRevenue: todayObj.completed?.docRev || 0
      },
      monthCompleted: monthCount,
      monthRevenue: monthRevenue[0] || { doctorRevenue: 0, hospitalRevenue: 0 }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Reset doctor password (admin) ─────────────────────────────────
router.put('/:id/reset-password', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    const doctor = await Doctor.findById(req.params.id).populate('userId');
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if (!doctor.userId)
      return res.status(400).json({ success: false, message: 'This doctor has no login account yet' });
    const user = await User.findById(doctor.userId._id || doctor.userId);
    if (!user) return res.status(404).json({ success: false, message: 'User account not found' });
    user.password = newPassword; // pre-save hook hashes it
    await user.save();
    res.json({ success: true, message: 'Password updated successfully' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Create login account for doctor (if not exists) ───────────────
router.post('/:id/create-login', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const { email, password } = req.body;
    const doctor = await Doctor.findById(req.params.id);
    if (!doctor) return res.status(404).json({ success: false, message: 'Doctor not found' });
    if (doctor.userId) return res.status(400).json({ success: false, message: 'Login already exists for this doctor' });
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'Email already in use' });
    const user = await User.create({
      name: doctor.name, email: email || doctor.email,
      password: password || 'Doctor@123', phone: doctor.phone,
      role: 'doctor', hospitalId: doctor.hospitalId
    });
    doctor.userId = user._id;
    doctor.email  = email || doctor.email;
    await doctor.save();
    await User.findByIdAndUpdate(user._id, { doctorProfile: doctor._id });
    res.status(201).json({ success: true, message: 'Login created', email: user.email });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Doctor: Get Calendar Booking Counts ───────────────────────────
router.get('/:id/calendar-counts', async (req, res) => {
  try {
    const start = moment().startOf('day').toDate();
    const end   = moment().add(30, 'days').endOf('day').toDate();

    const counts = await Appointment.aggregate([
      { $match: { doctor: require('mongoose').Types.ObjectId.createFromHexString(req.params.id), appointmentDate: { $gte: start, $lte: end }, status: 'booked' } },
      { $group: { 
        _id: { date: { $dateToString: { format: "%Y-%m-%d", date: "$appointmentDate" } }, sessionId: "$sessionId" }, 
        count: { $sum: 1 },
        label: { $first: "$sessionLabel" }
      } }
    ]);

    res.json({ success: true, counts });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Doctor: Request Change (Reschedule/Cancel) ────────────────────
router.post('/request-change', protect, authorize('doctor'), async (req, res) => {
  try {
    const { doctorId, type, date, sessionId, sessionLabel, proposedDate, reason } = req.body;
    const request = await DoctorRequest.create({
      hospitalId: req.user.hospitalId,
      doctorId,
      type,
      date,
      sessionId,
      sessionLabel,
      proposedDate,
      reason,
      createdBy: req.user._id
    });

    const doctor = await Doctor.findById(doctorId);
    const Notification = require('../models/Notification');
    const moment = require('moment');

    // Notify Staff & Admin
    const notifs = await Notification.insertMany([
      { hospitalId: req.user.hospitalId, role: 'staff', title: 'New Doctor Request', message: `Dr. ${doctor.name} requested to ${type} session on ${moment(date).format('LL')}`, type: 'doctor_request', link: '/staff/queue' },
      { hospitalId: req.user.hospitalId, role: 'admin', title: 'New Doctor Request', message: `Dr. ${doctor.name} requested to ${type} session on ${moment(date).format('LL')}`, type: 'doctor_request', link: '/admin/doctors' }
    ]);

    const io = req.app.get('io');
    if (io) {
      notifs.forEach(n => {
        io.to(`hospital_${req.user.hospitalId}_${n.role}`).emit('new_notification', n);
      });
    }

    res.status(201).json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Staff: List All Doctor Requests ───────────────────────────────
router.get('/requests/pending', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const requests = await DoctorRequest.find({ hospitalId, status: 'pending' })
      .populate('doctorId', 'name specialization')
      .sort({ createdAt: -1 });
    res.json({ success: true, requests });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Staff: Approve/Reject Request ─────────────────────────────────
router.put('/requests/:id/status', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { status, staffNotes } = req.body;
    const request = await DoctorRequest.findByIdAndUpdate(req.params.id, { status, staffNotes }, { new: true });
    
    // Notify Doctor if approved
    if (status === 'approved') {
      const doctor = await Doctor.findById(request.doctorId);
      const hospital = await Hospital.findById(request.hospitalId);
      
      if (doctor.notificationSettings?.notifyReschedule !== false) {
        const hospitalName = hospital.shortName || hospital.name;
        const msg = `${hospitalName}: Your request to ${request.type} session on ${moment(request.date).format('DD/MM/YYYY')} has been APPROVED.`;
        
        // SMS
        const { sendHospitalSms } = require('../utils/sms');
        sendHospitalSms({
          hospitalId: hospital._id,
          to: doctor.phone,
          message: msg
        }).catch(() => {});

        // WhatsApp
        if (hospital?.whatsapp?.enabled) {
          const { sendCustomMessage } = require('../utils/whatsapp');
          sendCustomMessage(hospital, { phone: doctor.phone, name: doctor.name }, msg).catch(() => {});
        }
      }
    }

    res.json({ success: true, request });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Doctor: Update Vacation Mode ──────────────────────────────────
router.put('/:id/vacation', protect, authorize('doctor', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { enabled, startDate, endDate, untilFurtherNotice, note } = req.body;
    
    // Authorization check
    if (req.user.role === 'doctor') {
      const doctor = await Doctor.findOne({ userId: req.user._id });
      if (!doctor || doctor._id.toString() !== req.params.id) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    const doctor = await Doctor.findByIdAndUpdate(req.params.id, {
      vacation: { enabled, startDate, endDate, untilFurtherNotice, note }
    }, { new: true });

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'UPDATE_DOCTOR_VACATION',
      targetType: 'Doctor',
      targetId: doctor._id,
      targetName: doctor.name,
      newValues: doctor.vacation
    });

    res.json({ success: true, vacation: doctor.vacation });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
