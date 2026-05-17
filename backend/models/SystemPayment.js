const mongoose = require('mongoose');

const systemPaymentSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'USD' },
  period: { type: String, required: true }, // e.g., "05-2026"
  billingCycle: { type: String, enum: ['monthly', 'annual'], default: 'monthly' },
  paymentMethod: { type: String, default: 'paypal' },
  status: { type: String, enum: ['paid', 'pending', 'failed'], default: 'paid' },
  transactionId: { type: String },
  details: { type: mongoose.Schema.Types.Mixed }
}, { timestamps: true });

module.exports = mongoose.model('SystemPayment', systemPaymentSchema);
