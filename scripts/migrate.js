require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool } = require('../src/db');

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, '..', 'migrations', '001_init.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migrazione completata.');
  await pool.end();
}

migrate().catch((err) => {
  console.error(err);
  process.exit(1);
});
