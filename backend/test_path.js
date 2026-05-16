const path = require('path');
const fs = require('fs');

const __dirname_sim = 'C:\\Users\\g_var\\Downloads\\hospital-system-complete-v5\\hospital-system\\backend\\routes';
const BACKUP_DIR = path.resolve(__dirname_sim, '../backups');
const filename = 'full_backup_2026-05-16T18-48-49.zip';
const fp = path.join(BACKUP_DIR, filename);

console.log('__dirname_sim:', __dirname_sim);
console.log('BACKUP_DIR:', BACKUP_DIR);
console.log('filename:', filename);
console.log('Full Path:', fp);
console.log('Exists:', fs.existsSync(fp));

if (fs.existsSync(BACKUP_DIR)) {
  console.log('Contents of BACKUP_DIR:', fs.readdirSync(BACKUP_DIR));
}
