const { query, pool } = require('../config/db');

async function testConnection() {
  try {
    const result = await query(
      'SELECT current_database() AS db, current_user AS user_name, NOW() AS server_time, version() AS pg_version'
    );
    const row = result.rows[0];

    console.log('PostgreSQL connection successful');
    console.log('  Database :', row.db);
    console.log('  User     :', row.user_name);
    console.log('  Time     :', row.server_time);
    console.log('  Version  :', row.pg_version);
  } catch (err) {
    console.error('PostgreSQL connection FAILED');
    console.error('  Reason:', err.message);
    process.exitCode = 1;
  } finally {
    await pool.end(); // close the pool so the script can exit
  }
}

testConnection();