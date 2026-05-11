// staff.js
const express = require('express');
const staffRouter = express.Router();
const Appointment = require('../models/Appointment');
const Doctor = require('../models/Doctor');
const Queue = require('../models/Queue');
const { protect, authorize } = require('../middleware/auth');
const moment = require('moment');

function getHospId(req) {
  if (req.user.role === 'superadmin') return req.query.hospitalId;
  return req.user.hospitalId?._id?.toString() || req.user.hospitalId?.toString();
}

staffRouter.get('/dashboard', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospId(req);
    const today    = moment().startOf('day').toDate();
    const todayEnd = moment().endOf('day').toDate();
    const doctors  = await Doctor.find({ hospitalId, isActive: true }, 'name specialization room todayStatus fees sessions');
    const doctorStats = await Promise.all(doctors.map(async doc => {
      const agg = await Appointment.aggregate([
        { $match: { doctor: doc._id, appointmentDate: { $gte: today, $lte: todayEnd } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      const s = {}; agg.forEach(x => s[x._id] = x.count);
      const queue = await Queue.findOne({ doctor: doc._id, date: today });
      return { doctor: doc, stats: {
        total:     Object.values(s).reduce((a,b)=>a+b,0),
        waiting:   (s.booked||0)+(s.arrived||0),
        completed: s.completed||0, absent: s.absent||0,
        inProgress: s['in-progress']||0,
        currentNumber: queue?.currentNumber || 0
      }};
    }));
    res.json({ success: true, doctorStats });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = staffRouter;
