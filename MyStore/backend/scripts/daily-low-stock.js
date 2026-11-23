const path = require('node:path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const pool = require('../src/config/db');

async function run() {
  try {
    await pool.query('CALL sp_daily_low_stock_check()');
    console.log('Daily low-stock check completed.');
  } finally {
    await pool.end();
  }
}

run().catch((error) => {
  console.error('Daily low-stock check failed:', error.code || error.message);
  process.exitCode = 1;
});
