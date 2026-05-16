/**
 * TEXT.LK SMS GATEWAY INTEGRATION
 * =================================
 * Sri Lanka's SMS gateway - https://text.lk
 *
 * API: POST https://app.text.lk/api/v3/sms/send
 * Auth: Bearer token
 * Docs: https://text.lk/docs/send-sms/
 *
 * Fields:
 *   recipient  - Phone number(s) with country code, no +
 *                e.g. "94771234567" or "94771234567,94701234567"
 *   sender_id  - Your sender ID (max 11 chars, alphanumeric)
 *   type       - "plain" (default) or "unicode" for Sinhala/Tamil
 *   message    - SMS text content
 *   schedule_time - Optional: "YYYY-MM-DD HH:MM" to schedule
 */
const axios = require('axios');

const TEXT_LK_API = 'https://app.text.lk/api/v3/sms/send';

/**
 * Format a Sri Lankan phone number for text.lk
 * Accepts: 0771234567, +94771234567, 94771234567, 771234567
 * Returns: 94771234567
 */
function formatPhone(phone) {
  if (!phone) return null;
  // Handle comma-separated strings (multi-recipients)
  if (typeof phone === 'string' && phone.includes(',')) {
    return phone.split(',')
      .map(p => formatPhone(p.trim()))
      .filter(Boolean)
      .join(',');
  }

  let p = phone.toString().replace(/\s+|-/g, '').trim().replace(/\+/g, '');
  if (p.startsWith('0'))  p = '94' + p.slice(1);
  // If it's a 9 digit number like 771234567, prepend 94
  if (p.length === 9) p = '94' + p;
  
  return p;
}

/**
 * Send SMS via text.lk
 * @param {Object} opts
 * @param {string|string[]} opts.to       - Phone number(s)
 * @param {string}          opts.message  - SMS text
 * @param {string}          opts.apiKey   - text.lk API key (Bearer token)
 * @param {string}          opts.senderId - Sender ID shown on phone (max 11 chars)
 * @param {string}          [opts.type]   - 'plain' (default) or 'unicode'
 * @param {string}          [opts.scheduleTime] - 'YYYY-MM-DD HH:MM'
 */
async function sendSms({ to, message, apiKey, senderId, type = 'plain', scheduleTime }) {
  if (!apiKey) throw new Error('text.lk API key is required');
  if (!to || !message) throw new Error('Recipient and message are required');

  // Format recipient(s) - now handles strings, arrays, and comma-separated values
  const recipients = Array.isArray(to)
    ? to.map(formatPhone).filter(Boolean).join(',')
    : formatPhone(to);

  if (!recipients) throw new Error('No valid phone numbers provided');

  // Auto-detect unicode for Sinhala/Tamil characters
  const isUnicode = /[^\x00-\x7F]/.test(message);
  const finalType = type === 'unicode' || isUnicode ? 'unicode' : 'plain';

  const payload = {
    recipient: recipients,
    sender_id: (senderId || 'HOSPITAL').slice(0, 11),
    type:      finalType,
    message,
  };
  if (scheduleTime) payload.schedule_time = scheduleTime;

  const response = await axios.post(TEXT_LK_API, payload, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
      'Accept':        'application/json',
    },
    timeout: 15000,
  });

  return response.data;
}

// ── Hospital-aware SMS sender ──────────────────────────────────────
// Reads settings from the hospital's SMS config or falls back to system settings

async function sendHospitalSms({ hospitalId, to, message, type = 'plain', templateType, templateData }) {
  console.log(`[SMS-LOG] Attempting to send SMS to ${to}...`);
  const Hospital = require('../models/Hospital');
  const { SystemSettings } = require('../models/SystemSettings');

  // Try hospital-level SMS config first
  let apiKey, senderId, hospital;
  if (hospitalId) {
    hospital = await Hospital.findById(hospitalId);
    if (hospital?.sms?.enabled && (hospital?.sms?.textLkApiKey || hospital?.sms?.apiKey || hospital?.sms?.apiSecret)) {
      apiKey   = (hospital.sms.textLkApiKey || hospital.sms.apiKey || hospital.sms.apiSecret || '').trim();
      senderId = (hospital.sms.senderId || hospital.shortName || hospital.name?.slice(0,11) || 'HOSPITAL').trim();
    }
  }

  // Fall back to system-level SMS config
  if (!apiKey) {
    const settings = await SystemSettings.findOne({});
    if (settings?.sms?.enabled && (settings?.sms?.textLkApiKey || settings?.sms?.apiKey || settings?.sms?.apiSecret)) {
      apiKey   = (settings.sms.textLkApiKey || settings.sms.apiKey || settings.sms.apiSecret || '').trim();
      senderId = (settings.sms.senderId || 'ECHANNELING').trim();
    }
  }

  // Handle Dynamic Template
  let finalMessage = message;
  if (templateType && hospital?.sms?.templates?.[templateType]) {
    // Basic string interpolation: replace {Field} with data.Field
    let custom = hospital.sms.templates[templateType];
    const keys = Object.keys(templateData || {});
    keys.forEach(k => {
      const reg = new RegExp(`\\{${k}\\}`, 'gi');
      custom = custom.replace(reg, templateData[k]);
    });
    finalMessage = custom;
  } else if (templateType && templates[templateType]) {
    // Fall back to system default template function
    finalMessage = templates[templateType](templateData);
  }

  if (!apiKey) {
    console.warn('⚠️  SMS not sent: no text.lk API key configured');
    const MessageLog = require('../models/MessageLog');
    await MessageLog.create({
      hospitalId,
      type: 'sms',
      recipient: to,
      message: finalMessage,
      status: 'skipped',
      error: 'SMS not configured'
    }).catch(() => {});
    return { skipped: true, reason: 'SMS not configured' };
  }

  const MessageLog = require('../models/MessageLog');
  try {
    console.log(`📡 Sending SMS to ${to} (Formatted: ${formatPhone(to)})`);
    console.log(`   Message: ${finalMessage.slice(0, 50)}...`);
    console.log(`   Sender: ${senderId}, Key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);
    
    const result = await sendSms({ 
      to, 
      message: finalMessage, 
      apiKey: apiKey.replace(/^Bearer\s+/i, ''), // Clean redundant Bearer prefix
      senderId, 
      type 
    });
    
    await MessageLog.create({
      hospitalId,
      type: 'sms',
      recipient: to,
      message: finalMessage,
      status: (result?.status === 'success' || result?.status === true || result?.message === 'Success') ? 'sent' : 'failed',
      provider: 'textlk',
      providerResponse: result,
      error: (result?.status !== 'success' && result?.message) ? result.message : null,
      metadata: { templateType, ...templateData }
    }).catch(e => console.error('Log Error:', e.message));

    console.log(`✅ SMS status from text.lk for ${to}:`, result);
    return result;
  } catch (err) {
    const errorData = err.response?.data || err.message;
    console.error(`❌ SMS failed to ${to}:`, errorData);

    await MessageLog.create({
      hospitalId,
      type: 'sms',
      recipient: to,
      message: finalMessage,
      status: 'failed',
      provider: 'textlk',
      error: typeof errorData === 'string' ? errorData : JSON.stringify(errorData),
      metadata: { templateType, ...templateData }
    }).catch(e => console.error('Log Error:', e.message));

    throw err;
  }
}

// ── Pre-built message templates (System Defaults) ──────────────────

const templates = {
  booking: ({ patientName, queueNumber, doctorName, hospitalName, date, time, sym, fee, trackUrl }) =>
    `${hospitalName}\n` +
    `Hi ${patientName} \n` +
    `Your booking confirmed with Dr ${doctorName},\n` +
    `Date: ${date} and Time ${time || 'TBD'}\n` +
    `Queue number : ${queueNumber}\n` +
    `Fee : Rs ${fee}\n` +
    `You can track ongoing number using below link ${trackUrl}`,

  arrival: ({ hospitalName, doctorName, patientName, arrivalTime, queueNumber, trackUrl }) =>
    `${hospitalName}\n` +
    `Hi ${patientName}, \n` +
    ` Dr ${doctorName} arrived at ${arrivalTime}\n` +
    `Your number : ${queueNumber} Please arrive on time,\n` +
    `You can track ongoing number using below link ${trackUrl}`,

  turn: ({ patientName, queueNumber, patientsAhead, hospitalName, doctorName }) =>
    `${hospitalName}: ${patientName}, ` +
    `your turn is near!\n` +
    `Queue #${queueNumber} - ${patientsAhead} patient(s) before you.\n` +
    `Please proceed to ${doctorName}'s room.`,

  refund: ({ patientName, amount, sym, doctorName, hospitalName }) =>
    `${hospitalName}: Dear ${patientName}, ` +
    `your refund of ${sym} ${amount} (Dr. ${doctorName} consultation fee) ` +
    `has been approved. Please collect from reception.`,

  password: ({ name, password, hospitalName }) =>
    `${hospitalName}: Dear ${name}, ` +
    `your portal password has been reset to: ${password}\n` +
    `Please change it after logging in.`,

  late: ({ hospitalName, doctorName, patientName, expectedTime, sessionLabel }) =>
    `${hospitalName}: Hi ${patientName}, Dr ${doctorName} is arriving late for the ${sessionLabel || 'session'}.\n` +
    `Expected time: ${expectedTime}.\n` +
    `We apologize for the inconvenience.`,

  cancel: ({ hospitalName, doctorName, patientName, reason, sessionLabel, date }) =>
    `${hospitalName}: Hi ${patientName}, the session with Dr ${doctorName} on ${date} (${sessionLabel || 'session'}) has been cancelled.\n` +
    `Reason: ${reason}.\n` +
    `Please contact us to reschedule.`,

  reminder: ({ hospitalName, doctorName, patientName, date, time }) =>
    `${hospitalName}: Hi ${patientName}, your follow-up with Dr ${doctorName} is on ${date}${time ? ' at '+time : ''}.\n` +
    `Please book your number early.`,

  change: ({ hospitalName, doctorName, patientName, newDate, newTime, queueNumber }) =>
    `${hospitalName}: Hi ${patientName}, your appointment with Dr ${doctorName} has been moved to ${newDate} (${newTime || 'Session'}).\n` +
    `Your new Queue Number is #${queueNumber}.\n` +
    `We apologize for the schedule change.`,
};

// Aliases for backward compatibility
templates.bookingConfirmation = templates.booking;
templates.doctorArrived = templates.arrival;
templates.turnAlert = templates.turn;
templates.refundApproved = templates.refund;
templates.passwordReset = templates.password;

module.exports = { sendSms, sendHospitalSms, formatPhone, templates };
