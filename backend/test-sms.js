require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGO_URI || 'mongodb+srv://varunac:f0U6PikHqg0k39Tj@cluster0.dbw35.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0', { dbName: 'hospital_system' }).then(async () => {
  const MessageLog = require('./backend/models/MessageLog');
  const logs = await MessageLog.find({ type: 'sms' }).sort({ createdAt: -1 }).limit(10);
  console.log(logs.map(l => ({ to: l.recipient, status: l.status, error: l.error, msg: l.message })));
  process.exit(0);
}).catch(console.error);
