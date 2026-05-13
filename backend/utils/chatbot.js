const Hospital = require('../models/Hospital');
const Doctor = require('../models/Doctor');
const Appointment = require('../models/Appointment');
const { formatPhone } = require('./sms');

const symptomMap = {
  'stomach': 'General Surgeon', 'belly': 'General Surgeon', 'gastritis': 'Physician',
  'eye': 'Ophthalmologist', 'vision': 'Ophthalmologist', 'glasses': 'Ophthalmologist',
  'heart': 'Cardiologist', 'chest': 'Cardiologist', 'pressure': 'Cardiologist',
  'skin': 'Dermatologist', 'rash': 'Dermatologist', 'pimple': 'Dermatologist',
  'child': 'Pediatrician', 'baby': 'Pediatrician', 'kid': 'Pediatrician',
  'ear': 'ENT', 'nose': 'ENT', 'throat': 'ENT', 'cold': 'ENT',
  'bone': 'Orthopedic', 'fracture': 'Orthopedic', 'back': 'Orthopedic',
  'mental': 'Psychiatrist', 'stress': 'Psychiatrist', 'sleep': 'Psychiatrist',
  'tooth': 'Dentist', 'teeth': 'Dentist', 'gum': 'Dentist'
};

/**
 * Main Chatbot Logic
 * @param {string} from - Patient's WhatsApp number
 * @param {string} to - Hospital's WhatsApp number
 * @param {string} body - The message content
 */
async function processMessage(from, to, body) {
  const text = body.trim().toLowerCase();
  
  // 1. Identify the Hospital
  // If user says "join [slug]", we find that hospital
  if (text.startsWith('join ')) {
    const slug = text.split(' ')[1];
    const h = await Hospital.findOne({ slug });
    if (h) return `✅ You have joined *${h.name}* Assistant. Type 'Hi' to see the menu.`;
    return `❌ Hospital with code '${slug}' not found.`;
  }

  const cleanTo = to.replace('whatsapp:', '').trim();
  let hospital = await Hospital.findOne({ 'whatsapp.fromNumber': cleanTo });
  
  if (!hospital) hospital = await Hospital.findOne({ isActive: true });
  if (!hospital) return "Sorry, I couldn't identify the hospital. Please contact support.";

  const hName = hospital.shortName || hospital.name;

  // 2. Natural Language Mapping
  let intentQuery = text;
  Object.keys(symptomMap).forEach(s => {
    if (text.includes(s)) intentQuery = symptomMap[s];
  });

  // GREETING / MENU
  if (['hi', 'hello', 'menu', 'help', 'start'].includes(text)) {
    return `Welcome to *${hName}* AI Assistant! 🤖🏥\n\n` +
           `I can help you with:\n\n` +
           `🩺 *Finding Doctors* (Try: 'Eye doctors' or 'My stomach hurts')\n` +
           `⏳ *Queue Status* (Try: 'Queue status' or 'Ongoing numbers')\n` +
           `📅 *My Bookings* (Try: 'My appointments')\n` +
           `ℹ️ *About Hospital* (Try: 'Location' or 'Hours')\n\n` +
           `How can I help you today?`;
  }

  // 1. FIND DOCTORS (Enhanced)
  if (text === '1' || text.includes('doctor') || text.includes('specialist') || text.includes('available') || intentQuery !== text) {
    let query = intentQuery.replace(/doctors|doctor|find|search|available|who is the best|is there any|for my|my|hurts|pain/g, '').trim();
    if (!query || query === '1') return `Please tell me the specialization or illness you are looking for (e.g., Eye, Heart, Skin).`;
    
    const doctors = await Doctor.find({
      hospitalId: hospital._id,
      isActive: true,
      $or: [
        { specialization: { $regex: query, $options: 'i' } },
        { name: { $regex: query, $options: 'i' } }
      ]
    }).limit(5);

    if (doctors.length === 0) {
      return `I couldn't find any specialists for "${query}" at *${hName}*. Try a general term like 'Physician' or 'ENT'.`;
    }

    let resp = `🔍 *Top Specialists for ${query}:*\n\n`;
    doctors.forEach((d, i) => {
      resp += `*${d.name}*\n🔹 ${d.specialization}\n🔹 Room: ${d.room || 'TBD'}\n\n`;
    });
    resp += `👉 *To Book:* ${process.env.FRONTEND_URL}/login/${hospital.slug}`;
    return resp;
  }

  // 2. QUEUE STATUS
  if (text === '2' || text.includes('queue') || text.includes('number') || text.includes('status')) {
    // Find active sessions for this hospital
    const sessions = await Doctor.find({ 
      hospitalId: hospital._id, 
      'todayStatus.isArrived': true 
    }).select('name specialization todayStatus');

    if (sessions.length === 0) {
      return `No doctors are currently seeing patients right now at *${hName}*.`;
    }

    let resp = `⏳ *Current Ongoing Numbers:* \n\n`;
    sessions.forEach(d => {
      resp += `*${d.name}*: #${d.todayStatus?.currentNumber || 0}\n`;
    });
    resp += `\nTo see the full display, visit:\n${process.env.FRONTEND_URL}/display/${hospital._id}`;
    return resp;
  }

  // 3. MY BOOKINGS
  if (text === '3' || text.includes('booking') || text.includes('my appt')) {
    // Search appointments by this 'from' number
    const cleanFrom = from.replace('whatsapp:', '').replace(/\+/g, '');
    const appts = await Appointment.find({
      phone: { $regex: cleanFrom.slice(-9) }, // Match last 9 digits to be safe
      status: 'scheduled'
    }).populate('doctorId', 'name').sort({ date: 1 }).limit(3);

    if (appts.length === 0) {
      return `I couldn't find any active bookings for your number (${from}).`;
    }

    let resp = `📅 *Your Upcoming Appointments:* \n\n`;
    appts.forEach(a => {
      resp += `• *Dr. ${a.doctorId?.name}*\n  No: #${a.queueNumber}\n  Date: ${a.date}\n  Time: ${a.time || 'Check later'}\n\n`;
    });
    return resp;
  }

  // 4. ABOUT HOSPITAL
  if (text === '4' || text.includes('about') || text.includes('address')) {
    return `*${hospital.name}* 🏥\n\n` +
           `📍 *Address:* ${hospital.address || 'Not set'}\n` +
           `📞 *Phone:* ${hospital.phone || 'Not set'}\n` +
           `🌐 *Website:* ${hospital.website || 'Not set'}\n` +
           `🕒 *Clinic Hours:* ${hospital.clinicHours?.open} - ${hospital.clinicHours?.close}`;
  }

  // DEFAULT / UNKNOWN
  return `I'm sorry, I didn't quite catch that. 🤔\n\n` +
         `Type *Menu* to see what I can do for you.`;
}

module.exports = { processMessage };
