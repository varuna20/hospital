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
      const docName = p.doctor?.name || 'your doctor';
      const dateStr = moment(p.followUpDate).format('YYYY-MM-DD');
      const bookingLink = `${process.env.FRONTEND_URL || 'https://echanneling.app'}/login/${hospital?.slug || ''}`;
      
      const msg = `Reminder from ${hospital?.name || 'Hospital'}: You have a follow-up appointment with Dr. ${docName} in 3 days (${dateStr}). Book your number here: ${bookingLink}`;
      
      await sendHospitalSms({
        hospitalId: hospital?._id,
        to: p.patient.phone,
        templateType: 'custom',
        customText: msg
      });
      
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
      const docName = p.doctor?.name || 'your doctor';
      const bookingLink = `${process.env.FRONTEND_URL || 'https://echanneling.app'}/login/${hospital?.slug || ''}`;
      
      const msg = `Reminder from ${hospital?.name || 'Hospital'}: Your follow-up appointment with Dr. ${docName} is TODAY. Please book your number early: ${bookingLink}`;
      
      await sendHospitalSms({
        hospitalId: hospital?._id,
        to: p.patient.phone,
        templateType: 'custom',
        customText: msg
      });
      
      p.reminderSent.dayOf = true;
      await p.save();
    }
    
    console.log(`✅ Processed Reminders: ${threeDayPrescriptions.length} (3-day), ${dayOfPrescriptions.length} (Day-of)`);
  } catch (err) {
    console.error('❌ Error processing reminders:', err);
  }
}

function startReminderScheduler() {
  // Run every morning at 8:00 AM
  cron.schedule('0 8 * * *', processFollowUpReminders);
  console.log('✅ Automated Reminder Scheduler Started (Runs at 8:00 AM daily)');
  
  // Also run immediately on startup (for testing purposes, only in development)
  // if (process.env.NODE_ENV !== 'production') {
  //   setTimeout(processFollowUpReminders, 5000);
  // }
}

module.exports = { startReminderScheduler, processFollowUpReminders };
