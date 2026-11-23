// Usage: npm run backup
// Saves the whole database (tables, data, views, procedures, functions, triggers and events) to backend/backups/
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const { DB_HOST = 'localhost', DB_PORT, DB_USER, DB_PASSWORD = '', DB_NAME } = process.env;
if (!DB_USER || !DB_NAME) { console.error('DB_USER and DB_NAME must be set in .env'); process.exit(1); }

const keep = Number(process.env.BACKUP_KEEP) || 14;            // how many backups to keep
const dir = path.join(__dirname, '..', 'backups');
fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');   // e.g. 2026-11-14-10-30
const file = path.join(dir, `${DB_NAME}_${stamp}.sql`);

const args = ['-h', DB_HOST, ...(DB_PORT ? ['-P', DB_PORT] : []), '-u', DB_USER,
  '--single-transaction', '--routines', '--events', '--triggers', DB_NAME];

const out = fs.createWriteStream(file);
// The password is passed through the environment so it never appears in the process list
const child = spawn(process.env.MYSQLDUMP_PATH || 'mysqldump', args, {
  env: { ...process.env, MYSQL_PWD: DB_PASSWORD }, stdio: ['ignore', 'pipe', 'pipe'],
});
let errors = '';
child.stdout.pipe(out);
child.stderr.on('data', (d) => { errors += d; });

child.on('error', (err) => {
  fs.rmSync(file, { force: true });
  console.error(err.code === 'ENOENT'
    ? 'mysqldump was not found. Add MySQL\'s bin folder to your PATH, or set MYSQLDUMP_PATH in .env (for example /usr/local/mysql/bin/mysqldump).'
    : err.message);
  process.exit(1);
});

child.on('close', (code) => {
  if (code !== 0) {
    fs.rmSync(file, { force: true });
    console.error(`Backup failed (code ${code}).\n${errors}`);
    process.exit(1);
  }
  out.end(() => {
    const kb = Math.round(fs.statSync(file).size / 1024);
    console.log(`Backup saved: ${file} (${kb} KB)`);
    // Delete the oldest backups beyond the limit
    const old = fs.readdirSync(dir).filter((f) => f.startsWith(`${DB_NAME}_`) && f.endsWith('.sql')).sort().reverse().slice(keep);
    old.forEach((f) => { fs.rmSync(path.join(dir, f)); console.log(`Removed old backup: ${f}`); });
  });
});
