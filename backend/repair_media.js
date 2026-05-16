require('dotenv').config();
const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');
const fs = require('fs');
const path = require('path');

async function repair() {
  await mongoose.connect(process.env.MONGO_URI);
  const hid = '6a03c2c2649de001b3d4f0e0';
  const dir = path.join(__dirname, 'uploads', 'slideshow');
  
  if (!fs.existsSync(dir)) {
    console.error('Directory not found:', dir);
    process.exit(1);
  }

  const files = fs.readdirSync(dir).filter(f => f !== '.DS_Store');
  console.log(`Found ${files.length} files in ${dir}`);

  const slideshow = files.map((f, i) => ({
    url: `/uploads/slideshow/${f}`,
    filename: f,
    type: f.match(/\.(mp4|webm)$/i) ? 'video' : 'image',
    duration: 10,
    order: i,
    isActive: true
  }));

  await Hospital.findByIdAndUpdate(hid, { $set: { slideshow } });
  console.log(`✅ Successfully updated slideshow for hospital ${hid}`);

  // Also fix branding logo if it's broken
  const brandingDir = path.join(__dirname, 'uploads', 'branding');
  if (fs.existsSync(brandingDir)) {
    const brandFiles = fs.readdirSync(brandingDir);
    if (brandFiles.length > 0) {
      const logo = `/uploads/branding/${brandFiles[0]}`;
      // Note: site-wide branding is in SystemSettings, but hospital logo is in Hospital model
      await Hospital.findByIdAndUpdate(hid, { $set: { logo } });
      console.log(`✅ Updated hospital logo to ${logo}`);
    }
  }

  await mongoose.disconnect();
}

repair().catch(err => {
  console.error(err);
  process.exit(1);
});
