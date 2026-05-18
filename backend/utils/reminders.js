const cron = require('node-cron');
const moment = require('moment');
const Prescription = require('../models/Prescription');
const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const { sendHospitalSms } = require('./sms');

async function processFollowUpReminders() {
  console.log('⏳ Running Follow-Up Reminders Check...');
  
  try {
    const todayStart = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    const threeDaysFromNowStart = moment().add(3, 'days').startOf('day').toDate();
    const threeDaysFromNowEnd = moment().add(3, 'days').endOf('day').toDate();

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
        patientName: p.patient.name,
        doctorName: p.doctor?.name || 'your doctor',
        date: moment(p.followUpDate).format('YYYY-MM-DD')
      };
      
      // Send SMS
      await sendHospitalSms({
        hospitalId: hospital?._id,
        to: p.patient.phone,
        templateType: 'reminder',
        templateData
      });

      // Send WhatsApp if enabled
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
        patientName: p.patient.name,
        doctorName: p.doctor?.name || 'your doctor',
        date: 'TODAY'
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

async function processDoctorSessionSummaries() {
  console.log('⏳ Checking for doctor session notifications and summaries...');
  try {
    const Appointment = require('../models/Appointment');
    const now = moment();
    const currentHour = now.hour();
    const currentMin = now.minute();
    const currentMinutes = currentHour * 60 + currentMin;
    
    // Find all active doctors
    const doctors = await Doctor.find({ isActive: true }).populate('hospitalId');
    
    for (const doc of doctors) {
      if (!doc.notificationSettings?.notifySessionSummary) continue;
      
      const leadTime = doc.notificationSettings.summaryLeadTimeMinutes || 60;
      const today = moment().startOf('day').toDate();
      const todayEnd = moment().endOf('day').toDate();
      const dayOfWeek = moment().day();

      // ─── PART 1: Given Daily Summary Time Check ──────────────────
      const docSendTime = doc.notificationSettings?.summarySendTime || "19:00";
      const [sendHour, sendMin] = docSendTime.split(':').map(Number);
      const targetMinutes = sendHour * 60 + sendMin;

      // Check if we are inside the 10 min window of the daily summary send time
      if (currentMinutes >= targetMinutes && currentMinutes < targetMinutes + 10) {
        const appointments = await Appointment
          .find({ doctor: doc._id, appointmentDate: { $gte: today, $lte: todayEnd } })
          .populate('patient', 'name phone');

        const completedApts = appointments.filter(a => a.status === 'completed');
        const totalChecked = completedApts.length;
        const totalRevenue = completedApts.reduce((sum, a) => sum + (a.fees?.doctorFee || 0), 0);
        const totalBooked = appointments.length;

        const currency = doc.hospitalId?.payment?.currencySymbol || 'Rs.';
        const hospitalName = doc.hospitalId?.shortName || doc.hospitalId?.name || 'Hospital';
        const frontendUrl = process.env.FRONTEND_URL || 'https://echanneling-hospital.live';
        const loginLink = `${frontendUrl}/login`;

        const smsMessage = 
          `Daily Summary: ${hospitalName}\n` +
          `Dear Dr. ${doc.name},\n` +
          `Here is a summary of your sessions today:\n` +
          `📅 Total Booked: ${totalBooked}\n` +
          `✅ Patients Checked: ${totalChecked}\n` +
          `💰 Total Doctor Revenue: ${currency} ${totalRevenue.toLocaleString()}\n` +
          `🔗 Portal Login: ${loginLink}`;

        // SMS
        sendHospitalSms({
          hospitalId: doc.hospitalId?._id,
          to: doc.phone,
          message: smsMessage
        }).catch(err => console.error('Daily Doctor SMS summary failed:', err));

        // WhatsApp
        if (doc.hospitalId?.whatsapp?.enabled) {
          const { sendCustomMessage } = require('./whatsapp');
          sendCustomMessage(doc.hospitalId, { phone: doc.phone, name: doc.name }, smsMessage).catch(() => {});
        }

        console.log(`✅ Sent today's daily session summary to Dr. ${doc.name} at ${docSendTime}`);
      }
      
      // ─── PART 2: Upcoming Session Lead Time Reminder ─────────────
      const sessions = (doc.sessions || []).filter(s => s.dayOfWeek === dayOfWeek && s.isActive);
      
      for (const s of sessions) {
        if (!s.startTime) continue;
        
        // Calculate session start time today
        const [hour, min] = s.startTime.split(':');
        const sessionStart = moment().set({ hour, minute: min, second: 0 });
        
        // If session starts in exactly 'leadTime' (within 10 min window)
        const diff = sessionStart.diff(now, 'minutes');
        
        if (diff > leadTime - 10 && diff <= leadTime) {
          const patientCount = await Appointment.countDocuments({
            doctor: doc._id,
            appointmentDate: today,
            sessionId: s._id || `${s.sessionName}-${s.startTime}`,
            status: 'booked'
          });

          const hospitalName = doc.hospitalId?.shortName || doc.hospitalId?.name || 'Hospital';
          const msg = `${hospitalName}: Dr. ${doc.name.replace('Dr. ','')}, your ${s.sessionName || 'session'} starts in ${leadTime} mins. You have ${patientCount} patients booked for this session.`;

          // SMS
          sendHospitalSms({
            hospitalId: doc.hospitalId?._id,
            to: doc.phone,
            message: msg
          }).catch(() => {});

          // WhatsApp
          if (doc.hospitalId?.whatsapp?.enabled) {
            const { sendCustomMessage } = require('./whatsapp');
            sendCustomMessage(doc.hospitalId, { phone: doc.phone, name: doc.name }, msg).catch(() => {});
          }
          
          console.log(`✅ Sent upcoming session lead reminder to Dr. ${doc.name} (${patientCount} patients)`);
        }
      }
    }
  } catch (err) {
    console.error('❌ Error processing doctor summaries:', err);
  }
}

function startReminderScheduler() {
  // Run patient follow-up reminders every morning at 8:00 AM
  cron.schedule('0 8 * * *', processFollowUpReminders);
  
  // Run doctor session summaries every 10 minutes
  cron.schedule('*/10 * * * *', processDoctorSessionSummaries);
  
  console.log('✅ Automated Reminder Scheduler Started');
}

module.exports = { startReminderScheduler, processFollowUpReminders, processDoctorSessionSummaries };
