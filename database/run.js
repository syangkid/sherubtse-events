const fs = require('fs');
const path = require('path');
const { pool } = require('../config/db');

const allowed = ['schema', 'seed'];
const [name, ...flags] = process.argv.slice(2);
const confirmed = flags.includes('--yes');

function describeTarget() {
  if (process.env.DATABASE_URL) {
    try {
      const u = new URL(process.env.DATABASE_URL);
      return `${u.hostname}${u.pathname}`;
    } catch {
      return '(DATABASE_URL)';
    }
  }
  return `${process.env.DB_HOST}/${process.env.DB_NAME}`;
}

const isRemote = Boolean(process.env.DATABASE_URL) || process.env.NODE_ENV === 'production';

async function main() {
  if (!allowed.includes(name)) {
    console.error('Usage: node database/run.js <schema|seed> [--yes]');
    process.exitCode = 1;
    return;
  }

  console.log(`Target database: ${describeTarget()}`);

  if (isRemote && !confirmed) {
    console.error('This looks like a REMOTE/production database.');
    console.error(`schema.sql deletes all tables and data. Add --yes to continue:`);
    console.error(`  node database/run.js ${name} --yes`);
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