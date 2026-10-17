const { query } = require('../config/db');

function toNotification(row) {
  return {
    id: row.id,
    message: row.message,
    status: row.status, 
    createdAt: row.created_at,
  };
}

async function create(userId, message) {
  const result = await query(
    'INSERT INTO notifications (user_id, message) VALUES ($1, $2) RETURNING id',
    [userId, message]
  );
  return result.rows[0].id;
}

async function createForSuperAdmins(message) {
  const result = await query(
    `INSERT INTO notifications (user_id, message)
     SELECT u.id, $1::text
     FROM users u
     JOIN roles ro ON ro.id = u.role_id
     WHERE ro.role_name = 'super_admin'`,
    [message]
  );
  return result.rowCount;
}

async function findByUser(userId, limit = 50) {
  const result = await query(
    `SELECT id, message, status, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC, id DESC
     LIMIT $2`,
    [userId, limit]
  );
  return result.rows.map(toNotification);
}

async function countUnread(userId) {
  const result = await query(
    `SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND status = 'unread'`,
    [userId]
  );
  return result.rows[0].n;
}

async function markRead(id, userId) {
  const result = await query(
    `UPDATE notifications SET status = 'read'
     WHERE id = $1 AND user_id = $2
     RETURNING id`,
    [id, userId]
  );
  return result.rowCount > 0;
}

async function markAllRead(userId) {
  const result = await query(
    `UPDATE notifications SET status = 'read'
     WHERE user_id = $1 AND status = 'unread'`,
    [userId]
  );
  return result.rowCount;
}

module.exports = {
  create,
  createForSuperAdmins,
  findByUser,
  countUnread,
  markRead,
  markAllRead,
};