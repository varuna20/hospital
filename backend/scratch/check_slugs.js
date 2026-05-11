const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Hospital = require('../models/Hospital');

async function checkSlugs() {
  await mongoose.connect(process.env.MONGO_URI);
  const hospitals = await Hospital.find();
  console.log('Hospital Slugs:');
  hospitals.forEach(h => console.log(`- ${h.name}: ${h.slug}`));
  await mongoose.disconnect();
}

checkSlugs();
