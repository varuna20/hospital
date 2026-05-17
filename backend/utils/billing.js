// billing.js - Monthly invoice generation scheduler
const cron = require('node-cron');
const Hospital = require('../models/Hospital');
const Appointment = require('../models/Appointment');
const { SystemSettings, SubscriptionPlan } = require('../models/SystemSettings');

async function generateMonthlyInvoice(hospital) {
  try {
    const now  = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevEnd   = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const agg = await Appointment.aggregate([
      { $match: { hospitalId: hospital._id, paymentStatus: 'paid', appointmentDate: { $gte: prevMonth, $lte: prevEnd } } },
      { $group: { _id: null, hospitalRevenue: { $sum: '$fees.hospitalCharge' }, count: { $sum: 1 } } }
    ]);

    const rev  = agg[0] || { hospitalRevenue: 0, count: 0 };
    const pct  = hospital.billing?.commissionPercent || 0;
    const comm = (rev.hospitalRevenue * pct) / 100;

    let plan = null;
    if (hospital.subscriptionPlan) {
      plan = await SubscriptionPlan.findById(hospital.subscriptionPlan);
    }
    const planFee = plan?.price || 0;
    const total   = comm + planFee;

    // Send invoice email if configured
    const settings = await SystemSettings.findOne();
    if (settings?.email?.enabled && hospital.email) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransporter({
        host: settings.email.host, port: settings.email.port, secure: settings.email.secure,
        auth: { user: settings.email.user, pass: settings.email.password }
      });
      const subject = `Monthly Invoice — ${hospital.name} — ${prevMonth.toLocaleString('default',{month:'long',year:'numeric'})}`;
      await transporter.sendMail({
        from:    `"${settings.email.fromName}" <${settings.email.fromEmail}>`,
        to:      hospital.billing?.billingEmail || hospital.email,
        subject,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
            <h2 style="color:#0d9488">Monthly Invoice</h2>
            <p><strong>Hospital:</strong> ${hospital.name}</p>
            <p><strong>Period:</strong> ${prevMonth.toLocaleString('default',{month:'long',year:'numeric'})}</p>
            <hr/>
            <table style="width:100%;border-collapse:collapse">
              <tr><td>Total Appointments</td><td>${rev.count}</td></tr>
              <tr><td>Hospital Revenue</td><td>${hospital.payment?.currencySymbol||'Rs.'} ${rev.hospitalRevenue.toLocaleString()}</td></tr>
              <tr><td>Commission (${pct}%)</td><td>${hospital.payment?.currencySymbol||'Rs.'} ${comm.toFixed(2)}</td></tr>
              <tr><td>Plan Fee (${plan?.name||'N/A'})</td><td>${hospital.payment?.currencySymbol||'Rs.'} ${planFee.toFixed(2)}</td></tr>
              <tr style="font-weight:bold;border-top:2px solid #eee"><td>TOTAL DUE</td><td>${hospital.payment?.currencySymbol||'Rs.'} ${total.toFixed(2)}</td></tr>
            </table>
            <p style="color:#666;font-size:12px;margin-top:20px">⚠️ This invoice contains confidential financial data. Please handle appropriately.</p>
          </div>`
      });
      console.log('📧 Invoice emailed to:', hospital.email);
    }

    await Hospital.findByIdAndUpdate(hospital._id, { 'billing.lastBilledAt': new Date(), 'billing.lastBillAmount': total });
    return { success: true, hospital: hospital.name, total };
  } catch (err) {
    console.error('Invoice error for', hospital.name, ':', err.message);
    return { success: false, error: err.message };
  }
}

const SystemPayment = require('../models/SystemPayment');

async function checkPaymentReminders() {
  try {
    const now = new Date();
    const currentMonthStr = `${now.toLocaleString('en-US', { month: 'short' })} ${now.getFullYear()}`;
    const hospitals = await Hospital.find({ isActive: true });
    
    for (const h of hospitals) {
      const paymentExists = await SystemPayment.findOne({ 
        hospitalId: h._id, 
        period: currentMonthStr,
        status: 'paid'
      });

      if (!paymentExists) {
        // Send Reminder
        const settings = await SystemSettings.findOne();
        if (settings?.email?.enabled && h.email) {
          const nodemailer = require('nodemailer');
          const transporter = nodemailer.createTransporter({
            host: settings.email.host, port: settings.email.port, secure: settings.email.secure,
            auth: { user: settings.email.user, pass: settings.email.password }
          });
          const subject = `ACTION REQUIRED: Payment Reminder — ${h.name} — ${currentMonthStr}`;
          await transporter.sendMail({
            from:    `"${settings.email.fromName}" <${settings.email.fromEmail}>`,
            to:      h.billing?.billingEmail || h.email,
            subject,
            html: `
              <div style="font-family:sans-serif;max-width:600px;margin:0 auto">
                <h2 style="color:#ef4444">Payment Due Reminder</h2>
                <p><strong>Hospital:</strong> ${h.name}</p>
                <p><strong>Period:</strong> ${currentMonthStr}</p>
                <hr/>
                <p>This is a polite reminder that your system subscription and commission payment for <strong>${currentMonthStr}</strong> has not yet been recorded.</p>
                <p>Please log in to your Admin Dashboard and navigate to the <strong>Revenue</strong> section to process your payment via PayPal.</p>
                <p>Prompt payments ensure uninterrupted access to the platform services.</p>
                <br/>
                <p style="color:#666;font-size:12px;margin-top:20px">If you have already made this payment, please ensure it was properly logged in the system.</p>
              </div>`
          });
          console.log(`⏰ Reminder emailed to: ${h.name} (${h.email})`);
        }
      }
    }
  } catch (err) { console.error('Reminder error:', err.message); }
}

function startBillingScheduler() {
  // Run on 1st of every month at 6 AM (Invoice generation)
  cron.schedule('0 6 1 * *', async () => {
    console.log('💰 Running monthly billing...');
    const hospitals = await Hospital.find({ isActive: true });
    for (const h of hospitals) { await generateMonthlyInvoice(h); }
  });
  
  // Run on 28th of every month at 9 AM (Payment Reminder)
  cron.schedule('0 9 28 * *', async () => {
    console.log('🔔 Running end-of-month payment reminders...');
    await checkPaymentReminders();
  });
  
  console.log('💰 Billing & Reminder schedulers started');
}

module.exports = { generateMonthlyInvoice, startBillingScheduler, checkPaymentReminders };
