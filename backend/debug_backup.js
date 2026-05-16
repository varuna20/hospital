const { runBackup } = require('./utils/backup');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

async function test() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('DB Connected');
  const result = await runBackup();
  console.log('Result:', result);
  process.exit(0);
}

test();
