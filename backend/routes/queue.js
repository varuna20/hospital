const express = require('express');
const qRouter = express.Router();
const Queue = require('../models/Queue');
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const { protect, authorize } = require('../middleware/auth');
const { sendHospitalSms, templates } = require('../utils/sms');
const moment = require('moment');

qRouter.get('/live/:doctorId', async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    const { hospitalId } = req.query;
    const queue = await Queue.findOne({ doctor: req.params.doctorId, date: today });
    const waiting = await Appointment.find({
      doctor: req.params.doctorId, appointmentDate: today,
      status: { $in: ['booked', 'arrived'] }
    }).populate('patient', 'name').sort({ isEmergency: -1, queueNumber: 1 }).limit(15);
    const current = await Appointment.findOne({
      doctor: req.params.doctorId, appointmentDate: today, status: 'in-progress'
    }).populate('patient', 'name');
    const doctor = await Doctor.findById(req.params.doctorId, 'name specialization room todayStatus');
    res.json({
      success: true,
      currentNumber: queue?.currentNumber || 0,
      totalInQueue:  queue?.lastAssignedNumber || 0,
      currentPatient: current ? { queueNumber: current.queueNumber, name: current.patient?.name } : null,
      nextPatient:    waiting[0] ? { queueNumber: waiting[0].queueNumber, name: waiting[0].patient?.name } : null,
      waitingList:    waiting.map(a => ({ queueNumber: a.queueNumber, name: a.patient?.name, isEmergency: a.isEmergency, status: a.status })),
      doctor:         doctor ? { name: doctor.name, specialization: doctor.specialization, room: doctor.room, isArrived: doctor.todayStatus?.isArrived, sessionStart: doctor.todayStatus?.sessionStart, sessionEnd: doctor.todayStatus?.sessionEnd } : null,
      announcement:   queue?.announcement || ''
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

qRouter.post('/next/:doctorId', protect, authorize('staff', 'admin', 'doctor', 'superadmin'), async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    await Appointment.updateMany({ doctor: req.params.doctorId, appointmentDate: today, status: 'in-progress' },
      { status: 'completed', consultationEndedAt: new Date() });
    const next = await Appointment.findOne({
      doctor: req.params.doctorId, appointmentDate: today, status: { $in: ['arrived', 'booked'] }
    }).populate('patient', 'name phone').sort({ isEmergency: -1, queueNumber: 1 });
    if (!next) return res.json({ success: true, message: 'Queue empty', nextPatient: null });
    next.status = 'in-progress'; next.consultationStartedAt = new Date();
    await next.save();
    const queue = await Queue.findOneAndUpdate({ doctor: req.params.doctorId, date: today },
      { currentNumber: next.queueNumber }, { new: true });
    const remaining = await Appointment.countDocuments({ doctor: req.params.doctorId, appointmentDate: today, status: { $in: ['booked', 'arrived'] } });
    const io = req.app.get('io');
    const doc = await Doctor.findById(req.params.doctorId, 'hospitalId');
    if (io) // Emit to staff dashboards
      io.to(`hospital_${doc?.hospitalId}`).emit('next_called', { doctorId: req.params.doctorId, currentNumber: next.queueNumber, patientName: next.patient?.name, remaining });
      // Emit to display screens (instant update - no 15s polling wait)
      io.to(`display_${doc?.hospitalId}`).emit('next_called', { doctorId: req.params.doctorId, currentNumber: next.queueNumber, patientName: next.patient?.name });
      io.to(`display_${doc?.hospitalId}_${req.params.doctorId}`).emit('next_called', { doctorId: req.params.doctorId, currentNumber: next.queueNumber, patientName: next.patient?.name });
    // SMS turn alert to the NEW next patient (if configured)
    try {
      const nextWaiting = await Appointment.findOne({
        doctor: req.params.doctorId, appointmentDate: { $gte: moment().startOf('day').toDate() },
        status: { $in: ['booked','arrived'] }
      }).populate('patient','name phone').sort({ isEmergency:-1, queueNumber:1 });
      if (nextWaiting?.patient?.phone && doc?.hospitalId) {
        const h = await Hospital.findById(doc.hospitalId,'name shortName sms');
        if (h?.sms?.enabled && h?.sms?.notifyOnTurn) {
          sendHospitalSms({
            hospitalId: doc.hospitalId,
            to: nextWaiting.patient.phone,
            message: templates.turnAlert({
              patientName: nextWaiting.patient.name.split(' ')[0],
              queueNumber: nextWaiting.queueNumber,
              patientsAhead: 1,
              hospitalName: h.shortName || h.name,
              doctorName: doc.name,
            })
          }).catch(()=>{});
        }
      }
    } catch(_e) {}

    res.json({ success: true, currentNumber: next.queueNumber, patient: next.patient, remaining });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

qRouter.post('/reset/:doctorId', protect, authorize('admin', 'staff', 'superadmin'), async (req, res) => {
  try {
    const today = moment().startOf('day').toDate();
    await Queue.findOneAndUpdate({ doctor: req.params.doctorId, date: today }, { currentNumber: 0, lastAssignedNumber: 0 }, { upsert: true });
    await Appointment.updateMany({ doctor: req.params.doctorId, appointmentDate: today, status: { $in: ['booked', 'arrived'] } }, { status: 'cancelled' });
    const io = req.app.get('io');
    if (io) io.emit('queue_reset', { doctorId: req.params.doctorId });
    res.json({ success: true, message: 'Queue reset' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = qRouter;
