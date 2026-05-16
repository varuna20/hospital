const axios = require('axios');
const fs = require('fs');

async function testDownload() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMDNjMmMxNjQ5ZGUwMDFiM2Q0ZjBkZSIsImlhdCI6MTc3ODk1Njk5MSwiZXhwIjoxNzc5NTYxNzkxfQ.C45zDg17YCHyiVqGXjprVOLQbZkfpx4jaAkApp3v-SU';
  const filename = 'full_backup_2026-05-16T18-48-49.zip';
  const url = `http://localhost:5000/api/backup/download/${filename}?token=${token}`;

  console.log('Testing download from:', url);
  try {
    const response = await axios.get(url, { responseType: 'stream' });
    console.log('Status:', response.status);
    console.log('Headers:', response.headers);
    
    const writer = fs.createWriteStream('test_download.zip');
    response.data.pipe(writer);

    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log('Download finished. Size:', fs.statSync('test_download.zip').size);
        resolve();
      });
      writer.on('error', reject);
    });
  } catch (err) {
    console.error('Download failed:', err.response?.status, err.message);
    if (err.response?.data) {
      // If it's a stream, we need to read it
      err.response.data.on('data', chunk => console.log('Error Body:', chunk.toString()));
    }
  }
}

testDownload();
