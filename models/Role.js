const { query } = require('../config/db');

async function findAll() {
  const result = await query('SELECT id, role_name FROM roles ORDER BY id');
  return result.rows;
}

async function findByName(roleName) {
  const result = await query(
    'SELECT id, role_name FROM roles WHERE role_name = $1',
    [roleName]
  );
  return result.rows[0] || null;
}

module.exports = { findAll, findByName };