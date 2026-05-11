const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const AuditLog = require('../models/AuditLog');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const logs = await AuditLog.find({ targetType: 'Hospital' }).sort({ createdAt: -1 }).limit(10);
  console.log('Hospital Audit Logs:');
  logs.forEach(l => {
    console.log(`[${l.createdAt.toISOString()}] ${l.userName} (${l.userRole}): ${l.action}`);
    if (l.metadata) console.log('  Metadata:', JSON.stringify(l.metadata));
  });
  await mongoose.disconnect();
}

check();
