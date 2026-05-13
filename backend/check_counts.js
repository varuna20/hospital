const mongoose = require('mongoose');
require('dotenv').config();

async function checkCounts() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to DB');
  
  const models = [
    'Hospital', 'User', 'Doctor', 'Patient', 'Appointment', 'MessageLog'
  ];
  
  for (const m of models) {
    try {
      const Model = mongoose.model(m, new mongoose.Schema({}, { strict: false }), m.toLowerCase() + 's');
      const count = await Model.countDocuments();
      console.log(`${m}: ${count}`);
    } catch (e) {}
  }
  
  process.exit(0);
}

checkCounts();
