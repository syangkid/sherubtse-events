const { query } = require('../config/db');

const BASE_SELECT = `
  SELECT u.id, u.full_name, u.email, u.student_id_no, u.phone,
         u.is_verified, u.created_at,
         r.role_name AS role,
         EXISTS (
           SELECT 1 FROM event_admin_assignments a WHERE a.user_id = u.id
         ) AS is_event_admin
  FROM users u
  JOIN roles r ON r.id = u.role_id
`;

function toUser(row) {
  return {
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    studentIdNo: row.student_id_no,
    phone: row.phone,
    role: row.role,
    isVerified: row.is_verified,
    isEventAdmin: row.is_event_admin,
    createdAt: row.created_at,
  };
}

async function findById(id) {
  const result = await query(`${BASE_SELECT} WHERE u.id = $1`, [id]);
  return result.rows[0] ? toUser(result.rows[0]) : null;
}

async function findCredentialsByEmail(email) {
  const result = await query(
    'SELECT id, password_hash FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return result.rows[0] || null;
}

async function emailExists(email) {
  const result = await query(
    'SELECT 1 FROM users WHERE LOWER(email) = LOWER($1)',
    [email]
  );
  return result.rowCount > 0;
}

async function studentIdExists(studentIdNo) {
  const result = await query(
    'SELECT 1 FROM users WHERE student_id_no = $1',
    [studentIdNo]
  );
  return result.rowCount > 0;
}

async function create({ fullName, email, passwordHash, studentIdNo, phone, roleId }) {
  const result = await query(
    `INSERT INTO users
       (full_name, email, password_hash, student_id_no, phone, role_id, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, TRUE)
     RETURNING id`,
    [fullName, email, passwordHash, studentIdNo || null, phone || null, roleId]
  );
  return findById(result.rows[0].id);
}

async function findAll({ search, role } = {}) {
  const result = await query(
    `SELECT u.id, u.full_name, u.email, u.student_id_no, u.phone,
            u.is_verified, u.created_at,
            r.role_name AS role,
            (SELECT COUNT(*) FROM event_admin_assignments a
              WHERE a.user_id = u.id)::int AS assigned_event_count
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE ($1::text IS NULL
            OR u.full_name ILIKE '%' || $1 || '%'
            OR u.email ILIKE '%' || $1 || '%'
            OR u.student_id_no ILIKE '%' || $1 || '%')
       AND ($2::text IS NULL OR r.role_name = $2)
     ORDER BY u.id
     LIMIT 200`,
    [search || null, role || null]
  );

  return result.rows.map((row) => ({
    ...toUser({ ...row, is_event_admin: row.assigned_event_count > 0 }),
    assignedEventCount: row.assigned_event_count,
  }));
}

async function findAssignable() {
  const result = await query(
    `SELECT u.id, u.full_name, u.email, r.role_name AS role
     FROM users u
     JOIN roles r ON r.id = u.role_id
     WHERE r.role_name <> 'super_admin'
     ORDER BY u.full_name`
  );
  return result.rows.map((row) => ({
    id: row.id,
    fullName: row.full_name,
    email: row.email,
    role: row.role,
  }));
}

module.exports = {
  findById,
  findCredentialsByEmail,
  emailExists,
  studentIdExists,
  create,
  findAll,
  findAssignable,
};