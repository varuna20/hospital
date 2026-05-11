/**
 * REVENUE ROUTES
 * ==============
 * Hospital admin sees BOTH hospital revenue and doctor revenues.
 * Doctor sees ONLY their own fee collection.
 *
 * GET /api/revenue/summary          - Hospital revenue summary
 * GET /api/revenue/doctor/:id       - Single doctor revenue
 * GET /api/revenue/daily            - Daily breakdown
 * GET /api/revenue/by-doctor        - Revenue per doctor (hospital admin)
 * GET /api/revenue/mark-paid/:aptId - Mark appointment as paid
 */

const express  = require('express');
const router   = express.Router();
const Appointment = require('../models/Appointment');
const Doctor      = require('../models/Doctor');
const { protect, authorize , getHospitalId } = require('../middleware/auth');
const moment = require('moment');



// Safe ObjectId conversion
function toObjectId(id) {
  try {
    return require('mongoose').Types.ObjectId.createFromHexString(id);
  } catch {
    return null;
  }
}

// ── Hospital Revenue Summary ───────────────────────────────────────
router.get('/summary', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    if (!hospitalId) return res.json({ success: true, revenue: { paid: { hospitalRevenue:0, doctorRevenue:0, totalRevenue:0, count:0 }, pending: { pendingAmount:0, count:0 } }, appointments: {} });
    const oid = toObjectId(hospitalId);
    if (!oid) return res.status(400).json({ success: false, message: 'Invalid hospital ID' });
    const { period = 'month', year, month } = req.query;

    let startDate, endDate;
    if (period === 'day') {
      startDate = moment().startOf('day').toDate();
      endDate   = moment().endOf('day').toDate();
    } else if (period === 'month') {
      const m = month ? Number(month) - 1 : moment().month();
      const y = year ? Number(year) : moment().year();
      startDate = moment({ year: y, month: m }).startOf('month').toDate();
      endDate   = moment({ year: y, month: m }).endOf('month').toDate();
    } else if (period === 'year') {
      const y = year ? Number(year) : moment().year();
      startDate = moment({ year: y }).startOf('year').toDate();
      endDate   = moment({ year: y }).endOf('year').toDate();
    }

    const [paidAgg, pendingAgg, totalAgg] = await Promise.all([
      Appointment.aggregate([
        { $match: { hospitalId: oid,
            paymentStatus: 'paid', appointmentDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: null,
            hospitalRevenue: { $sum: '$fees.hospitalCharge' },
            doctorRevenue:   { $sum: '$fees.doctorFee' },
            totalRevenue:    { $sum: '$fees.totalAmount' },
            count:           { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { hospitalId: oid,
            paymentStatus: 'pending', appointmentDate: { $gte: startDate, $lte: endDate },
            status: { $nin: ['cancelled', 'absent'] } } },
        { $group: { _id: null,
            pendingAmount: { $sum: '$fees.totalAmount' }, count: { $sum: 1 } } }
      ]),
      Appointment.aggregate([
        { $match: { hospitalId: oid,
            appointmentDate: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ])
    ]);

    const statusMap = {};
    totalAgg.forEach(s => statusMap[s._id] = s.count);

    res.json({
      success: true,
      period, startDate, endDate,
      revenue: {
        paid:    paidAgg[0]    || { hospitalRevenue: 0, doctorRevenue: 0, totalRevenue: 0, count: 0 },
        pending: pendingAgg[0] || { pendingAmount: 0, count: 0 }
      },
      appointments: statusMap
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Revenue Breakdown by Doctor (hospital admin) ──────────────────
router.get('/by-doctor', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    if (!hospitalId) return res.json({ success: true, breakdown: [] });
    const { month, year } = req.query;
    const m = month ? Number(month) - 1 : moment().month();
    const y = year  ? Number(year)  : moment().year();
    const start = moment({ year: y, month: m }).startOf('month').toDate();
    const end   = moment({ year: y, month: m }).endOf('month').toDate();

    const breakdown = await Appointment.aggregate([
      { $match: {
          hospitalId: oid,
          appointmentDate: { $gte: start, $lte: end }
      }},
      { $group: {
          _id: '$doctor',
          totalAppointments: { $sum: 1 },
          completed:         { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
          paidCount:         { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, 1, 0] } },
          doctorRevenue:     { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fees.doctorFee', 0] } },
          hospitalRevenue:   { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fees.hospitalCharge', 0] } },
          totalRevenue:      { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fees.totalAmount', 0] } }
      }},
      { $lookup: { from: 'doctors', localField: '_id', foreignField: '_id', as: 'doctor' } },
      { $unwind: { path: '$doctor', preserveNullAndEmpty: true } },
      { $sort: { totalRevenue: -1 } }
    ]);

    res.json({ success: true, breakdown, month: m + 1, year: y });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Doctor's Own Revenue ────────────────────────────────────────────
router.get('/my-revenue', protect, authorize('doctor'), async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month ? Number(month) - 1 : moment().month();
    const y = year  ? Number(year)  : moment().year();
    const start = moment({ year: y, month: m }).startOf('month').toDate();
    const end   = moment({ year: y, month: m }).endOf('month').toDate();
    const doctorId = req.user.doctorProfile?._id || req.user.doctorProfile;

    const [summary, daily] = await Promise.all([
      Appointment.aggregate([
        { $match: { doctor: require('mongoose').Types.ObjectId.createFromHexString(doctorId.toString()),
            appointmentDate: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
        { $group: { _id: null,
            myRevenue:   { $sum: '$fees.doctorFee' },
            totalPatients: { $sum: 1 },
            completed:   { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } }
        }}
      ]),
      Appointment.aggregate([
        { $match: { doctor: require('mongoose').Types.ObjectId.createFromHexString(doctorId.toString()),
            appointmentDate: { $gte: start, $lte: end }, paymentStatus: 'paid' } },
        { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } },
            revenue: { $sum: '$fees.doctorFee' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } }
      ])
    ]);

    res.json({
      success: true,
      summary: summary[0] || { myRevenue: 0, totalPatients: 0, completed: 0 },
      daily: daily.map(d => ({ date: d._id, revenue: d.revenue, count: d.count })),
      month: m + 1, year: y
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Mark Appointment as Paid ────────────────────────────────────────
router.put('/mark-paid/:aptId', protect, authorize('staff', 'admin', 'superadmin'), async (req, res) => {
  try {
    const { paymentMethod = 'cash' } = req.body;
    const apt = await Appointment.findByIdAndUpdate(
      req.params.aptId,
      { $set: { paymentStatus: 'paid', paidAt: new Date(), paymentMethod } },
      { new: true }
    ).populate('patient', 'name phone').populate('doctor', 'name');

    const io = req.app.get('io');
    if (io) io.to(`hospital_${apt.hospitalId}`).emit('payment_updated', { appointmentId: apt._id });

    res.json({ success: true, appointment: apt });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── Daily chart data for the current month ─────────────────────────
router.get('/daily', protect, authorize('admin', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    if (!hospitalId) return res.json({ success: true, daily: [] });
    const { month, year, doctorId } = req.query;
    const m = month ? Number(month) - 1 : new Date().getMonth();
    const y = year  ? Number(year)  : new Date().getFullYear();
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 0, 23, 59, 59);
    const match = {
      hospitalId: oid,
      appointmentDate: { $gte: start, $lte: end }
    };
    if (doctorId) match.doctor = toObjectId(doctorId);
    const daily = await require('../models/Appointment').aggregate([
      { $match: match },
      { $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$appointmentDate' } },
        total:         { $sum: 1 },
        completed:     { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } },
        absent:        { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        hospitalRev:   { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fees.hospitalCharge', 0] } },
        doctorRev:     { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$fees.doctorFee', 0] } },
      }},
      { $sort: { _id: 1 } }
    ]);
    res.json({ success: true, daily: daily.map(d => ({ date: d._id, total: d.total, completed: d.completed, absent: d.absent, hospitalRev: d.hospitalRev, doctorRev: d.doctorRev })) });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── CSV Export ─────────────────────────────────────────────────────
router.get('/export', protect, authorize('admin', 'doctor', 'superadmin'), async (req, res) => {
  try {
    const hospitalId = getHospitalId(req);
    const { startDate, endDate, doctorId } = req.query;
    const Appointment = require('../models/Appointment');
    const filter = { hospitalId };
    if (startDate && endDate) {
      filter.appointmentDate = {
        $gte: new Date(startDate),
        $lte: new Date(new Date(endDate).setHours(23,59,59))
      };
    }
    if (doctorId) filter.doctor = doctorId;
    // Doctors can only export their own
    if (req.user.role === 'doctor') {
      const Doctor = require('../models/Doctor');
      const doc = await Doctor.findOne({ userId: req.user._id });
      if (doc) filter.doctor = doc._id;
    }
    const apts = await Appointment.find(filter)
      .populate('patient', 'name phone gender')
      .populate('doctor', 'name specialization')
      .sort({ appointmentDate: 1, queueNumber: 1 });
    const headers = ['Date','Queue#','Patient','Phone','Doctor','Status','Payment','Doctor Fee','Hospital Charge','Total'];
    const rows = apts.map(a => [
      new Date(a.appointmentDate).toLocaleDateString('en-GB'),
      a.queueNumber,
      `"${a.patient?.name||''}"`,
      a.patient?.phone||'',
      `"${a.doctor?.name||''}"`,
      a.status,
      a.paymentStatus,
      a.fees?.doctorFee||0,
      a.fees?.hospitalCharge||0,
      a.fees?.totalAmount||0
    ]);
    const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const filename = `revenue_report_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\uFEFF' + csv); // BOM for Excel compatibility
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
