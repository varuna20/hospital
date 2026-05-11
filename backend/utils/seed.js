/**
 * SEED SCRIPT
 * ===========
 * Creates: Super Admin + 2 demo hospitals with admins, staff, doctors
 * Run: npm run seed
 */
const mongoose = require('mongoose');
const dotenv   = require('dotenv');
dotenv.config();

const User     = require('../models/User');
const Hospital = require('../models/Hospital');
const Doctor   = require('../models/Doctor');
const Patient  = require('../models/Patient');

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ MongoDB connected');

  // Create default subscription plans if needed
  const { SubscriptionPlan, SystemSettings } = require('../models/SystemSettings');
  await SubscriptionPlan.deleteMany({});
  await SystemSettings.deleteMany({});

  // Clear
  await Promise.all([User,Hospital,Doctor,Patient].map(M => M.deleteMany({})));
  console.log('🧹 Cleared all data');

  // ── SUPER ADMIN ───────────────────────────────────────────────
  await User.create({ name:'Super Administrator', email:'superadmin@echanneling.com',
    password:'SuperAdmin@123', role:'superadmin', phone:'+94771000000' });
  console.log('✅ Super Admin: superadmin@echanneling.com / SuperAdmin@123');

  // ── HOSPITAL 1 — City Medical ─────────────────────────────────
  const h1 = await Hospital.create({
    name:'City Medical Center', shortName:'City Medical',
    address:'42 Main Street, Colombo 03', city:'Colombo', phone:'+94112345678',
    email:'info@citymedical.lk', slug:'city-medical',
    theme:{ primary:'#0d9488', secondary:'#0f172a', accent:'#f59e0b',
            background:'#0f172a', surface:'#1e293b', text:'#e2e8f0' },
    payment:{ currency:'LKR', currencySymbol:'Rs.', defaultHospitalCharge:500 },
    queueSettings:{ avgConsultMinutes:15, notifyWhenAhead:3 },
    whatsapp:{ enabled:false }, isActive:true, subscriptionPlan:'premium'
  });

  const h1Admin = await User.create({ name:'Admin — City Medical', email:'admin@citymedical.lk',
    password:'Admin@123', role:'admin', hospitalId:h1._id, phone:'+94771111111' });
  await User.create({ name:'Reception Staff', email:'staff@citymedical.lk',
    password:'Staff@123', role:'staff', hospitalId:h1._id, phone:'+94772222222' });

  const doctors1 = [
    { name:'Dr. Amara Perera', specialization:'General Medicine', email:'amara@citymedical.lk',
      phone:'+94773333333', room:'OPD 01', qualifications:['MBBS','MD'],
      fees:{ doctorFee:1500, hospitalCharge:500, totalFee:2000 },
      sessions:[{dayOfWeek:1,startTime:'09:00',endTime:'17:00',slotDuration:15,isActive:true},
                {dayOfWeek:2,startTime:'09:00',endTime:'17:00',slotDuration:15,isActive:true},
                {dayOfWeek:3,startTime:'09:00',endTime:'13:00',slotDuration:15,isActive:true}]},
    { name:'Dr. Nimal Fernando', specialization:'Pediatrics', email:'nimal@citymedical.lk',
      phone:'+94774444444', room:'OPD 02', qualifications:['MBBS','DCH'],
      fees:{ doctorFee:2000, hospitalCharge:500, totalFee:2500 },
      sessions:[{dayOfWeek:1,startTime:'08:00',endTime:'16:00',slotDuration:20,isActive:true},
                {dayOfWeek:3,startTime:'08:00',endTime:'16:00',slotDuration:20,isActive:true},
                {dayOfWeek:5,startTime:'08:00',endTime:'16:00',slotDuration:20,isActive:true}]},
    { name:'Dr. Priya Silva', specialization:'Dermatology', email:'priya@citymedical.lk',
      phone:'+94775555555', room:'OPD 03', qualifications:['MBBS','MD (Derm)'],
      fees:{ doctorFee:2500, hospitalCharge:500, totalFee:3000 },
      sessions:[{dayOfWeek:2,startTime:'10:00',endTime:'15:00',slotDuration:30,isActive:true},
                {dayOfWeek:4,startTime:'10:00',endTime:'15:00',slotDuration:30,isActive:true}]}
  ];

  for (const d of doctors1) {
    const u = await User.create({ name:d.name, email:d.email, password:'Doctor@123',
      role:'doctor', hospitalId:h1._id, phone:d.phone });
    const doc = await Doctor.create({ ...d, hospitalId:h1._id, userId:u._id });
    await User.findByIdAndUpdate(u._id, { doctorProfile:doc._id });
  }
  console.log('✅ Hospital 1 (City Medical) created — 3 doctors');

  // ── HOSPITAL 2 — Lanka Surgical ───────────────────────────────
  const h2 = await Hospital.create({
    name:'Lanka Surgical Hospital', shortName:'Lanka Surgical',
    address:'15 Hospital Road, Kandy', city:'Kandy', phone:'+94812345678',
    email:'info@lankasurgical.lk', slug:'lanka-surgical',
    theme:{ primary:'#6366f1', secondary:'#0f172a', accent:'#ec4899',
            background:'#0f172a', surface:'#1e293b', text:'#e2e8f0' },
    payment:{ currency:'LKR', currencySymbol:'Rs.', defaultHospitalCharge:750 },
    queueSettings:{ avgConsultMinutes:20, notifyWhenAhead:2 },
    whatsapp:{ enabled:false }, isActive:true, subscriptionPlan:'basic'
  });

  await User.create({ name:'Admin — Lanka Surgical', email:'admin@lankasurgical.lk',
    password:'Admin@123', role:'admin', hospitalId:h2._id, phone:'+94776666666' });
  await User.create({ name:'Surgical Reception', email:'staff@lankasurgical.lk',
    password:'Staff@123', role:'staff', hospitalId:h2._id, phone:'+94777777777' });

  const doctors2 = [
    { name:'Dr. Ruwan Bandara', specialization:'Orthopedics', email:'ruwan@lankasurgical.lk',
      phone:'+94778888888', room:'Surgical Suite 1', qualifications:['MBBS','MS (Ortho)'],
      fees:{ doctorFee:3000, hospitalCharge:750, totalFee:3750 },
      sessions:[{dayOfWeek:1,startTime:'09:00',endTime:'15:00',slotDuration:30,isActive:true},
                {dayOfWeek:4,startTime:'09:00',endTime:'15:00',slotDuration:30,isActive:true}]},
    { name:'Dr. Kumari Wijesinghe', specialization:'Cardiology', email:'kumari@lankasurgical.lk',
      phone:'+94779999999', room:'Cardio Suite', qualifications:['MBBS','MD (Cardio)'],
      fees:{ doctorFee:3500, hospitalCharge:750, totalFee:4250 },
      sessions:[{dayOfWeek:2,startTime:'08:00',endTime:'14:00',slotDuration:25,isActive:true},
                {dayOfWeek:5,startTime:'08:00',endTime:'14:00',slotDuration:25,isActive:true}]}
  ];

  for (const d of doctors2) {
    const u = await User.create({ name:d.name, email:d.email, password:'Doctor@123',
      role:'doctor', hospitalId:h2._id, phone:d.phone });
    const doc = await Doctor.create({ ...d, hospitalId:h2._id, userId:u._id });
    await User.findByIdAndUpdate(u._id, { doctorProfile:doc._id });
  }
  console.log('✅ Hospital 2 (Lanka Surgical) created — 2 doctors');

  console.log('\n🎉 Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('SUPER ADMIN:     superadmin@echanneling.com / SuperAdmin@123');
  console.log('CITY MEDICAL:    admin@citymedical.lk       / Admin@123');
  console.log('                 staff@citymedical.lk       / Staff@123');
  console.log('                 amara@citymedical.lk       / Doctor@123');
  console.log('LANKA SURGICAL:  admin@lankasurgical.lk     / Admin@123');
  console.log('                 staff@lankasurgical.lk     / Staff@123');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  process.exit(0);
}

seed().catch(err => { console.error('❌', err); process.exit(1); });
