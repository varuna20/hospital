const { sendHospitalSms, templates } = require('../utils/sms');
// ============================================================
// appointments.js
// ============================================================
const express = require('express');
const aptRouter = express.Router();
const Appointment = require('../models/Appointment');
const Patient  = require('../models/Patient');
const Doctor   = require('../models/Doctor');
const Queue    = require('../models/Queue');
const Hospital = require('../models/Hospital');
const { protect, authorize , getHospitalId } = require('../middleware/auth');
const { 
  sendBookingConfirmation, 
  sendTurnAlert, 
  sendDelayAlert, 
  sendCancellationAlert, 
  sendCustomMessage 
} = require('../utils/whatsapp');
const moment = require('moment');
const crypto = require('crypto');

async function getDoctorConsultMinutes(doctorId, defaultMins = 15) {
  try {
    const today = moment().startOf('day').toDate();
    const completedApts = await Appointment.find({
      doctor: doctorId,
      appointmentDate: today,
      status: 'completed'
    }).sort({ updatedAt: 1 });

    if (completedApts.length >= 2) {
      const firstCompleted = completedApts[0].updatedAt;
      const lastCompleted = completedApts[completedApts.length - 1].updatedAt;
      const totalMs = lastCompleted - firstCompleted;
      const durationMins = totalMs / (1000 * 60);
      if (durationMins > 0) {
        const calculatedMins = durationMins / (completedApts.length - 1);
        if (calculatedMins >= 2 && calculatedMins <= 45) {
          return Math.round(calculatedMins * 10) / 10;
        }
      }
    }
  } catch (err) {
    console.error('Error calculating consult minutes:', err);
  }
  return defaultMins;
}

// Check duplicate booking
aptRouter.post('/check-duplicate', async (req, res) => {
  try {
    const { name, phone, hospitalId, appointmentDate } = req.body;
    if (!phone || !hospitalId) return res.json({ success: true, hasBooking: false });
    
    const bookingDate = moment(appointmentDate).startOf('day').toDate();
    
    // Find all patients with this phone and hospitalId
    const patients = await Patient.find({ phone, hospitalId });
    if (patients.length === 0) return res.json({ success: true, hasBooking: false });
    
    const patientIds = patients.map(p => p._id);
    
    // Count active appointments for these patient profiles on this date
    const count = await Appointment.countDocuments({
      appointmentDate: bookingDate,
      status: { $nin: ['cancelled', 'absent'] },
      patient: { $in: patientIds }
    });
    
    res.json({ success: true, hasBooking: count > 0, count });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Book appointment
aptRouter.post('/book', async (req, res) => {
  try {
    const { doctorId, appointmentDate, hospitalId, patientId, name, phone, reason, isEmergency } = req.body;
    if (!doctorId || !appointmentDate || !hospitalId)
      return res.status(400).json({ success: false, message: 'doctorId, appointmentDate, hospitalId required' });

    const doctor = await Doctor.findById(doctorId);
    if (!doctor?.isActive) return res.status(404).json({ success: false, message: 'Doctor not found' });

    // Vacation Check
    if (doctor.vacation?.enabled) {
      const bDate = moment(appointmentDate);
      const isIndefinite = doctor.vacation.untilFurtherNotice;
      const inRange = doctor.vacation.startDate && doctor.vacation.endDate && 
                      bDate.isSameOrAfter(moment(doctor.vacation.startDate), 'day') && 
                      bDate.isSameOrBefore(moment(doctor.vacation.endDate), 'day');
      
      if (isIndefinite || inRange) {
        return res.status(400).json({ success: false, message: `Dr. ${doctor.name.replace('Dr. ','')} is currently on vacation. ${doctor.vacation.note || ''}` });
      }
    }

    const { patientsList } = req.body;
    let plist = [];
    if (Array.isArray(patientsList) && patientsList.length > 0) {
      plist = patientsList;
    } else {
      plist = [{ name, phone, patientId }];
    }

    const bookingDate = moment(appointmentDate).startOf('day').toDate();
    const sessionId = req.body.sessionId || 'default';
    
    // Find or create Queue
    let queue = await Queue.findOne({ hospitalId, doctor: doctorId, date: bookingDate, sessionId });
    if (!queue) queue = await Queue.create({ hospitalId, doctor: doctorId, date: bookingDate, sessionId });

    const createdAppointments = [];
    const crypto = require('crypto');

    for (const pItem of plist) {
      let currentPatient;
      if (pItem.patientId) {
        currentPatient = await Patient.findById(pItem.patientId);
      } else if (pItem.name && pItem.phone) {
        currentPatient = await Patient.findOne({
          phone: pItem.phone, hospitalId,
          name: { $regex: new RegExp('^' + pItem.name.trim() + '$', 'i') }
        });
        if (!currentPatient) {
          currentPatient = await Patient.create({ name: pItem.name.trim(), phone: pItem.phone, hospitalId, isGuest: true });
        }
      } else {
        continue;
      }

      // Check duplicate
      const dup = await Appointment.findOne({
        patient: currentPatient._id, doctor: doctorId,
        appointmentDate: bookingDate, status: { $nin: ['cancelled', 'absent'] }
      });
      if (dup) {
        return res.status(400).json({ success: false, message: `Patient '${pItem.name}' already has a booking for this doctor today.` });
      }

      // Allocate consecutive queue number
      queue.lastAssignedNumber += 1;
      const queueNumber = queue.lastAssignedNumber;

      const guestToken = crypto.randomBytes(20).toString('hex');
      const isRefundable = req.body.isRefundable === true;
      const refundableFee = isRefundable ? 500 : 0;
      const doctorFee = doctor.fees?.doctorFee || 0;
      const hospitalCharge = doctor.fees?.hospitalCharge || 0;
      const totalAmount = doctorFee + hospitalCharge + refundableFee;

      const apt = await Appointment.create({
        hospitalId, patient: currentPatient._id, doctor: doctorId,
        appointmentDate: bookingDate,
        queueNumber,
        sessionId: req.body.sessionId,
        sessionLabel: req.body.sessionLabel,
        reason: reason || pItem.reason || '',
        isEmergency: isEmergency || false,
        isRefundableBooking: isRefundable,
        fees: {
          doctorFee,
          hospitalCharge,
          refundableFee,
          totalAmount
        },
        guestToken,
        bookedBy: patientId ? 'patient' : 'staff'
      });

      const populated = await Appointment.findById(apt._id)
        .populate('patient', 'name phone email')
        .populate('doctor', 'name specialization room fees');

      createdAppointments.push(populated);

      // WhatsApp confirmation
      const hospital = await Hospital.findById(hospitalId);
      if (hospital?.whatsapp?.enabled && hospital.whatsapp.notifyOnBook && currentPatient.whatsappOptIn !== false) {
        sendBookingConfirmation(hospital, currentPatient, apt, doctor).catch(() => {});
      }
    }

    // Save final queue lastAssignedNumber
    await queue.save();

    const io = req.app.get('io');
    if (io) {
      for (const apt of createdAppointments) {
        io.to(`hospital_${hospitalId}_doc_${doctorId}`).emit('appointment_booked', { queueNumber: apt.queueNumber });
      }
      io.to(`display_${hospitalId}_${doctorId}`).emit('appointment_booked', { doctorId });
      io.to(`display_${hospitalId}`).emit('appointment_booked', { doctorId });
    }

    // Send SMS confirmation for the main booking patient if available
    try {
      const mainApt = createdAppointments[0];
      const hosp = await require('../models/Hospital').findById(hospitalId, 'name shortName payment sms');
      const { SystemSettings } = require('../models/SystemSettings');
      const settings = await SystemSettings.findOne();
      
      const smsEnabled = hosp?.sms?.enabled || settings?.sms?.enabled;
      if (smsEnabled && hosp?.sms?.notifyOnBook !== false) {
        const patPhone = mainApt.patient?.phone || mainApt.phone;
        
        // Calculate estimated time
        const avgSlot = doctor.avgConsultMinutes || 5;
        const waitMinutes = (mainApt.queueNumber - 1) * avgSlot;
        const startTimeStr = doctor.sessions?.[0]?.startTime || '08:00';
        const estTime = moment(appointmentDate).set({
          hour:   parseInt(startTimeStr.split(':')[0]),
          minute: parseInt(startTimeStr.split(':')[1])
        }).add(waitMinutes, 'minutes').format('hh:mm A');

        const trackUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/queue-status/${mainApt.guestToken}`;

        sendHospitalSms({
          hospitalId,
          to: patPhone,
          templateType: 'booking',
          templateData: {
            patientName: mainApt.patient?.name || mainApt.name,
            queueNumber: mainApt.queueNumber,
            doctorName: doctor?.name || 'Doctor',
            hospitalName: hosp.shortName || hosp.name,
            date: moment(appointmentDate).format('DD/MM/YYYY'),
            time: estTime,
            sessionLabel: req.body.sessionLabel || '',
            sym: hosp.payment?.currencySymbol || 'Rs.',
            fee: ((doctor?.fees?.doctorFee||0)+(doctor?.fees?.hospitalCharge||0)).toLocaleString(),
            trackUrl
          }
        }).catch(() => {});
      }
    } catch (_e) {
      console.error('Booking SMS error:', _e);
    }

    // Audit log for booking
    const { logAudit } = require('../utils/audit');
    const mainApt = createdAppointments[0];
    await logAudit(req, {
      action: 'APPOINTMENT_BOOKED',
      targetType: 'Appointment',
      targetId: mainApt._id,
      targetName: `Queue #${mainApt.queueNumber} - ${mainApt.patient?.name}`,
      newValues: { queueNumber: mainApt.queueNumber, doctorName: doctor.name, appointmentDate: bookingDate, count: createdAppointments.length }
    });

    res.status(201).json({
      success: true,
      appointments: createdAppointments,
      appointment: mainApt,
      queueNumber: mainApt.queueNumber,
      guestToken: mainApt.guestToken,
      estimatedWaitMinutes: mainApt.queueNumber * (await getDoctorConsultMinutes(doctorId, doctor.avgConsultMinutes || 15)),
      fees: mainApt.fees
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Today's appointments for a doctor
aptRouter.get('/today/:doctorId', protect, async (req, res) => {
  try {
    const { sessionId } = req.query;
    const today = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    
    const filter = {
      doctor: req.params.doctorId,
      appointmentDate: { $gte: today, $lte: todayEnd }
    };
    if (sessionId) filter.sessionId = sessionId;

    const apts = await Appointment.find(filter)
      .populate('patient', 'name phone gender')
      .sort({ isEmergency: -1, queueNumber: 1 });
      
    const queueQuery = { doctor: req.params.doctorId, date: today };
    if (sessionId) queueQuery.sessionId = sessionId;
    const queue = await Queue.findOne(queueQuery);
    
    res.json({ success: true, appointments: apts, currentNumber: queue?.currentNumber || 0, totalBooked: apts.length });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update status
aptRouter.put('/:id/status', protect, authorize('staff', 'admin', 'doctor', 'superadmin'), async (req, res) => {
  try {
    const { status, consultationNotes } = req.body;
    const apt = await Appointment.findById(req.params.id).populate('patient', 'name phone whatsappOptIn').populate('doctor');
    if (!apt) return res.status(404).json({ success: false, message: 'Not found' });
    
    const oldStatus = apt.status;
    if (status === 'arrived')     apt.arrivedAt = new Date();
    if (status === 'in-progress') apt.consultationStartedAt = new Date();
    if (status === 'completed') {
      apt.consultationEndedAt = new Date();
      if (consultationNotes) apt.consultationNotes = consultationNotes;
    }
    apt.status = status;
    await apt.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'APPOINTMENT_STATUS_CHANGE',
      targetType: 'Appointment',
      targetId: apt._id,
      targetName: `Queue #${apt.queueNumber} - ${apt.patient?.name}`,
      oldValues: { status: oldStatus },
      newValues: { status: status }
    });

    if (status === 'in-progress') {
      await Queue.findOneAndUpdate({ doctor: apt.doctor._id, date: moment().startOf('day').toDate() }, { currentNumber: apt.queueNumber });
    }
    // Check if next patient needs alert
    if (status === 'in-progress') {
      const hospital = await Hospital.findById(apt.hospitalId);
      if (hospital?.whatsapp?.enabled) {
        const nextApt = await Appointment.findOne({
          doctor: apt.doctor._id, appointmentDate: moment().startOf('day').toDate(),
          status: { $in: ['booked', 'arrived'] }
        }).sort({ queueNumber: 1 }).populate('patient');
        if (nextApt?.patient?.whatsappOptIn !== false) {
          const ahead = await Appointment.countDocuments({
            doctor: apt.doctor._id, queueNumber: { $gt: apt.queueNumber, $lt: nextApt.queueNumber },
            status: { $in: ['booked', 'arrived'] }
          });
          if (ahead <= (hospital.queueSettings?.notifyWhenAhead || 3)) {
            sendTurnAlert(hospital, nextApt.patient, nextApt.queueNumber, ahead).catch(() => {});

            // SMS turn alert
            const { SystemSettings } = require('../models/SystemSettings');
            const settings = await SystemSettings.findOne();
            const smsEnabled = hospital?.sms?.enabled || settings?.sms?.enabled;
            
            if (smsEnabled && hospital?.sms?.notifyOnTurn !== false) {
              sendHospitalSms({
                hospitalId: hospital._id,
                to: nextApt.patient?.phone,
                templateType: 'turn',
                templateData: {
                  patientName: nextApt.patient?.name,
                  queueNumber: nextApt.queueNumber,
                  patientsAhead: ahead,
                  hospitalName: hospital.shortName || hospital.name,
                  doctorName: apt.doctor?.name || 'the doctor'
                }
              }).catch(() => {});
            }
          }
        }
      }
    }
    const io = req.app.get('io');
    if (io) io.to(`hospital_${apt.hospitalId}`).emit('appointment_updated', { id: apt._id, status, queueNumber: apt.queueNumber });
      io.to(`display_${apt.hospitalId}`).emit('appointment_updated', { doctorId: apt.doctor });
    res.json({ success: true, appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Guest status check
aptRouter.get('/guest/:token', async (req, res) => {
  try {
    const apt = await Appointment.findOne({ guestToken: req.params.token })
      .populate('patient', 'name')
      .populate('doctor', 'name specialization room avgConsultMinutes todayStatus sessions')
      .populate('hospitalId', 'name shortName');
    if (!apt) return res.status(404).json({ success: false, message: 'Not found' });
    const today = moment().startOf('day').toDate();
    const queue = await Queue.findOne({ doctor: apt.doctor._id, date: today });
    const ahead = await Appointment.countDocuments({
      doctor: apt.doctor._id, appointmentDate: today,
      queueNumber: { $gt: queue?.currentNumber || 0, $lt: apt.queueNumber },
      status: { $in: ['booked', 'arrived'] }
    });
    const isArrived = apt.doctor.todayStatus?.isArrived || false;
    const consultMinutes = await getDoctorConsultMinutes(apt.doctor._id, apt.doctor.avgConsultMinutes || 15);

    // Find session time
    let sessionTime = '';
    if (apt.sessionId && apt.doctor?.sessions) {
      const sess = apt.doctor.sessions.find(s => s._id?.toString() === apt.sessionId.toString() || `${s.sessionName}-${s.startTime}` === apt.sessionId);
      if (sess) {
        sessionTime = `${sess.startTime} - ${sess.endTime}`;
      }
    }

    res.json({ 
      success: true, 
      queueNumber: apt.queueNumber, 
      status: apt.status,
      currentServing: queue?.currentNumber || 0, 
      peopleAhead: ahead, 
      isArrived,
      estimatedWaitMinutes: ahead * consultMinutes, 
      avgSlotMinutes: consultMinutes, 
      doctor: apt.doctor.name, 
      room: apt.doctor.room,
      appointmentDate: apt.appointmentDate,
      sessionLabel: apt.sessionLabel,
      sessionTime,
      hospitalName: apt.hospitalId?.shortName || apt.hospitalId?.name || 'Hospital'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Patient History ──────────────────────────────────────────────
aptRouter.get('/patient-history', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ success: false, message: 'Patients only' });
    
    const familyPhones = [req.user.phone];
    if (Array.isArray(req.user.familyMembers)) {
      for (const m of req.user.familyMembers) {
        if (m.phone) familyPhones.push(m.phone);
      }
    }

    const patients = await Patient.find({
      $or: [
        { _id: req.user._id },
        { phone: { $in: familyPhones.filter(Boolean) } }
      ]
    });

    const patientIds = patients.map(p => p._id);

    const appointments = await Appointment.find({ patient: { $in: patientIds } })
      .populate('patient', 'name phone email')
      .populate('doctor', 'name specialization')
      .sort({ appointmentDate: -1 });
      
    res.json({ success: true, appointments });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// All appointments (with filters)
aptRouter.get('/', protect, async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { date, doctorId, status, page = 1, limit = 25, startDate, endDate } = req.query;
    const filter = { hospitalId };
    if (date) { const d = moment(date); filter.appointmentDate = { $gte: d.startOf('day').toDate(), $lte: d.endOf('day').toDate() }; }
    else if (startDate && endDate) { filter.appointmentDate = { $gte: moment(startDate).startOf('day').toDate(), $lte: moment(endDate).endOf('day').toDate() }; }
    if (doctorId) filter.doctor = doctorId;
    if (status) filter.status = status;
    const apts = await Appointment.find(filter)
      .populate('patient', 'name phone').populate('doctor', 'name specialization')
      .sort({ appointmentDate: -1, queueNumber: 1 }).limit(limit * 1).skip((page - 1) * limit);
    const total = await Appointment.countDocuments(filter);
    res.json({ success: true, appointments: apts, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── REFUND WORKFLOW ────────────────────────────────────────────────

// Staff: request refund for doctor fee
aptRouter.post('/:id/refund/request', protect, authorize('staff', 'admin'), async (req, res) => {
  try {
    const { reason } = req.body;
    const apt = await Appointment.findById(req.params.id).populate('patient', 'name');
    if (!apt) return res.status(404).json({ success: false, message: 'Appointment not found' });
    if (apt.paymentStatus !== 'paid') return res.status(400).json({ success: false, message: 'Only paid appointments can be refunded' });
    if (apt.refund?.status && apt.refund.status !== 'none' && apt.refund.status !== 'rejected')
      return res.status(400).json({ success: false, message: 'Refund already ' + apt.refund.status });

    apt.refund = {
      status: 'requested',
      reason: reason || 'No reason provided',
      requestedAt: new Date(),
      requestedBy: req.user.name,
      refundAmount: apt.fees?.doctorFee || 0,
    };
    await apt.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'REFUND_REQUESTED',
      targetType: 'Refund',
      targetId: apt._id,
      targetName: `Refund Q#${apt.queueNumber} - ${apt.patient?.name}`,
      metadata: { reason, amount: apt.refund.refundAmount }
    });

    // Notify via socket
    const io = req.app.get('io');
    if (io) io.to(`hospital_${apt.hospitalId}`).emit('refund_requested', { appointmentId: apt._id, doctorId: apt.doctor });

    res.json({ success: true, message: 'Refund request sent to doctor for approval', refund: apt.refund });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Doctor: approve refund request
aptRouter.put('/:id/refund/doctor-approve', protect, authorize('doctor'), async (req, res) => {
  try {
    const apt = await Appointment.findById(req.params.id).populate('doctor').populate('patient', 'name');
    if (!apt) return res.status(404).json({ success: false, message: 'Not found' });

    // Verify this doctor owns this appointment
    const Doctor = require('../models/Doctor');
    const doc = await Doctor.findOne({ userId: req.user._id });
    if (!doc || apt.doctor.toString() !== doc._id.toString())
      return res.status(403).json({ success: false, message: 'Not your appointment' });

    if (apt.refund?.status !== 'requested')
      return res.status(400).json({ success: false, message: 'No pending refund request' });

    apt.refund.status = 'doctor_approved';
    apt.refund.doctorApprovedAt = new Date();
    apt.refund.doctorApprovedBy = req.user.name;
    await apt.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'REFUND_DOCTOR_APPROVED',
      targetType: 'Refund',
      targetId: apt._id,
      targetName: `Refund Q#${apt.queueNumber} - ${apt.patient?.name}`
    });

    const io = req.app.get('io');
    if (io) io.to(`hospital_${apt.hospitalId}`).emit('refund_approved', { appointmentId: apt._id });

    res.json({ success: true, message: 'Refund approved — staff can now process it', refund: apt.refund });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Doctor: reject refund request
aptRouter.put('/:id/refund/doctor-reject', protect, authorize('doctor'), async (req, res) => {
  try {
    const { rejectionReason } = req.body;
    const apt = await Appointment.findById(req.params.id).populate('patient', 'name');
    if (!apt) return res.status(404).json({ success: false, message: 'Not found' });
    if (apt.refund?.status !== 'requested')
      return res.status(400).json({ success: false, message: 'No pending refund request' });

    apt.refund.status = 'rejected';
    apt.refund.rejectedAt = new Date();
    apt.refund.rejectedBy = req.user.name;
    apt.refund.rejectionReason = rejectionReason || 'Rejected by doctor';
    await apt.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'REFUND_DOCTOR_REJECTED',
      targetType: 'Refund',
      targetId: apt._id,
      targetName: `Refund Q#${apt.queueNumber} - ${apt.patient?.name}`,
      metadata: { reason: rejectionReason }
    });

    res.json({ success: true, message: 'Refund rejected', refund: apt.refund });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Staff: complete refund (after doctor approval)
aptRouter.put('/:id/refund/complete', protect, authorize('staff', 'admin'), async (req, res) => {
  try {
    const apt = await Appointment.findById(req.params.id).populate('patient', 'name');
    if (!apt) return res.status(404).json({ success: false, message: 'Not found' });
    if (apt.refund?.status !== 'doctor_approved')
      return res.status(400).json({ success: false, message: 'Doctor must approve refund first' });

    apt.refund.status = 'completed';
    apt.refund.completedAt = new Date();
    apt.refund.completedBy = req.user.name;
    apt.refund.notes = req.body.notes || '';
    apt.paymentStatus = 'refunded';
    await apt.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'REFUND_COMPLETED',
      targetType: 'Refund',
      targetId: apt._id,
      targetName: `Refund Q#${apt.queueNumber} - ${apt.patient?.name}`,
      metadata: { notes: req.body.notes }
    });

    // SMS notification for refund approval
    try {
      const hospital = await require('../models/Hospital').findById(apt.hospitalId);
      const populatedApt = await Appointment.findById(apt._id).populate('patient').populate('doctor');
      if (hospital?.sms?.enabled) {
        sendHospitalSms({
          hospitalId: hospital._id,
          to: populatedApt.patient?.phone,
          templateType: 'refund',
          templateData: {
            patientName: populatedApt.patient?.name,
            amount: apt.refund.refundAmount.toLocaleString(),
            sym: hospital.payment?.currencySymbol || 'Rs.',
            doctorName: populatedApt.doctor?.name || 'Doctor',
            hospitalName: hospital.shortName || hospital.name
          }
        }).catch(() => {});
      }
    } catch (_e) {}

    res.json({ success: true, message: `Refund of Rs. ${apt.refund.refundAmount} completed`, refund: apt.refund });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Get pending refund requests for a hospital (staff dashboard)
aptRouter.get('/refunds/pending', protect, authorize('staff', 'admin', 'doctor', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    let filter = { hospitalId, 'refund.status': { $in: ['requested', 'doctor_approved'] } };

    // Doctors only see their own
    if (req.user.role === 'doctor') {
      const Doctor = require('../models/Doctor');
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (doc) filter.doctor = doc._id;
    }

    const refunds = await Appointment.find(filter)
      .populate('patient', 'name phone')
      .populate('doctor', 'name specialization')
      .sort({ 'refund.requestedAt': -1 })
      .limit(50);



    res.json({ success: true, refunds });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── BULK SESSION ACTIONS ───────────────────────────────────────────

// Staff: Notify all patients about something custom
aptRouter.post('/bulk-notify', protect, authorize('staff', 'admin'), async (req, res) => {
  try {
    const { doctorId, sessionId, message } = req.body;
    if (!message) return res.status(400).json({ success: false, message: 'Message is required' });

    const hospitalId = getHospitalId(req);
    const today = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const hospital = await Hospital.findById(hospitalId);
    const filter = {
      doctor: doctorId,
      appointmentDate: { $gte: today, $lte: todayEnd },
      status: { $in: ['booked', 'arrived'] }
    };
    if (sessionId) filter.sessionId = sessionId;

    const patients = await Appointment.find(filter).populate('patient');
    
    const { SystemSettings } = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne();
    const smsEnabled = hospital?.sms?.enabled || settings?.sms?.enabled;
    const waEnabled = hospital?.whatsapp?.enabled;

    for (const apt of patients) {
      if (!apt.patient?.phone) continue;

      // SMS
      if (smsEnabled) {
        sendHospitalSms({
          hospitalId: hospital._id,
          to: apt.patient.phone,
          message: `${hospital.shortName || hospital.name}: ${message}`
        }).catch(() => {});
      }

      // WhatsApp
      if (waEnabled && apt.patient.whatsappOptIn !== false) {
        sendCustomMessage(hospital, apt.patient, message).catch(() => {});
      }
    }

    res.json({ success: true, message: `Notification sent to ${patients.length} patients` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Staff: Mark doctor as late for a session
aptRouter.post('/notify-delay', protect, authorize('staff', 'admin'), async (req, res) => {
  try {
    const { doctorId, sessionId, sessionLabel, expectedTime } = req.body;
    const hospitalId = getHospitalId(req);
    const today = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const hospital = await Hospital.findById(hospitalId);
    const doctor = await Doctor.findById(doctorId);
    
    const filter = {
      doctor: doctorId,
      appointmentDate: { $gte: today, $lte: todayEnd },
      status: { $in: ['booked', 'arrived'] }
    };
    if (sessionId) filter.sessionId = sessionId;

    const patients = await Appointment.find(filter).populate('patient');
    
    // Notifications
    const { SystemSettings } = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne();
    const smsEnabled = hospital?.sms?.enabled || settings?.sms?.enabled;
    const waEnabled = hospital?.whatsapp?.enabled;

    for (const apt of patients) {
      if (!apt.patient?.phone) continue;

      // SMS
      if (smsEnabled) {
        sendHospitalSms({
          hospitalId: hospital._id,
          to: apt.patient.phone,
          templateType: 'late',
          templateData: {
            patientName: apt.patient.name,
            doctorName: doctor.name,
            expectedTime: expectedTime || 'later today',
            sessionLabel: sessionLabel || '',
            hospitalName: hospital.shortName || hospital.name
          }
        }).catch(() => {});
      }

      // WhatsApp
      if (waEnabled && apt.patient.whatsappOptIn !== false) {
        sendDelayAlert(hospital, apt.patient, doctor, expectedTime, sessionLabel).catch(() => {});
      }
    }

    res.json({ success: true, message: `Delay notification sent to ${patients.length} patients` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Staff: Cancel entire session (e.g. doctor absent)
aptRouter.post('/cancel-session', protect, authorize('staff', 'admin'), async (req, res) => {
  try {
    const { doctorId, sessionId, sessionLabel, reason } = req.body;
    const hospitalId = getHospitalId(req);
    const today = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();

    const hospital = await Hospital.findById(hospitalId);
    const doctor = await Doctor.findById(doctorId);

    const filter = {
      doctor: doctorId,
      appointmentDate: { $gte: today, $lte: todayEnd },
      status: { $in: ['booked', 'arrived'] }
    };
    if (sessionId) filter.sessionId = sessionId;

    const patients = await Appointment.find(filter).populate('patient');

    // Update status to cancelled
    await Appointment.updateMany(filter, { $set: { status: 'cancelled', consultationNotes: reason || 'Session cancelled' } });

    // Notify patients
    const { SystemSettings } = require('../models/SystemSettings');
    const settings = await SystemSettings.findOne();
    const smsEnabled = hospital?.sms?.enabled || settings?.sms?.enabled;
    const waEnabled = hospital?.whatsapp?.enabled;

    for (const apt of patients) {
      if (!apt.patient?.phone) continue;

      // SMS
      if (smsEnabled) {
        sendHospitalSms({
          hospitalId: hospital._id,
          to: apt.patient.phone,
          templateType: 'cancel',
          templateData: {
            patientName: apt.patient.name,
            doctorName: doctor.name,
            date: moment(today).format('DD/MM/YYYY'),
            sessionLabel: sessionLabel || '',
            hospitalName: hospital.shortName || hospital.name,
            reason: reason || 'unavoidable circumstances'
          }
        }).catch(() => {});
      }

      // WhatsApp
      if (waEnabled && apt.patient.whatsappOptIn !== false) {
        sendCancellationAlert(hospital, apt.patient, doctor, reason, sessionLabel).catch(() => {});
      }
    }

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'SESSION_CANCELLED',
      targetType: 'Doctor',
      targetId: doctorId,
      targetName: `${doctor.name} - ${sessionLabel || 'Session'}`,
      metadata: { reason, patientCount: patients.length }
    });

    res.json({ success: true, message: `Session cancelled and ${patients.length} patients notified` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Staff: Move all patients to a new session ───────────────────
aptRouter.post('/move-session', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { doctorId, oldDate, oldSessionId, newDate, newSessionId, newSessionLabel, notify = true } = req.body;
    
    if (!doctorId || !oldDate || !newDate) {
      return res.status(400).json({ success: false, message: 'doctorId, oldDate, and newDate required' });
    }

    // Timezone-agnostic day boundaries using both Local and UTC ranges
    const localStart = moment(oldDate).startOf('day').toDate();
    const localEnd   = moment(oldDate).endOf('day').toDate();
    const utcStart   = moment.utc(oldDate).startOf('day').toDate();
    const utcEnd     = moment.utc(oldDate).endOf('day').toDate();

    const startOld = localStart < utcStart ? localStart : utcStart;
    const endOld   = localEnd > utcEnd ? localEnd : utcEnd;

    const newLocalStart = moment(newDate).startOf('day').toDate();
    const newLocalEnd   = moment(newDate).endOf('day').toDate();
    const newUtcStart   = moment.utc(newDate).startOf('day').toDate();
    const newUtcEnd     = moment.utc(newDate).endOf('day').toDate();

    const startNew = newLocalStart < newUtcStart ? newLocalStart : newUtcStart;
    const endNew   = newLocalEnd > newUtcEnd ? newLocalEnd : newUtcEnd;

    // 1. Find all appointments in the old session (Strict matching)
    const oldSessionQuery = {
      doctor: doctorId,
      appointmentDate: { $gte: startOld, $lte: endOld },
      status: 'booked'
    };

    if (oldSessionId && oldSessionId !== 'undefined' && oldSessionId !== 'null' && oldSessionId !== 'default') {
      oldSessionQuery.sessionId = oldSessionId;
    } else {
      oldSessionQuery.$or = [
        { sessionId: { $in: [null, undefined, '', 'default', 'undefined', 'null'] } },
        { sessionId: { $exists: false } }
      ];
    }

    let appointments = await Appointment.find(oldSessionQuery).populate('patient');

    // Fallback: If no appointments found strictly, lookup by doctor and day range only
    if (appointments.length === 0) {
      appointments = await Appointment.find({
        doctor: doctorId,
        appointmentDate: { $gte: startOld, $lte: endOld },
        status: 'booked'
      }).populate('patient');
    }

    if (appointments.length === 0) {
      return res.status(404).json({ success: false, message: 'No booked appointments found in the old session' });
    }

    // 2. Get last queue number in the new session to append
    const lastApt = await Appointment.findOne({
      doctor: doctorId,
      appointmentDate: { $gte: startNew, $lte: endNew },
      sessionId: newSessionId
    }).sort({ queueNumber: -1 });

    let nextQueue = (lastApt?.queueNumber || 0) + 1;

    // 3. Update appointments
    const hospital = await Hospital.findById(appointments[0].hospitalId);
    const doctor   = await Doctor.findById(doctorId);

    for (const apt of appointments) {
      apt.appointmentDate = moment(newDate).set({
        hour: moment(apt.appointmentDate).hour(),
        minute: moment(apt.appointmentDate).minute()
      }).toDate();
      apt.sessionId    = newSessionId;
      apt.sessionLabel = newSessionLabel;
      apt.queueNumber  = nextQueue++;
      await apt.save();

      // 4. Notify patients if requested
      if (notify) {
        const dateStr = moment(newDate).format('YYYY-MM-DD');
        const hospitalName = hospital.shortName || hospital.name;
        
        // SMS
        sendHospitalSms({
          hospitalId: hospital._id,
          to: apt.patient?.phone,
          templateType: 'change',
          templateData: {
            patientName: apt.patient?.name,
            doctorName: doctor.name,
            newDate: dateStr,
            newTime: newSessionLabel,
            queueNumber: apt.queueNumber,
            hospitalName: hospitalName
          }
        }).catch(() => {});

        // WhatsApp (Premium bold styling)
        if (hospital?.whatsapp?.enabled) {
          const wsMsg = 
            `Dear *${apt.patient?.name || 'Patient'}*,\n` +
            `Your appointment with *Dr. ${doctor.name}* has been rescheduled.\n\n` +
            `📅 *New Date:* ${dateStr}\n` +
            `⏰ *Session:* ${newSessionLabel || 'General'}\n` +
            `🔢 *New Queue Number:* *#${apt.queueNumber}*\n\n` +
            `We apologize for any inconvenience caused. Please arrive early.`;
            
          sendCustomMessage(hospital, apt.patient, wsMsg).catch(() => {});
        }
      }
    }
    
    // 5. Notify Doctor if requested
    if (doctor.notificationSettings?.notifyReschedule !== false) {
      const hospitalName = hospital.shortName || hospital.name;
      const dateStr = moment(newDate).format('YYYY-MM-DD');
      const docMsg = `${hospitalName}: Dr. ${doctor.name.replace('Dr. ','')}, your session on ${moment(oldDate).format('YYYY-MM-DD')} has been rescheduled to ${dateStr} (${newSessionLabel}). ${appointments.length} patients were moved.`;
      
      // SMS
      sendHospitalSms({
        hospitalId: hospital._id,
        to: doctor.phone,
        message: docMsg
      }).catch(() => {});

      // WhatsApp
      if (hospital?.whatsapp?.enabled) {
        sendCustomMessage(hospital, { phone: doctor.phone, name: doctor.name }, docMsg).catch(() => {});
      }
    }

    res.json({ success: true, count: appointments.length, message: `Moved ${appointments.length} patients to ${newDate}` });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = aptRouter;
