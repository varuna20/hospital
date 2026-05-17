/**
 * SUBSCRIPTION PLAN ROUTES
 * GET  /api/subscriptions           - List all plans
 * POST /api/subscriptions           - Create plan
 * PUT  /api/subscriptions/:id       - Update plan
 * PUT  /api/subscriptions/:id/assign/:hospitalId - Assign to hospital
 * DELETE /api/subscriptions/:id     - Delete plan
 */
const express = require('express');
const router  = express.Router();
const { SubscriptionPlan } = require('../models/SystemSettings');
const Hospital = require('../models/Hospital');
const Appointment = require('../models/Appointment');
const { protect, superAdminOnly } = require('../middleware/auth');

// Public: list active plans (for pricing page)
router.get('/public', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find({ isActive: true }).sort({ sortOrder: 1 });
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

const SystemPayment = require('../models/SystemPayment');
const { getHospitalId } = require('../middleware/auth');

// ── Admin/Superadmin: Get System Payments ──────────────────────────
router.get('/payments', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.user.role !== 'superadmin') {
      const hid = getHospitalId(req);
      if (!hid) return res.status(400).json({ success: false, message: 'Hospital context required' });
      filter.hospitalId = hid;
    }
    const payments = await SystemPayment.find(filter)
      .populate('hospitalId', 'name shortName')
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ success: true, payments });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// ── Admin: Log successful PayPal transaction ────────────────────────
router.post('/payments', protect, async (req, res) => {
  try {
    const hid = getHospitalId(req);
    if (!hid) return res.status(400).json({ success: false, message: 'Hospital context required' });
    
    const { amount, currency, period, billingCycle, transactionId, details } = req.body;
    const payment = await SystemPayment.create({
      hospitalId: hid, amount, currency, period, billingCycle, transactionId, details, status: 'paid'
    });

    // Update hospital's last bill
    await Hospital.findByIdAndUpdate(hid, { 
      'billing.lastBilledAt': new Date(), 
      'billing.lastBillAmount': amount 
    });

    res.status(201).json({ success: true, payment });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// All management routes below require super admin
router.use(protect, superAdminOnly);

// List all plans
router.get('/', async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ sortOrder: 1 });
    res.json({ success: true, plans });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Create plan
router.post('/', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.create(req.body);
    res.status(201).json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Update plan (features, price, commission)
router.put('/:id', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findByIdAndUpdate(req.params.id, { $set: req.body }, { new: true, runValidators: true });
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    res.json({ success: true, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Assign plan to hospital
router.put('/:id/assign/:hospitalId', async (req, res) => {
  try {
    const plan     = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    const hospital = await Hospital.findByIdAndUpdate(
      req.params.hospitalId,
      { $set: { subscriptionPlan: plan._id, subscriptionPlanCode: plan.code, 'billing.commissionPercent': req.body.commissionPercent ?? plan.commissionPercent } },
      { new: true }
    );
    res.json({ success: true, hospital, plan });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Delete plan (soft delete)
router.delete('/:id', async (req, res) => {
  try {
    await SubscriptionPlan.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ success: true, message: 'Plan deactivated' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Generate monthly invoice for a hospital
router.post('/invoice/:hospitalId', async (req, res) => {
  try {
    const hospital = await Hospital.findById(req.params.hospitalId).populate('subscriptionPlan');
    if (!hospital) return res.status(404).json({ success: false, message: 'Hospital not found' });
    const { month, year } = req.body;
    const startDate = new Date(year, month - 1, 1);
    const endDate   = new Date(year, month, 0, 23, 59, 59);
    // Sum paid appointments
    const revenueAgg = await Appointment.aggregate([
      { $match: { hospitalId: hospital._id, paymentStatus: 'paid', appointmentDate: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: null, totalRevenue: { $sum: '$fees.totalAmount' }, hospitalRevenue: { $sum: '$fees.hospitalCharge' }, count: { $sum: 1 } } }
    ]);
    const rev = revenueAgg[0] || { totalRevenue: 0, hospitalRevenue: 0, count: 0 };
    const commissionPct = hospital.billing?.commissionPercent || hospital.subscriptionPlan?.commissionPercent || 0;
    const commission    = (rev.hospitalRevenue * commissionPct) / 100;
    const planFee       = hospital.subscriptionPlan?.price || 0;
    const totalDue      = commission + planFee;
    const invoice = {
      hospitalName:   hospital.name,
      billingEmail:   hospital.billing?.billingEmail || hospital.email,
      period:         `${year}-${String(month).padStart(2,'0')}`,
      appointments:   rev.count,
      hospitalRevenue: rev.hospitalRevenue,
      commissionPct,
      commissionAmount: commission,
      planFee,
      totalDue,
      currency:       hospital.payment?.currency || 'LKR',
      generatedAt:    new Date()
    };
    // Update hospital billing record
    await Hospital.findByIdAndUpdate(hospital._id, { 'billing.lastBilledAt': new Date(), 'billing.lastBillAmount': totalDue });
    res.json({ success: true, invoice });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});
// Assign plan to hospital
router.put('/:id/assign/:hospitalId', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Plan not found' });
    await Hospital.findByIdAndUpdate(req.params.hospitalId, {
      subscriptionPlan: plan.code,
      subscriptionExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      'billing.commissionPercent': plan.commissionPercent
    });
    res.json({ success: true, message: 'Plan assigned to hospital' });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// Delete plan (only if not in use)
router.delete('/:id', async (req, res) => {
  try {
    const plan = await SubscriptionPlan.findById(req.params.id);
    if (!plan) return res.status(404).json({ success: false, message: 'Not found' });
    const inUse = await Hospital.findOne({ subscriptionPlan: plan.code });
    if (inUse) return res.status(400).json({ success: false, message: 'Plan is assigned to ' + inUse.name });
    await plan.deleteOne();
    res.json({ success: true });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;
