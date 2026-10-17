const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const allowed = ['schema', 'seed'];
const name = process.argv[2];

async function main() {
  if (!allowed.includes(name)) {
    console.error('Usage: node database/run.js <schema|seed>');
    process.exitCode = 1;
    return;
  }

  const file = path.join(__dirname, `${name}.sql`);
  const sql = fs.readFileSync(file, 'utf8');

  try {
    await pool.query(sql);
    console.log(`${name}.sql executed successfully`);
  } catch (err) {
    console.error(`${name}.sql FAILED`);
    console.error('  Reason  :', err.message);
    if (err.position) console.error('  Position:', err.position, '(character offset in the file)');
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();