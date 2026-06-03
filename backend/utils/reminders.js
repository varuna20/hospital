const cron = require('node-cron');
const moment = require('moment');
const Prescription = require('../models/Prescription');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const { sendHospitalSms } = require('./sms');

// ─── UTILITIES ───────────────────────────────────────────────────────────────

function nowIST() {
  return moment().utcOffset('+05:30');
}

function todayRangeIST() {
  const start = moment().utcOffset('+05:30').startOf('day');
  const end   = moment().utcOffset('+05:30').endOf('day');
  return { start: start.toDate(), end: end.toDate() };
}

// ─── PATIENT FOLLOW-UP REMINDERS ─────────────────────────────────────────────

async function processFollowUpReminders() {
  console.log('⏳ Running Follow-Up Reminders Check...');

  try {
    const todayStart = moment().startOf('day').toDate();
    const todayEnd   = moment().endOf('day').toDate();
    const threeDaysFromNowStart = moment().add(3, 'days').startOf('day').toDate();
    const threeDaysFromNowEnd   = moment().add(3, 'days').endOf('day').toDate();

    // 1. Three-Day Reminders
    const threeDayPrescriptions = await Prescription.find({
      followUpDate: { $gte: threeDaysFromNowStart, $lte: threeDaysFromNowEnd },
      'reminderSent.threeDay': false
    }).populate('patient doctor hospitalId');

    for (const p of threeDayPrescriptions) {
      if (!p.patient?.phone) continue;

      const hospital = p.hospitalId;
      const templateData = {
        hospitalName: hospital?.name || 'Hospital',
        patientName:  p.patient.name,
        doctorName:   p.doctor?.name || 'your doctor',
        date:         moment(p.followUpDate).format('YYYY-MM-DD')
      };

      await sendHospitalSms({
        hospitalId: hospital?._id,
        to: p.patient.phone,
        templateType: 'reminder',
        templateData
      });

      if (hospital?.whatsapp?.enabled) {
        const { sendWhatsApp } = require('./whatsapp');
        const waMsg = `Follow-up Reminder from ${templateData.hospitalName}: You have a session with Dr. ${templateData.doctorName} on ${templateData.date}.`;
        await sendWhatsApp(hospital, p.patient.phone, waMsg, 'reminder', templateData);
      }

      p.reminderSent.threeDay = true;
      await p.save();
    }

    // 2. Day-Of Reminders
    const dayOfPrescriptions = await Prescription.find({
      followUpDate: { $gte: todayStart, $lte: todayEnd },
      'reminderSent.dayOf': false
    }).populate('patient doctor hospitalId');

    for (const p of dayOfPrescriptions) {
      if (!p.patient?.phone) continue;

      const hospital = p.hospitalId;
      const templateData = {
        hospitalName: hospital?.name || 'Hospital',
        patientName:  p.patient.name,
        doctorName:   p.doctor?.name || 'your doctor',
        date:         'TODAY'
      };

      await sendHospitalSms({
        hospitalId: hospital?._id,
        to: p.patient.phone,
        templateType: 'reminder',
        templateData
      });

      if (hospital?.whatsapp?.enabled) {
        const { sendWhatsApp } = require('./whatsapp');
        const waMsg = `Urgent Reminder from ${templateData.hospitalName}: Your follow-up with Dr. ${templateData.doctorName} is TODAY. Please book your number early.`;
        await sendWhatsApp(hospital, p.patient.phone, waMsg, 'reminder', templateData);
      }

      p.reminderSent.dayOf = true;
      await p.save();
    }

    console.log(`✅ Processed Reminders: ${threeDayPrescriptions.length} (3-day), ${dayOfPrescriptions.length} (Day-of)`);
  } catch (err) {
    console.error('❌ Error processing reminders:', err);
  }
}

// ─── 8 AM MORNING DOCTOR BRIEF ───────────────────────────────────────────────
// Runs at exactly 8:00 AM IST every day.
// Sends a brief to any doctor who has at least one appointment booked today.

async function processMorningDoctorBrief() {
  console.log('⏳ Running 8 AM Morning Doctor Brief...');

  try {
    const Appointment = require('../models/Appointment');
    const crypto      = require('crypto');
    const { start: todayStart, end: todayEnd } = todayRangeIST();
    const frontendUrl = process.env.FRONTEND_URL || 'https://echanneling-hospital.live';

    // Get all active doctors
    const doctors = await Doctor.find({ isActive: true }).populate('hospitalId');

    for (const doc of doctors) {
      if (!doc.phone) continue;

      // Find all appointments for this doctor today
      const appointments = await Appointment.find({
        doctor: doc._id,
        appointmentDate: { $gte: todayStart, $lte: todayEnd },
        status: { $in: ['booked', 'completed', 'checked-in'] }
      });

      if (appointments.length === 0) continue; // No appointments today – skip

      // Count by session (group by sessionId / startTime)
      const sessionGroups = {};
      for (const apt of appointments) {
        const key = apt.sessionId || 'General';
        sessionGroups[key] = (sessionGroups[key] || 0) + 1;
      }

      // Ensure guest token
      let guestToken = doc.guestToken;
      if (!guestToken) {
        guestToken = crypto.randomBytes(20).toString('hex');
        await Doctor.findByIdAndUpdate(doc._id, { guestToken });
      }

      const guestLink    = `${frontendUrl}/doctor-summary/${guestToken}`;
      const hospitalName = doc.hospitalId?.shortName || doc.hospitalId?.name || 'Hospital';

      // Build session lines
      const sessionLines = doc.sessions
        .filter(s => s.isActive && s.dayOfWeek === nowIST().day())
        .map(s => `  • ${s.sessionName}: ${s.startTime} - ${s.endTime}`)
        .join('\n');

      const message =
        `🌅 Good Morning, Dr. ${doc.name.replace(/^Dr\.?\s*/i, '')}!\n` +
        `${hospitalName} – Today's Schedule:\n` +
        `📋 Total Appointments: ${appointments.length}\n` +
        (sessionLines ? `Sessions:\n${sessionLines}\n` : '') +
        `🔗 View Details: ${guestLink}`;

      // Send SMS
      sendHospitalSms({
        hospitalId: doc.hospitalId?._id,
        to: doc.phone,
        message
      }).catch(err => console.error(`❌ Morning brief SMS failed for Dr. ${doc.name}:`, err));

      // Send WhatsApp if enabled
      if (doc.hospitalId?.whatsapp?.enabled) {
        const { sendCustomMessage } = require('./whatsapp');
        sendCustomMessage(doc.hospitalId, { phone: doc.phone, name: doc.name }, message)
          .catch(() => {});
      }

      console.log(`✅ Sent 8 AM morning brief to Dr. ${doc.name} (${appointments.length} appointments today)`);
    }
  } catch (err) {
    console.error('❌ Error processing morning doctor brief:', err);
  }
}

// ─── PRE-SESSION 2-HOUR REMINDER ─────────────────────────────────────────────
// Runs every 10 minutes.
// Sends a reminder exactly 2 hours before each session starts.

async function processSessionReminders() {
  console.log('⏳ Checking for 2-hour pre-session reminders...');

  try {
    const Appointment = require('../models/Appointment');
    const { start: todayStart, end: todayEnd } = todayRangeIST();
    const now      = nowIST();
    const dayOfWeek = now.day();

    const PRE_SESSION_MINUTES = 120; // Fixed 2-hour lead time

    const doctors = await Doctor.find({ isActive: true }).populate('hospitalId');

    for (const doc of doctors) {
      if (!doc.phone) continue;

      const todaySessions = (doc.sessions || []).filter(
        s => s.isActive && s.dayOfWeek === dayOfWeek
      );

      for (const s of todaySessions) {
        if (!s.startTime) continue;

        const [hour, minute] = s.startTime.split(':').map(Number);
        // Build session start moment in IST for today
        const sessionStart = moment().utcOffset('+05:30').set({ hour, minute, second: 0, millisecond: 0 });

        const diffMinutes = sessionStart.diff(now, 'minutes');

        // Fire within the 10-minute cron window around the 2-hour mark
        if (diffMinutes >= PRE_SESSION_MINUTES - 5 && diffMinutes < PRE_SESSION_MINUTES + 5) {
          // Count booked patients for this session today
          const bookedCount = await Appointment.countDocuments({
            doctor: doc._id,
            appointmentDate: { $gte: todayStart, $lte: todayEnd },
            status: { $in: ['booked', 'checked-in'] }
          });

          if (bookedCount === 0) {
            console.log(`ℹ️  Skipping 2-hr reminder for Dr. ${doc.name} – 0 patients booked`);
            continue;
          }

          const hospitalName = doc.hospitalId?.shortName || doc.hospitalId?.name || 'Hospital';
          const msg =
            `⏰ ${hospitalName}: Dr. ${doc.name.replace(/^Dr\.?\s*/i, '')}, ` +
            `your ${s.sessionName || 'session'} starts at ${s.startTime} (in 2 hours). ` +
            `You have ${bookedCount} patient${bookedCount !== 1 ? 's' : ''} booked.`;

          // SMS
          sendHospitalSms({
            hospitalId: doc.hospitalId?._id,
            to: doc.phone,
            message: msg
          }).catch(err => console.error(`❌ Pre-session SMS failed for Dr. ${doc.name}:`, err));

          // WhatsApp
          if (doc.hospitalId?.whatsapp?.enabled) {
            const { sendCustomMessage } = require('./whatsapp');
            sendCustomMessage(doc.hospitalId, { phone: doc.phone, name: doc.name }, msg)
              .catch(() => {});
          }

          console.log(`✅ Sent 2-hr pre-session reminder to Dr. ${doc.name} (${bookedCount} patients)`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing pre-session reminders:', err);
  }
}

// ─── END-OF-DAY DOCTOR SESSION SUMMARY ───────────────────────────────────────
// Runs every 10 minutes and fires when the clock matches each doctor's
// preferred summary send time (default 19:00).

async function processDoctorSessionSummaries() {
  console.log('⏳ Checking for end-of-day doctor session summaries...');

  try {
    const Appointment = require('../models/Appointment');
    const crypto      = require('crypto');
    const now         = nowIST();
    const currentMinutes = now.hour() * 60 + now.minute();
    const { start: todayStart, end: todayEnd } = todayRangeIST();
    const frontendUrl = process.env.FRONTEND_URL || 'https://echanneling-hospital.live';

    const doctors = await Doctor.find({ isActive: true }).populate('hospitalId');

    for (const doc of doctors) {
      if (!doc.phone) continue;
      if (!doc.notificationSettings?.notifySessionSummary) continue;

      const sendTime    = doc.notificationSettings?.summarySendTime || '19:00';
      const [sendHour, sendMin] = sendTime.split(':').map(Number);
      const targetMinutes = sendHour * 60 + sendMin;

      // Check if we are within a 10-minute window of the scheduled send time
      if (currentMinutes < targetMinutes || currentMinutes >= targetMinutes + 10) continue;

      const appointments = await Appointment.find({
        doctor: doc._id,
        appointmentDate: { $gte: todayStart, $lte: todayEnd }
      }).populate('patient', 'name phone');

      const totalBooked  = appointments.length;
      if (totalBooked === 0) continue; // Nothing to summarise

      const completed    = appointments.filter(a => a.status === 'completed');
      const totalChecked = completed.length;
      const totalRevenue = completed.reduce((sum, a) => sum + (a.fees?.doctorFee || 0), 0);

      // Ensure guest token
      let guestToken = doc.guestToken;
      if (!guestToken) {
        guestToken = crypto.randomBytes(20).toString('hex');
        await Doctor.findByIdAndUpdate(doc._id, { guestToken });
      }

      const guestLink    = `${frontendUrl}/doctor-summary/${guestToken}`;
      const currency     = doc.hospitalId?.payment?.currencySymbol || 'Rs.';
      const hospitalName = doc.hospitalId?.shortName || doc.hospitalId?.name || 'Hospital';

      const message =
        `📊 ${hospitalName}\n` +
        `End-of-Day Summary – Dr. ${doc.name.replace(/^Dr\.?\s*/i, '')}\n` +
        `✅ Checked: ${totalChecked}/${totalBooked} patients\n` +
        `💰 Revenue: ${currency} ${totalRevenue.toLocaleString()}\n` +
        `🔗 Full Report: ${guestLink}`;

      // SMS
      sendHospitalSms({
        hospitalId: doc.hospitalId?._id,
        to: doc.phone,
        message
      }).catch(err => console.error(`❌ End-of-day SMS failed for Dr. ${doc.name}:`, err));

      // WhatsApp
      if (doc.hospitalId?.whatsapp?.enabled) {
        const { sendCustomMessage } = require('./whatsapp');
        sendCustomMessage(doc.hospitalId, { phone: doc.phone, name: doc.name }, message)
          .catch(() => {});
      }

      console.log(`✅ Sent end-of-day summary to Dr. ${doc.name} (${totalChecked}/${totalBooked} patients, ${currency} ${totalRevenue})`);
    }
  } catch (err) {
    console.error('❌ Error processing doctor session summaries:', err);
  }
}

// ─── SCHEDULER ───────────────────────────────────────────────────────────────

function startReminderScheduler() {
  // Patient follow-up reminders – every day at 8:00 AM IST
  cron.schedule('0 8 * * *', processFollowUpReminders, { timezone: 'Asia/Colombo' });

  // 8 AM morning doctor brief – every day at 8:00 AM IST
  cron.schedule('0 8 * * *', processMorningDoctorBrief, { timezone: 'Asia/Colombo' });

  // Pre-session 2-hour reminder – every 10 minutes
  cron.schedule('*/10 * * * *', processSessionReminders);

  // End-of-day doctor session summary – every 10 minutes (matches doctor's scheduled send time)
  cron.schedule('*/10 * * * *', processDoctorSessionSummaries);

  console.log('✅ Automated Reminder Scheduler Started');
  console.log('   📋 8:00 AM IST – Patient follow-up reminders');
  console.log('   🌅 8:00 AM IST – Doctor morning brief (if appointments exist)');
  console.log('   ⏰ Every 10 min – 2-hour pre-session reminder to doctors');
  console.log('   📊 Every 10 min – End-of-day doctor session summary');
}

module.exports = {
  startReminderScheduler,
  processFollowUpReminders,
  processMorningDoctorBrief,
  processSessionReminders,
  processDoctorSessionSummaries
};
