const fs = require('node:fs');
const path = require('node:path');

const backend = path.resolve(__dirname, '..');
const read = (file) => fs.readFileSync(path.join(backend, file), 'utf8').trimEnd();
const schema = read('schema.sql').replace(
  /^\/\*!50106 CREATE\*\/ \/\*!50106 EVENT `ev_daily_low_stock_check`[^\n]*\n/m,
  '-- The alwaysdata Scheduled Task runs sp_daily_low_stock_check instead.\n'
);
if (/\bCREATE(?:\*\/\s*\/\*!\d+)?\s+EVENT\b/i.test(schema)) {
  throw new Error('alwaysdata Public Cloud does not support database events. Check schema.sql.');
}

const migrations = fs.readdirSync(path.join(backend, 'migrations'))
  .filter((file) => file.endsWith('.sql')).sort()
  .map((file) => read(path.join('migrations', file)));

process.stdout.write(['-- Import into a new, empty MariaDB 11.8 demo database.', schema, ...migrations, read('scripts/demo-seed.sql'), ''].join('\n\n'));
