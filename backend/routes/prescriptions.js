/**
 * PRESCRIPTION ROUTES
 * ====================
 * SECURITY: Doctors see ONLY their own prescriptions.
 *           Each query is scoped by doctor._id.
 *
 * POST /api/prescriptions           - Create prescription
 * GET  /api/prescriptions           - List (scoped to doctor or hospital)
 * GET  /api/prescriptions/:id       - Single prescription
 * PUT  /api/prescriptions/:id       - Update
 * GET  /api/prescriptions/patient/:patientId - Patient history (doctor-scoped)
 * GET  /api/prescriptions/search    - Search by name/phone
 * GET  /api/prescriptions/print/:id - Get print-ready data
 */

const express = require('express');
const router  = express.Router();
const Prescription = require('../models/Prescription');
const Patient  = require('../models/Patient');
const Doctor   = require('../models/Doctor');
const Hospital = require('../models/Hospital');
const Appointment = require('../models/Appointment');
const { protect, authorize } = require('../middleware/auth');

// ── Helper: get doctor's own profile ID ───────────────────────────
async function getMyDoctorId(user) {
  const docId = user.doctorProfile?._id || user.doctorProfile;
  if (!docId) {
    const doc = await Doctor.findOne({ userId: user._id });
    return doc?._id;
  }
  return docId;
}

// ── Create Prescription ───────────────────────────────────────────
router.post('/', protect, authorize('doctor', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { patientId, appointmentId, drugs, diagnosis, chiefComplaint, notes, vitals, followUpDate, followUpNotes, letterhead } = req.body;

    const doctorId = await getMyDoctorId(req.user);
    if (!doctorId) return res.status(400).json({ success: false, message: 'Doctor profile not found' });

    const doctor   = await Doctor.findById(doctorId);
    const hospital = await Hospital.findById(doctor.hospitalId);
    const patient  = await Patient.findById(patientId);

    if (!patient) return res.status(404).json({ success: false, message: 'Patient not found' });

    // Auto-build letterhead from doctor + hospital data
    const autoLetterhead = {
      hospitalName:    hospital?.name || '',
      hospitalAddress: hospital?.address || '',
      hospitalPhone:   hospital?.phone || '',
      hospitalLogo:    hospital?.logo || hospital?.logoUrl || '',
      doctorName:      doctor?.name || '',
      doctorDegree:    (doctor?.qualifications || []).join(', '),
      doctorSpecialty: doctor?.specialization || '',
      showLogo:        true,
      footerText:      `${hospital?.name || ''} · ${hospital?.phone || ''}`
    };

    const prescription = await Prescription.create({
      hospitalId:   doctor.hospitalId,
      doctor:       doctorId,
      patient:      patientId,
      appointment:  appointmentId,
      chiefComplaint, diagnosis, notes, vitals, followUpDate, followUpNotes,
      drugs:        drugs || [],
      letterhead:   { ...autoLetterhead, ...letterhead }   // allow overrides
    });

    const populated = await Prescription.findById(prescription._id)
      .populate('patient', 'name phone gender dateOfBirth')
      .populate('doctor', 'name specialization qualifications')
      .populate('appointment');

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'PRESCRIPTION_CREATED',
      targetType: 'Prescription',
      targetId: prescription._id,
      targetName: `Prescription for ${patient.name}`,
      metadata: { diagnosis, drugCount: drugs?.length || 0 }
    });

    res.status(201).json({ success: true, prescription: populated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── List prescriptions (doctor-scoped) ────────────────────────────
router.get('/', protect, authorize('doctor', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { page = 1, limit = 20, patientId } = req.query;
    const filter = {};

    if (req.user.role === 'doctor') {
      const doctorId = await getMyDoctorId(req.user);
      filter.doctor = doctorId;                                 // STRICT: own patients only
    } else {
      const hospitalId = req.user.hospitalId?._id || req.user.hospitalId;
      if (hospitalId) filter.hospitalId = hospitalId;
    }

    if (patientId) filter.patient = patientId;

    const prescriptions = await Prescription.find(filter)
      .populate('patient', 'name phone gender')
      .populate('doctor', 'name specialization')
      .sort({ visitDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Prescription.countDocuments(filter);

    res.json({ success: true, prescriptions, total, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Search by patient name or phone ───────────────────────────────
router.get('/search', protect, authorize('doctor', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { q } = req.query;
    if (!q || q.length < 2) return res.json({ success: true, results: [] });

    // Find matching patients first
    const hospitalId = req.user.role === 'doctor'
      ? (await Doctor.findOne({ userId: req.user._id }))?.hospitalId
      : req.user.hospitalId?._id || req.user.hospitalId;

    const patients = await Patient.find({
      hospitalId,
      $or: [{ name: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }]
    }).select('name phone gender').limit(20);

    const patientIds = patients.map(p => p._id);

    // Build prescription filter — doctor sees only their patients
    const filter = { patient: { $in: patientIds } };
    if (req.user.role === 'doctor') {
      const doctorId = await getMyDoctorId(req.user);
      filter.doctor = doctorId;
    }

    const prescriptions = await Prescription.find(filter)
      .populate('patient', 'name phone gender dateOfBirth')
      .populate('doctor', 'name specialization')
      .sort({ visitDate: -1 })
      .limit(30);

    res.json({ success: true, results: prescriptions, patients });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Patient prescription history (doctor-scoped) ──────────────────
router.get('/patient/:patientId', protect, authorize('doctor', 'admin', 'superadmin'), async (req, res) => {
  try {
    const filter = { patient: req.params.patientId };

    // ENFORCE: doctors only see their own patients
    if (req.user.role === 'doctor') {
      const doctorId = await getMyDoctorId(req.user);
      filter.doctor = doctorId;
    }

    const prescriptions = await Prescription.find(filter)
      .populate('patient', 'name phone gender dateOfBirth bloodGroup address')
      .populate('doctor', 'name specialization qualifications')
      .populate('appointment')
      .sort({ visitDate: -1 });

    const patient = await Patient.findById(req.params.patientId);

    res.json({ success: true, prescriptions, patient });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Single prescription ────────────────────────────────────────────
router.get('/:id', protect, authorize('doctor', 'admin', 'superadmin'), async (req, res) => {
  try {
    const prescription = await Prescription.findById(req.params.id)
      .populate('patient', 'name phone gender dateOfBirth bloodGroup address')
      .populate({ path: 'doctor', populate: { path: 'userId', select: 'name' } })
      .populate('appointment');

    if (!prescription) return res.status(404).json({ success: false, message: 'Prescription not found' });

    // Enforce doctor can only see their own
    if (req.user.role === 'doctor') {
      const doctorId = await getMyDoctorId(req.user);
      if (prescription.doctor._id.toString() !== doctorId.toString()) {
        return res.status(403).json({ success: false, message: 'Access denied' });
      }
    }

    res.json({ success: true, prescription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Update prescription ────────────────────────────────────────────
router.put('/:id', protect, authorize('doctor'), async (req, res) => {
  try {
    const doctorId = await getMyDoctorId(req.user);
    const prescription = await Prescription.findOne({ _id: req.params.id, doctor: doctorId }).populate('patient', 'name');
    if (!prescription) return res.status(404).json({ success: false, message: 'Not found or not authorized' });

    const oldValues = prescription.toObject();
    Object.assign(prescription, req.body);
    await prescription.save();

    // Audit log
    const { logAudit } = require('../utils/audit');
    await logAudit(req, {
      action: 'PRESCRIPTION_UPDATED',
      targetType: 'Prescription',
      targetId: prescription._id,
      targetName: `Prescription for ${prescription.patient?.name}`,
      oldValues,
      newValues: prescription.toObject()
    });

    res.json({ success: true, prescription });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Mark as printed ────────────────────────────────────────────────
router.put('/:id/printed', protect, authorize('doctor', 'admin'), async (req, res) => {
  try {
    await Prescription.findByIdAndUpdate(req.params.id, { isPrinted: true, printedAt: new Date() });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Patient's Own Prescriptions ──────────────────────────────────
router.get('/my-prescriptions', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ success: false, message: 'Patients only' });
    const prescriptions = await Prescription.find({ patient: req.user._id })
      .populate('doctor', 'name specialization')
      .sort({ visitDate: -1 });
    res.json({ success: true, prescriptions });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Download Watermarked PDF ─────────────────────────────────────
router.get('/:id/download-watermarked', protect, async (req, res) => {
  try {
    if (req.user.role !== 'patient') return res.status(403).json({ success: false, message: 'Patients only' });
    
    const prescription = await Prescription.findOne({ _id: req.params.id, patient: req.user._id })
      .populate('doctor', 'name specialization qualifications')
      .populate('hospitalId', 'name address phone');

    if (!prescription) return res.status(404).json({ success: false, message: 'Not found' });

    const PDFDocument = require('pdfkit');
    const doc = new PDFDocument({ margin: 50 });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Prescription_${prescription._id}.pdf`);
    doc.pipe(res);

    // Add Watermark
    doc.save()
       .translate(doc.page.width/2, doc.page.height/2)
       .rotate(-30)
       .fontSize(60)
       .fillColor('red')
       .opacity(0.1)
       .text('DUPLICATE / ONLINE COPY', -250, -30)
       .restore();

    // Header
    doc.fontSize(20).text(prescription.hospitalId?.name || 'Hospital', { align: 'center' });
    doc.fontSize(10).text(prescription.hospitalId?.address || '', { align: 'center' });
    doc.moveDown();

    // Doctor Info
    doc.fontSize(14).text(`Dr. ${prescription.doctor?.name}`);
    doc.fontSize(10).text(prescription.doctor?.specialization || '');
    doc.moveDown();

    // Patient Info
    const visitDate = prescription.visitDate.toISOString().split('T')[0];
    doc.text(`Date: ${visitDate}`);
    doc.moveDown();

    // Drugs
    doc.fontSize(14).text('Rx', { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    if (prescription.drugs && prescription.drugs.length > 0) {
      prescription.drugs.forEach(d => {
        doc.text(`• ${d.name} - ${d.dosage || ''} (${d.frequency || ''}) for ${d.duration || ''}`);
        if (d.instructions) doc.fontSize(10).text(`  Inst: ${d.instructions}`, { color: 'gray' });
      });
    } else {
      doc.text('No drugs prescribed.');
    }

    if (prescription.notes) {
      doc.moveDown();
      doc.text(`Notes: ${prescription.notes}`);
    }

    // Footer
    doc.moveDown(4);
    doc.fontSize(10).fillColor('gray').text('This is a digital copy for your records.', { align: 'center' });

    doc.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
