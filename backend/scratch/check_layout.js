const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Hospital = require('../models/Hospital');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const hospitals = await Hospital.find();
  hospitals.forEach(h => {
    console.log(`Hospital: ${h.name}`);
    console.log(`- Layout: ${h.displayLayout}`);
    console.log(`- Theme: ${JSON.stringify(h.theme)}`);
  });
  await mongoose.disconnect();
}

check();
