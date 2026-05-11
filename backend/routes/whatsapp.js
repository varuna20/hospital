// whatsapp.js - Test, manual send & incoming webhook routes
const express     = require('express');
const router      = express.Router();
const Hospital    = require('../models/Hospital');
const Patient     = require('../models/Patient');
const Appointment = require('../models/Appointment');
const Doctor      = require('../models/Doctor');
const { protect, authorize } = require('../middleware/auth');
const { sendWhatsApp } = require('../utils/whatsapp');

// ── Test WhatsApp connection ─────────────────────────────────────
router.post('/test', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = req.user.role === 'superadmin' ? req.body.hospitalId : req.user.hospitalId._id;
    const hospital   = await Hospital.findById(hospitalId);
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });

    // Debug: log what credentials are being used
    const wa = hospital.whatsapp || {};
    const usedSid  = wa.twilioSid || process.env.TWILIO_ACCOUNT_SID || '(none)';
    const usedFrom = wa.fromNumber || process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886';
    const fromFinal = usedFrom.startsWith('whatsapp:') ? usedFrom : `whatsapp:${usedFrom}`;
    console.log('🔍 WhatsApp Test Debug:');
    console.log('   Account SID:', usedSid.substring(0, 8) + '...');
    console.log('   From Number:', fromFinal);
    console.log('   To Phone:', req.body.testPhone);
    console.log('   WA Enabled:', wa.enabled);

    const { testPhone } = req.body;
    const result = await sendWhatsApp(hospital, testPhone,
      `✅ WhatsApp is configured for *${hospital.name}*!\n\nThis is a test message from your eChanneling system.`
    );

    // Include debug info in response for troubleshooting
    const debugInfo = {
      accountSid: usedSid.substring(0, 8) + '***',
      fromNumber: fromFinal,
      credSource: wa.twilioSid ? 'hospital-settings' : 'env-variable',
      waEnabled: wa.enabled
    };

    res.json({
      success: result.sent,
      message: result.sent ? 'Test message sent!' : result.reason,
      debug: debugInfo
    });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Update WhatsApp settings for a hospital ──────────────────────
router.put('/settings', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = req.user.role === 'superadmin' ? req.body.hospitalId : req.user.hospitalId._id;
    const hospital   = await Hospital.findByIdAndUpdate(
      hospitalId,
      { $set: { whatsapp: req.body.whatsapp } },
      { new: true }
    );
    res.json({ success: true, whatsapp: hospital.whatsapp });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ════════════════════════════════════════════════════════════════════
//  INCOMING WHATSAPP WEBHOOK — Patient Queue Check
// ════════════════════════════════════════════════════════════════════
//
// Twilio posts here when a patient sends a WhatsApp message.
// Patients can send:
//   "status"  or "queue"  → get their latest queue info
//   a queue number (e.g. "15") → get status for that specific number
//   "hi" or "hello"       → get a welcome/help message
//   "help"                → list available commands
//
// Setup in Twilio Console:
//   Messaging → WhatsApp Sandbox → "When a message comes in"
//   URL: https://your-domain.com/api/whatsapp/incoming  (POST)
// ════════════════════════════════════════════════════════════════════

/**
 * Normalize phone: strip whatsapp: prefix and spaces → +94771234567
 */
function normalizePhone(raw) {
  return raw.replace('whatsapp:', '').replace(/\s+/g, '').trim();
}

/**
 * Build a TwiML response for Twilio
 */
function twiml(body) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`;
}

/**
 * Get today's date range (start of day → end of day) in UTC
 */
function todayRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

/**
 * Format appointment status into a user-friendly string
 */
function formatStatus(apt, currentNumber, doctor) {
  const status = apt.status;
  const statusEmoji = {
    'booked': '📋',
    'arrived': '✅',
    'in-progress': '🩺',
    'completed': '✔️',
    'absent': '❌',
    'cancelled': '🚫'
  };

  let msg = `${statusEmoji[status] || '📋'} *Queue #${apt.queueNumber}*\n`;
  msg += `🩺 Dr. ${doctor?.name || 'Doctor'}\n`;
  msg += `📊 Status: *${status.toUpperCase()}*\n`;

  if (status === 'completed') {
    msg += `\n✔️ Your consultation is complete. Thank you!`;
  } else if (status === 'cancelled' || status === 'absent') {
    msg += `\n⚠️ This appointment is ${status}.`;
  } else if (status === 'in-progress') {
    msg += `\n🩺 You are currently being seen by the doctor.`;
  } else {
    // booked or arrived — show queue position
    if (currentNumber > 0) {
      const ahead = Math.max(0, apt.queueNumber - currentNumber);
      if (ahead === 0) {
        msg += `\n🔔 *IT'S YOUR TURN!* Please proceed to the doctor's room.`;
      } else if (ahead <= 3) {
        msg += `\n⏳ *${ahead}* patient(s) ahead of you. Please be ready!`;
      } else {
        msg += `\n⏳ ${ahead} patient(s) ahead of you.`;
        // Estimate wait time
        const avgMin = doctor?.avgConsultMinutes || 5;
        const waitMin = ahead * avgMin;
        msg += `\n⏰ Estimated wait: ~${waitMin} minutes`;
      }
      msg += `\n📍 Current Number: *${currentNumber}*`;
    } else {
      msg += `\n⏳ Session has not started yet. Please wait.`;
    }
  }

  return msg;
}

// ── The webhook endpoint ─────────────────────────────────────────
router.post('/incoming', async (req, res) => {
  // Twilio sends form-encoded data
  const from    = req.body.From || '';     // "whatsapp:+94771234567"
  const body    = (req.body.Body || '').trim().toLowerCase();
  const to      = req.body.To || '';       // "whatsapp:+14155238886" (our number)
  const phone   = normalizePhone(from);

  console.log(`📩 WhatsApp incoming from ${phone}: "${body}"`);

  res.set('Content-Type', 'text/xml');

  try {
    // Find which hospital this WhatsApp number belongs to
    const fromNumberClean = normalizePhone(to);
    let hospital = await Hospital.findOne({
      'whatsapp.enabled': true,
      $or: [
        { 'whatsapp.fromNumber': to },
        { 'whatsapp.fromNumber': fromNumberClean },
        { 'whatsapp.fromNumber': `whatsapp:${fromNumberClean}` }
      ]
    });

    // If no hospital matched by number, check if there's only one active hospital with WhatsApp
    if (!hospital) {
      const hospitals = await Hospital.find({ 'whatsapp.enabled': true });
      if (hospitals.length === 1) hospital = hospitals[0];
    }

    if (!hospital) {
      return res.send(twiml('⚠️ Sorry, this WhatsApp service is not configured. Please contact the hospital directly.'));
    }

    // ── HELP / GREETING ──────────────────────────────────────
    if (['hi', 'hello', 'hey', 'menu', 'help', 'start'].includes(body)) {
      const helpMsg =
        `🏥 *${hospital.name}*\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `Welcome! Here's how I can help:\n\n` +
        `📋 Send *"status"* or *"queue"*\n` +
        `→ Check your current queue position\n\n` +
        `🔢 Send your *queue number* (e.g. "15")\n` +
        `→ Get details for that specific number\n\n` +
        `📞 Need help? Call us: ${hospital.phone || 'See reception'}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`;
      return res.send(twiml(helpMsg));
    }

    const { start, end } = todayRange();

    // ── LOOKUP BY QUEUE NUMBER ───────────────────────────────
    const queueNum = parseInt(body, 10);
    if (!isNaN(queueNum) && queueNum > 0 && queueNum <= 999) {
      // Look up this specific queue number for today at this hospital
      const apt = await Appointment.findOne({
        hospitalId: hospital._id,
        queueNumber: queueNum,
        appointmentDate: { $gte: start, $lt: end },
        status: { $nin: ['cancelled'] }
      }).populate('patient', 'name phone');

      if (!apt) {
        return res.send(twiml(`❌ No appointment found for queue number *${queueNum}* today.\n\nSend "status" to check by your phone number.`));
      }

      const doctor = await Doctor.findById(apt.doctor);

      // Find current number being seen for this doctor
      const inProgress = await Appointment.findOne({
        hospitalId: hospital._id,
        doctor: apt.doctor,
        appointmentDate: { $gte: start, $lt: end },
        status: 'in-progress'
      }).sort({ queueNumber: -1 });

      const lastCompleted = await Appointment.findOne({
        hospitalId: hospital._id,
        doctor: apt.doctor,
        appointmentDate: { $gte: start, $lt: end },
        status: 'completed'
      }).sort({ queueNumber: -1 });

      const currentNumber = inProgress?.queueNumber || lastCompleted?.queueNumber || 0;

      const msg = `🏥 *${hospital.name}*\n━━━━━━━━━━━━━━━━━━━━━━\n\n` + formatStatus(apt, currentNumber, doctor);
      return res.send(twiml(msg));
    }

    // ── LOOKUP BY PHONE (status / queue command) ─────────────
    if (['status', 'queue', 'check', 'my', 'number', 'position', 'turn', 'q'].includes(body)) {
      // Find patient by phone across any variation
      const phoneVariants = [phone];
      // Also try without country code, with leading 0, etc.
      if (phone.startsWith('+94')) {
        phoneVariants.push('0' + phone.slice(3));   // +94771234567 → 0771234567
        phoneVariants.push(phone.slice(3));          // +94771234567 → 771234567
      }
      if (phone.startsWith('+')) {
        phoneVariants.push(phone.slice(1));           // +94771234567 → 94771234567
      }

      const patient = await Patient.findOne({
        hospitalId: hospital._id,
        phone: { $in: phoneVariants }
      });

      if (!patient) {
        return res.send(twiml(
          `❌ No patient record found for this phone number.\n\n` +
          `If you have a queue number, send it directly (e.g. "15").\n` +
          `Or contact the hospital: ${hospital.phone || 'See reception'}`
        ));
      }

      // Get today's appointments for this patient
      const appointments = await Appointment.find({
        hospitalId: hospital._id,
        patient: patient._id,
        appointmentDate: { $gte: start, $lt: end },
        status: { $nin: ['cancelled'] }
      }).sort({ queueNumber: 1 });

      if (appointments.length === 0) {
        return res.send(twiml(
          `📋 Hi *${patient.name}*!\n\n` +
          `You don't have any appointments for today.\n\n` +
          `Visit ${hospital.website || hospital.name} to book an appointment.`
        ));
      }

      let msg = `🏥 *${hospital.name}*\n━━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `👤 Hi *${patient.name}*!\n\n`;

      if (appointments.length === 1) {
        const apt = appointments[0];
        const doctor = await Doctor.findById(apt.doctor);

        const inProgress = await Appointment.findOne({
          hospitalId: hospital._id,
          doctor: apt.doctor,
          appointmentDate: { $gte: start, $lt: end },
          status: 'in-progress'
        }).sort({ queueNumber: -1 });

        const lastCompleted = await Appointment.findOne({
          hospitalId: hospital._id,
          doctor: apt.doctor,
          appointmentDate: { $gte: start, $lt: end },
          status: 'completed'
        }).sort({ queueNumber: -1 });

        const currentNumber = inProgress?.queueNumber || lastCompleted?.queueNumber || 0;
        msg += formatStatus(apt, currentNumber, doctor);
      } else {
        msg += `You have *${appointments.length}* appointments today:\n\n`;
        for (const apt of appointments) {
          const doctor = await Doctor.findById(apt.doctor);

          const inProgress = await Appointment.findOne({
            hospitalId: hospital._id,
            doctor: apt.doctor,
            appointmentDate: { $gte: start, $lt: end },
            status: 'in-progress'
          }).sort({ queueNumber: -1 });

          const lastCompleted = await Appointment.findOne({
            hospitalId: hospital._id,
            doctor: apt.doctor,
            appointmentDate: { $gte: start, $lt: end },
            status: 'completed'
          }).sort({ queueNumber: -1 });

          const currentNumber = inProgress?.queueNumber || lastCompleted?.queueNumber || 0;
          msg += formatStatus(apt, currentNumber, doctor) + '\n━━━━━━━━━━━━━━━━━━━━━━\n';
        }
      }

      msg += `\n💡 Send your queue number anytime to check again.`;
      return res.send(twiml(msg));
    }

    // ── UNKNOWN COMMAND ──────────────────────────────────────
    return res.send(twiml(
      `🏥 *${hospital.name}*\n\n` +
      `I didn't understand that. Try:\n\n` +
      `📋 *"status"* — Check your queue position\n` +
      `🔢 *Queue number* (e.g. "15") — Check a specific number\n` +
      `❓ *"help"* — See all commands`
    ));

  } catch (err) {
    console.error('❌ WhatsApp webhook error:', err);
    return res.send(twiml('⚠️ Sorry, something went wrong. Please try again shortly.'));
  }
});

module.exports = router;
