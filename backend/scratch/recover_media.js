const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
dotenv.config({ path: path.join(__dirname, '../.env') });

const Hospital = require('../models/Hospital');

async function recover() {
  await mongoose.connect(process.env.MONGO_URI);
  
  const slideshowDir = path.join(__dirname, '../uploads/slideshow');
  if (!fs.existsSync(slideshowDir)) {
    console.log('Slideshow directory not found');
    await mongoose.disconnect();
    return;
  }

  const files = fs.readdirSync(slideshowDir);
  console.log(`Found ${files.length} files in uploads/slideshow`);

  for (const file of files) {
    // Filename format: slideshow_HOSPITALID_TIMESTAMP.EXT
    const parts = file.split('_');
    if (parts.length < 2) continue;
    
    const hospitalId = parts[1];
    if (!mongoose.Types.ObjectId.isValid(hospitalId)) continue;

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      console.log(`Hospital ${hospitalId} not found for file ${file}`);
      continue;
    }

    const url = '/uploads/slideshow/' + file;
    const exists = hospital.slideshow.some(s => s.url === url || s.filename === file);

    if (!exists) {
      console.log(`Recovering orphan file: ${file} for hospital ${hospital.name}`);
      const isVideo = file.endsWith('.mp4') || file.endsWith('.webm');
      hospital.slideshow.push({
        url,
        filename: file,
        type: isVideo ? 'video' : 'image',
        duration: 10,
        isActive: true,
        caption: 'Recovered Media'
      });
      await hospital.save();
    }
  }

  console.log('Recovery complete');
  await mongoose.disconnect();
}

recover();
