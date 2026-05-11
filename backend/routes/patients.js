// patients.js
const express = require('express');
const pRouter = express.Router();
const Patient = require('../models/Patient');
const { protect, authorize } = require('../middleware/auth');

function getHospId(req) {
  if (req.user.role === 'superadmin') return req.query.hospitalId;
  return req.user.hospitalId?._id?.toString() || req.user.hospitalId?.toString();
}

pRouter.get('/search', protect, async (req, res) => {
  try {
    const { q, hospitalId } = req.query;
    const hid = hospitalId || getHospId(req);
    const patients = await Patient.find({
      hospitalId: hid,
      $or: [{ name: { $regex: q, $options: 'i' } }, { phone: { $regex: q, $options: 'i' } }]
    }).limit(10).select('name phone email gender');
    res.json({ success: true, patients });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

pRouter.get('/', protect, authorize('admin', 'staff', 'superadmin'), async (req, res) => {
  try {
    const hid = getHospId(req);
    const { page = 1, limit = 20 } = req.query;
    const patients = await Patient.find({ hospitalId: hid }).sort({ createdAt: -1 }).limit(limit*1).skip((page-1)*limit);
    const total = await Patient.countDocuments({ hospitalId: hid });
    res.json({ success: true, patients, total });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

pRouter.post('/', protect, authorize('admin', 'staff', 'superadmin'), async (req, res) => {
  try {
    const hid = getHospId(req);
    const patient = await Patient.create({ ...req.body, hospitalId: hid });
    res.status(201).json({ success: true, patient });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

pRouter.put('/:id', protect, authorize('admin', 'staff', 'superadmin'), async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, patient });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = pRouter;
