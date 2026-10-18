require('dotenv').config({ quiet: true });
const { Client } = require('pg');

const testDb = process.env.DB_NAME_TEST || 'sherubtse_events_test';

async function main() {
  if (!/^[a-z0-9_]+_test$/.test(testDb)) {
    throw new Error(
      `Test database name must be lowercase letters/numbers/underscores and end in "_test": ${testDb}`
    );
  }

  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT) || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'postgres',
  });

  await client.connect();
  try {
    const exists = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [testDb]);
    if (exists.rowCount > 0) {
      console.log(`Test database "${testDb}" already exists. Nothing to do.`);
    } else {
      await client.query(`CREATE DATABASE "${testDb}"`);
      console.log(`Test database "${testDb}" created.`);
    }
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Could not create the test database:', err.message);
  process.exitCode = 1;
});