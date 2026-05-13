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
async function sendWhatsApp(hospital, to, message) {
  const MessageLog = require('../models/MessageLog');
  const hospitalId = hospital?._id;

  if (!hospital?.whatsapp?.enabled) {
    await MessageLog.create({
      hospitalId,
      type: 'whatsapp',
      recipient: to,
      message,
      status: 'skipped',
      error: 'WhatsApp disabled for this hospital'
    }).catch(() => {});
    return { sent: false, reason: 'WhatsApp disabled for this hospital' };
  }
  
  if (!to) return { sent: false, reason: 'No phone number' };

  const client = getClient(hospital);
  if (!client) {
    await MessageLog.create({
      hospitalId,
      type: 'whatsapp',
      recipient: to,
      message,
      status: 'failed',
      error: 'Twilio not configured'
    }).catch(() => {});
    return { sent: false, reason: 'Twilio not configured' };
  }

  try {
    const result = await client.messages.create({
      body: message,
      from: getFromNumber(hospital),
      to:   formatWhatsApp(to)
    });
    
    await MessageLog.create({
      hospitalId,
      type: 'whatsapp',
      recipient: to,
      message,
      status: 'sent',
      provider: 'twilio',
      providerResponse: { sid: result.sid, status: result.status }
    }).catch(() => {});

    console.log(`✅ WhatsApp sent to ${to}: ${result.sid}`);
    return { sent: true, sid: result.sid };
  } catch (err) {
    console.error(`❌ WhatsApp error to ${to}:`, err.message);
    
    await MessageLog.create({
      hospitalId,
      type: 'whatsapp',
      recipient: to,
      message,
      status: 'failed',
      provider: 'twilio',
      error: err.message
    }).catch(() => {});

    return { sent: false, reason: err.message };
  }
}

// ── Pre-built message templates ────────────────────────────────────

/**
 * Send booking confirmation to patient
 */
async function sendBookingConfirmation(hospital, patient, appointment, doctor) {
  const msg =
    `🏥 *${hospital.name}*\n\n` +
    `✅ *Appointment Confirmed!*\n\n` +
    `👤 Patient: ${patient.name}\n` +
    `🩺 Doctor: ${doctor.name}\n` +
    `🔬 ${doctor.specialization}\n` +
    `📅 Date: ${new Date(appointment.appointmentDate).toLocaleDateString('en-GB')}\n` +
    `🔢 Queue Number: *${appointment.queueNumber}*\n` +
    `🏠 Room: ${doctor.room || 'See display screen'}\n\n` +
    `💰 Total Fee: ${hospital.payment?.currencySymbol || 'Rs.'} ${appointment.fees?.totalAmount || 0}\n\n` +
    `⏱ Please arrive early. Your queue number will be called.\n` +
    `📍 ${hospital.address || ''}`;

  return sendWhatsApp(hospital, patient.phone, msg);
}

/**
 * Notify patient their turn is approaching (X people ahead)
 */
async function sendTurnAlert(hospital, patient, queueNumber, peopleAhead) {
  const msg =
    `🏥 *${hospital.name}*\n\n` +
    `🔔 *Your Turn is Coming Soon!*\n\n` +
    `🔢 Your Queue Number: *${queueNumber}*\n` +
    `👥 People ahead of you: *${peopleAhead}*\n\n` +
    `⚡ Please be ready — your turn will be called shortly!\n` +
    `📍 Please proceed to the waiting area.`;

  return sendWhatsApp(hospital, patient.phone, msg);
}

/**
 * Notify patient doctor has arrived
 */
async function sendDoctorArrival(hospital, patient, doctor) {
  const msg =
    `🏥 *${hospital.name}*\n\n` +
    `✅ *Doctor Has Arrived!*\n\n` +
    `🩺 Dr. ${doctor.name} is now available.\n` +
    `🔬 ${doctor.specialization}\n` +
    `🏠 Room: ${doctor.room || 'Check display screen'}\n\n` +
    `⏰ The session will begin shortly. Please ensure you are at the clinic.`;

  return sendWhatsApp(hospital, patient.phone, msg);
}

/**
 * Send session summary to doctor before they start
 * Shows total bookings, breakdown by status
 */
async function sendDoctorSessionSummary(hospital, doctor, appointments) {
  const total    = appointments.length;
  const booked   = appointments.filter(a => a.status === 'booked').length;
  const arrived  = appointments.filter(a => a.status === 'arrived').length;
  const totalRev = appointments.reduce((s, a) => s + (a.fees?.doctorFee || 0), 0);
  const currency = hospital.payment?.currencySymbol || 'Rs.';

  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const patientList = appointments.slice(0, 10).map((a, i) =>
    `  ${i + 1}. [${a.queueNumber}] ${a.patient?.name || 'Patient'}`
  ).join('\n');

  const msg =
    `🏥 *${hospital.name}*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📋 *SESSION SUMMARY*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `👨‍⚕️ Doctor: *${doctor.name}*\n` +
    `🔬 ${doctor.specialization}\n` +
    `📅 ${today}\n\n` +
    `📊 *BOOKINGS TODAY*\n` +
    `• Total: *${total}* patients\n` +
    `• Checked In: ${arrived}\n` +
    `• Yet to Arrive: ${booked}\n\n` +
    `💰 *EXPECTED REVENUE*\n` +
    `• Doctor Fee: ${currency} ${totalRev.toLocaleString()}\n\n` +
    `👥 *PATIENT LIST (First 10)*\n` +
    `${patientList || 'No patients yet'}\n\n` +
    `🚀 Have a great session, Doctor!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  return sendWhatsApp(hospital, doctor.phone, msg);
}

module.exports = {
  sendWhatsApp,
  sendBookingConfirmation,
  sendTurnAlert,
  sendDoctorArrival,
  sendDoctorSessionSummary
};
