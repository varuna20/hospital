const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Hospital = require('../models/Hospital');

async function check() {
  await mongoose.connect(process.env.MONGO_URI);
  const hospitals = await Hospital.find();
  console.log('Hospitals Found:', hospitals.length);
  hospitals.forEach(h => {
    console.log(`Hospital: ${h.name} (${h._id})`);
    console.log(`- Logo: ${h.logo}`);
    console.log(`- Slideshow Count: ${h.slideshow?.length}`);
    console.log(`- Waiting Video: ${h.waitingVideo?.url}`);
    if (h.slideshow?.length > 0) {
      console.log('  Slideshow items:');
      h.slideshow.forEach(s => console.log(`    * ${s.url} (Active: ${s.isActive})`));
    }
  });
  await mongoose.disconnect();
}

check();
