/**
 * DISPLAY ROUTES — Public (no auth required)
 * ===========================================
 * GET /api/display/:hospitalId/info       - Hospital info for branding
 * GET /api/display/:hospitalId/:doctorId  - Per-doctor queue data (supports ?sessionId=)
 * GET /api/display/:hospitalId            - All doctors in hospital
 */

const express  = require('express');
const router   = express.Router();
const Queue    = require('../models/Queue');
const Appointment = require('../models/Appointment');
const Doctor   = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const moment   = require('moment');

// ── Hospital info for display branding (MUST be before /:hospitalId) ─
router.get('/:hospitalId/info', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId,
      'name shortName logo logoUrl theme queueSettings waitingVideo announcement slideshow displayLayout');
    if (!hospital) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, hospital });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Per-doctor display data ────────────────────────────────────────
router.get('/:hospitalId/:doctorId', async (req, res) => {
  try {
    const { hospitalId, doctorId } = req.params;
    const { sessionId } = req.query;
    const today    = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const queueQuery = { doctor: doctorId, date: today };
    if (sessionId) queueQuery.sessionId = sessionId;

    const aptFilter = {
      doctor: doctorId,
      appointmentDate: { $gte: today, $lte: todayEnd },
      status: { $in: ['booked', 'arrived'] }
    };
    if (sessionId) aptFilter.sessionId = sessionId;

    const currentPtFilter = {
      doctor: doctorId,
      appointmentDate: { $gte: today, $lte: todayEnd },
      status: 'in-progress'
    };
    if (sessionId) currentPtFilter.sessionId = sessionId;

    const [queue, waiting, currentPt, doctor, hospital] = await Promise.all([
      Queue.findOne(queueQuery),
      Appointment.find(aptFilter).populate('patient', 'name').sort({ isEmergency: -1, queueNumber: 1 }).limit(20),
      Appointment.findOne(currentPtFilter).populate('patient', 'name'),
      Doctor.findById(doctorId, 'name specialization room todayStatus profileImage sessions'),
      Hospital.findById(hospitalId, 'name shortName logo logoUrl theme queueSettings waitingVideo announcement slideshow displayLayout')
    ]);

    res.json({
      success: true,
      hospital: {
        id:        hospital?._id,
        name:      hospital?.name || 'Hospital',
        shortName: hospital?.shortName,
        logo:      hospital?.logo || hospital?.logoUrl,
        theme:     hospital?.theme,
        displayLayout: hospital?.displayLayout || 'futuristic_3d',
        announcement: hospital?.queueSettings?.announcement || '',
        showPatientName: hospital?.queueSettings?.showPatientNameOnDisplay !== false,
        waitingVideo: hospital?.waitingVideo,
        slideshow:    (hospital?.slideshow || []).filter(s => s.isActive).sort((a,b) => (a.order||0) - (b.order||0))
      },
      doctor: doctor ? {
        id:                  doctor._id,
        name:                doctor.name,
        specialization:      doctor.specialization,
        room:                doctor.room,
        isArrived:           doctor.todayStatus?.isArrived || false,
        arrivalTime:         doctor.todayStatus?.arrivalTime,
        expectedArrivalTime: doctor.todayStatus?.expectedArrivalTime,
        sessionStart:        doctor.todayStatus?.sessionStart,
        sessionEnd:          doctor.todayStatus?.sessionEnd,
        sessionNotes:        doctor.todayStatus?.sessionNotes,
        profileImage:        doctor.profileImage,
        sessions:            doctor.sessions || []
      } : null,
      currentNumber:  queue?.currentNumber || 0,
      totalInQueue:   queue?.lastAssignedNumber || 0,
      currentPatient: currentPt ? {
        queueNumber: currentPt.queueNumber,
        name: currentPt.patient?.name,
        sessionLabel: currentPt.sessionLabel
      } : null,
      nextPatient: waiting[0] ? {
        queueNumber: waiting[0].queueNumber,
        name: waiting[0].patient?.name,
        sessionLabel: waiting[0].sessionLabel
      } : null,
      waitingList: waiting.map(a => ({
        queueNumber:  a.queueNumber,
        name:         a.patient?.name || '—',
        isEmergency:  a.isEmergency,
        status:       a.status,
        sessionLabel: a.sessionLabel
      })),
      announcement: queue?.announcement || hospital?.queueSettings?.announcement || ''
    });
  } catch (err) {
    console.error('Display error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── All doctors in hospital (for hospital-level display) ──────────
router.get('/:hospitalId', async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const today    = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const [hospital, doctors] = await Promise.all([
      Hospital.findById(hospitalId, 'name shortName logo logoUrl theme queueSettings waitingVideo announcement slideshow displayLayout subscriptionPlan'),
      Doctor.find({ hospitalId, isActive: true }, 'name specialization room todayStatus')
    ]);

    const doctorData = await Promise.all(doctors.map(async doc => {
      // For the multi-doctor overview, we just show "Overall" waiting or the most active session
      const [queue, waitCount, current] = await Promise.all([
        Queue.findOne({ doctor: doc._id, date: today }), // fallback to first queue of day
        Appointment.countDocuments({
          doctor: doc._id,
          appointmentDate: { $gte: today, $lte: todayEnd },
          status: { $in: ['booked', 'arrived'] }
        }),
        Appointment.findOne({
          doctor: doc._id,
          appointmentDate: { $gte: today, $lte: todayEnd },
          status: 'in-progress'
        }).populate('patient', 'name')
      ]);
      return {
        _id:            doc._id,
        name:           doc.name,
        specialization: doc.specialization,
        room:           doc.room,
        isArrived:      doc.todayStatus?.isArrived || false,
        currentNumber:  queue?.currentNumber || 0,
        waitingCount:   waitCount,
        currentPatient: current?.patient?.name || null
      };
    }));

    res.json({
      success: true,
      hospital: {
        id:   hospital?._id,
        name: hospital?.name || 'Hospital',
        logo: hospital?.logo || hospital?.logoUrl,
        theme: hospital?.theme,
        subscriptionPlan: hospital?.subscriptionPlan || 'basic',
        displayLayout: hospital?.displayLayout || 'futuristic_3d',
        waitingVideo: hospital?.waitingVideo,
        slideshow: (hospital?.slideshow || []).filter(s => s.isActive).sort((a,b) => (a.order||0) - (b.order||0))
      },
      doctors: doctorData
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
