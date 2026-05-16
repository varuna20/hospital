/**
 * WHATSAPP NOTIFICATION UTILITY
 * ==============================
 * Sends WhatsApp messages via Twilio's API.
 *
 * To use:
 * 1. Create a Twilio account at https://console.twilio.com
 * 2. Enable WhatsApp Sandbox or production number
 * 3. Add credentials to .env or per-hospital settings
 *
 * Message types:
 *  - Booking confirmation
 *  - Turn alert (X people ahead)
 *  - Doctor arrival notification
 *  - Session summary to doctor
 */

const twilio = require('twilio');

// Format phone for WhatsApp: +94771234567 → whatsapp:+94771234567
function formatWhatsApp(phone) {
  if (!phone) return '';
  let p = phone.toString().replace(/\s/g, '').replace(/-/g, '').replace(/\+/g, '');
  
  // If it starts with 0, replace with 94
  if (p.startsWith('0')) p = '94' + p.slice(1);
  // If it doesn't start with 94 and is 9 digits (SL number), add 94
  else if (!p.startsWith('94') && p.length === 9) p = '94' + p;
  
  return `whatsapp:+${p}`;
}

/**
 * Get Twilio client for a hospital
 * Uses hospital-specific credentials if set, else global .env
 */
function getClient(hospital) {
  const wa = hospital?.whatsapp;
  const sid   = wa?.twilioSid   || process.env.TWILIO_ACCOUNT_SID;
  const token = wa?.twilioToken || process.env.TWILIO_AUTH_TOKEN;

  if (!sid || !token || sid.startsWith('AC___')) return null;

  try {
    return twilio(sid, token);
  } catch {
    return null;
  }
}

function getFromNumber(hospital) {
  const raw = hospital?.whatsapp?.fromNumber || process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
  // Ensure from number has whatsapp: prefix to match the channel
  return raw.startsWith('whatsapp:') ? raw : `whatsapp:${raw}`;
}

/**
 * Core send function
 */
async function sendWhatsApp(hospital, to, message, templateType, templateData) {
  const MessageLog = require('../models/MessageLog');
  const hospitalId = hospital?._id;

  if (!hospital?.whatsapp?.enabled) {
    return { sent: false, reason: 'WhatsApp disabled' };
  }
  
  let finalMessage = message;
  
  // Custom Template Logic
  if (templateType && hospital?.whatsapp?.templates?.[templateType]) {
    let custom = hospital.whatsapp.templates[templateType];
    const keys = Object.keys(templateData || {});
    keys.forEach(k => {
      const reg = new RegExp(`\\{${k}\\}`, 'gi');
      custom = custom.replace(reg, templateData[k]);
    });
    finalMessage = custom;
  }

  if (!to || !finalMessage) return { sent: false, reason: 'Missing to/message' };

  const client = getClient(hospital);
  if (!client) {
    await MessageLog.create({
      hospitalId, type: 'whatsapp', recipient: to, message: finalMessage, status: 'failed', error: 'Twilio not configured'
    }).catch(() => {});
    return { sent: false, reason: 'Twilio not configured' };
  }

  try {
    const result = await client.messages.create({
      body: finalMessage,
      from: getFromNumber(hospital),
      to:   formatWhatsApp(to)
    });
    
    await MessageLog.create({
      hospitalId, type: 'whatsapp', recipient: to, message: finalMessage, status: 'sent', provider: 'twilio',
      providerResponse: { sid: result.sid, status: result.status }
    }).catch(() => {});

    return { sent: true, sid: result.sid };
  } catch (err) {
    await MessageLog.create({
      hospitalId, type: 'whatsapp', recipient: to, message: finalMessage, status: 'failed', provider: 'twilio', error: err.message
    }).catch(() => {});
    return { sent: false, reason: err.message };
  }
}

// ── Pre-built message templates ────────────────────────────────────

/**
 * Send booking confirmation to patient
 */
async function sendBookingConfirmation(hospital, patient, appointment, doctor) {
  const data = {
    hospitalName: hospital.name,
    patientName: patient.name,
    doctorName: doctor.name,
    specialization: doctor.specialization,
    date: new Date(appointment.appointmentDate).toLocaleDateString('en-GB'),
    queueNumber: appointment.queueNumber,
    room: doctor.room || 'See display screen',
    sym: hospital.payment?.currencySymbol || 'Rs.',
    fee: appointment.fees?.totalAmount || 0,
    address: hospital.address || ''
  };

  const defaultMsg =
    `🏥 *${data.hospitalName}*\n\n` +
    `✅ *Appointment Confirmed!*\n\n` +
    `👤 Patient: ${data.patientName}\n` +
    `🩺 Doctor: ${data.doctorName}\n` +
    `🔬 ${data.specialization}\n` +
    `📅 Date: ${data.date}\n` +
    `🔢 Queue Number: *${data.queueNumber}*\n` +
    `🏠 Room: ${data.room}\n\n` +
    `💰 Total Fee: ${data.sym} ${data.fee}\n\n` +
    `⏱ Please arrive early. Your queue number will be called.\n` +
    `📍 ${data.address}`;

  return sendWhatsApp(hospital, patient.phone, defaultMsg, 'booking', data);
}

/**
 * Notify patient their turn is approaching (X people ahead)
 */
async function sendTurnAlert(hospital, patient, queueNumber, peopleAhead) {
  const data = {
    hospitalName: hospital.name,
    patientName: patient?.name,
    queueNumber,
    peopleAhead
  };

  const defaultMsg =
    `🏥 *${data.hospitalName}*\n\n` +
    `🔔 *Your Turn is Coming Soon!*\n\n` +
    `🔢 Your Queue Number: *${data.queueNumber}*\n` +
    `👥 People ahead of you: *${data.peopleAhead}*\n\n` +
    `⚡ Please be ready — your turn will be called shortly!\n` +
    `📍 Please proceed to the waiting area.`;

  return sendWhatsApp(hospital, patient.phone, defaultMsg, 'turn', data);
}

/**
 * Notify patient doctor has arrived
 */
async function sendDoctorArrival(hospital, patient, doctor) {
  const data = {
    hospitalName: hospital.name,
    patientName: patient?.name,
    doctorName: doctor.name,
    specialization: doctor.specialization,
    room: doctor.room || 'Check display screen'
  };

  const defaultMsg =
    `🏥 *${data.hospitalName}*\n\n` +
    `✅ *Doctor Has Arrived!*\n\n` +
    `🩺 Dr. ${data.doctorName} is now available.\n` +
    `🔬 ${data.specialization}\n` +
    `🏠 Room: ${data.room}\n\n` +
    `⏰ The session will begin shortly. Please ensure you are at the clinic.`;

  return sendWhatsApp(hospital, patient.phone, defaultMsg, 'arrival', data);
}

/**
 * Send session summary to doctor before they start
 */
async function sendDoctorSessionSummary(hospital, doctor, appointments) {
  // Doctor summary is usually fixed/system level, but we use sendWhatsApp directly
  const total    = appointments.length;
  const arrived  = appointments.filter(a => a.status === 'arrived').length;
  const booked   = appointments.filter(a => a.status === 'booked').length;
  const totalRev = appointments.reduce((s, a) => s + (a.fees?.doctorFee || 0), 0);
  const currency = hospital.payment?.currencySymbol || 'Rs.';

  const msg =
    `🏥 *${hospital.name}*\n` +
    `📋 *SESSION SUMMARY*\n\n` +
    `👨‍⚕️ Doctor: *${doctor.name}*\n` +
    `📊 Total: *${total}* patients\n` +
    `✅ Arrived: ${arrived} / Booked: ${booked}\n` +
    `💰 Revenue: ${currency} ${totalRev.toLocaleString()}\n\n` +
    `🚀 Have a great session!`;

  return sendWhatsApp(hospital, doctor.phone, msg);
}

/**
 * Notify about delay
 */
async function sendDelayAlert(hospital, patient, doctor, expectedTime, sessionLabel) {
  const data = {
    hospitalName: hospital.name,
    patientName: patient?.name,
    doctorName: doctor.name,
    expectedTime,
    sessionLabel: sessionLabel || 'session'
  };

  const defaultMsg =
    `🏥 *${data.hospitalName}*\n\n` +
    `⏳ *Doctor Arriving Late*\n\n` +
    `🩺 Dr. ${data.doctorName} is delayed for the ${data.sessionLabel}.\n` +
    `⏰ Expected Time: *${data.expectedTime}*\n\n` +
    `🙏 We appreciate your patience.`;

  return sendWhatsApp(hospital, patient.phone, defaultMsg, 'late', data);
}

/**
 * Notify about cancellation
 */
async function sendCancellationAlert(hospital, patient, doctor, reason, sessionLabel) {
  const data = {
    hospitalName: hospital.name,
    patientName: patient?.name,
    doctorName: doctor.name,
    reason: reason || 'Unavoidable circumstances',
    sessionLabel: sessionLabel || 'session'
  };

  const defaultMsg =
    `🏥 *${data.hospitalName}*\n\n` +
    `❌ *Session Cancelled*\n\n` +
    `🩺 Dr. ${data.doctorName}'s session (${data.sessionLabel}) today has been cancelled.\n` +
    `📝 Reason: ${data.reason}\n\n` +
    `📞 Please contact reception to reschedule.`;

  return sendWhatsApp(hospital, patient.phone, defaultMsg, 'cancel', data);
}

/**
 * Send custom message
 */
async function sendCustomMessage(hospital, patient, message) {
  const msg =
    `🏥 *${hospital.name}*\n\n` +
    `${message}`;

  return sendWhatsApp(hospital, patient.phone, msg);
}

module.exports = {
  sendWhatsApp,
  sendBookingConfirmation,
  sendTurnAlert,
  sendDoctorArrival,
  sendDoctorSessionSummary,
  sendDelayAlert,
  sendCancellationAlert,
  sendCustomMessage
};

