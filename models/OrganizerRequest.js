const { query, getClient } = require('../config/db');
const httpError = require('../utils/httpError');

function toRequest(row) {
  return {
    id: row.id,
    userId: row.user_id,
    reason: row.reason,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    fullName: row.full_name,
    email: row.email,
    studentIdNo: row.student_id_no,
    reviewedByName: row.reviewed_by_name,
  };
}

const LIST_SELECT = `
  SELECT r.id, r.user_id, r.reason, r.status, r.created_at, r.reviewed_at,
         u.full_name, u.email, u.student_id_no,
         rv.full_name AS reviewed_by_name
  FROM organizer_requests r
  JOIN users u ON u.id = r.user_id
  LEFT JOIN users rv ON rv.id = r.reviewed_by
`;

async function findAll(status, limit) {
  const result = await query(
    `${LIST_SELECT}
     WHERE ($1::text IS NULL OR r.status = $1)
     ORDER BY (r.status = 'pending') DESC, r.created_at DESC
     LIMIT $2::int`,
    [status || null, limit || null]
  );
  return result.rows.map(toRequest);
}

async function findLatestByUser(userId) {
  const result = await query(
    `${LIST_SELECT}
     WHERE r.user_id = $1
     ORDER BY r.created_at DESC, r.id DESC
     LIMIT 1`,
    [userId]
  );
  return result.rows[0] ? toRequest(result.rows[0]) : null;
}

async function findPendingByUser(userId) {
  const result = await query(
    `SELECT id FROM organizer_requests WHERE user_id = $1 AND status = 'pending'`,
    [userId]
  );
  return result.rows[0] || null;
}

async function create(userId, reason) {
  const result = await query(
    `INSERT INTO organizer_requests (user_id, reason)
     VALUES ($1, $2)
     RETURNING id`,
    [userId, reason]
  );
  return result.rows[0].id;
}

async function approve(requestId, reviewerId) {
  const client = await getClient(); 
  try {
    await client.query('BEGIN');

    const found = await client.query(
      'SELECT id, user_id, status FROM organizer_requests WHERE id = $1 FOR UPDATE',
      [requestId]
    );
    const request = found.rows[0];
    if (!request) throw httpError(404, 'Organizer request not found.');
    if (request.status !== 'pending') {
      throw httpError(409, `This request has already been ${request.status}.`);
    }

    await client.query(
      `UPDATE organizer_requests
       SET status = 'approved', reviewed_by = $1, reviewed_at = NOW()
       WHERE id = $2`,
      [reviewerId, requestId]
    );

    const roleUpdate = await client.query(
      `UPDATE users
       SET role_id = (SELECT id FROM roles WHERE role_name = 'organizer')
       WHERE id = $1
         AND role_id = (SELECT id FROM roles WHERE role_name = 'student')
       RETURNING full_name`,
      [request.user_id]
    );
    if (roleUpdate.rowCount === 0) {
      throw httpError(409, 'This user is no longer a student, so the role was not changed.');
    }

    await client.query('COMMIT');
    return {
      requestId,
      userId: request.user_id,
      fullName: roleUpdate.rows[0].full_name,
    };
  } catch (err) {
    await client.query('ROLLBACK'); 
    throw err;
  } finally {
    client.release();
  }
}

async function reject(requestId, reviewerId) {
  const result = await query(
    `UPDATE organizer_requests
     SET status = 'rejected', reviewed_by = $1, reviewed_at = NOW()
     WHERE id = $2 AND status = 'pending'
     RETURNING id, user_id`,
    [reviewerId, requestId]
  );
  if (result.rowCount === 1) {
    return { requestId: result.rows[0].id, userId: result.rows[0].user_id };
  }

  const existing = await query(
    'SELECT status FROM organizer_requests WHERE id = $1',
    [requestId]
  );
  if (existing.rowCount === 0) throw httpError(404, 'Organizer request not found.');
  throw httpError(409, `This request has already been ${existing.rows[0].status}.`);
}

module.exports = {
  findAll,
  findLatestByUser,
  findPendingByUser,
  create,
  approve,
  reject,
};