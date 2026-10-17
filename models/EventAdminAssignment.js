const { query } = require('../config/db');

function toAssignment(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    userId: row.user_id,
    assignedAt: row.assigned_at,
    eventTitle: row.event_title,
    eventDate: row.event_date,
    userName: row.user_name,
    userEmail: row.user_email,
    assignedByName: row.assigned_by_name,
  };
}

async function findAll() {
  const result = await query(
    `SELECT a.id, a.event_id, a.user_id, a.assigned_at,
            e.title AS event_title, e.event_date,
            u.full_name AS user_name, u.email AS user_email,
            ab.full_name AS assigned_by_name
     FROM event_admin_assignments a
     JOIN events e ON e.id = a.event_id
     JOIN users  u ON u.id = a.user_id
     LEFT JOIN users ab ON ab.id = a.assigned_by
     ORDER BY e.event_date DESC, e.title, u.full_name`
  );
  return result.rows.map(toAssignment);
}

async function create(eventId, userId, assignedBy) {
  const result = await query(
    `INSERT INTO event_admin_assignments (event_id, user_id, assigned_by)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [eventId, userId, assignedBy]
  );
  return result.rows[0].id;
}

async function removeById(id) {
  const result = await query(
    'DELETE FROM event_admin_assignments WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rowCount > 0;
}

async function removeByEventAndUser(eventId, userId) {
  const result = await query(
    'DELETE FROM event_admin_assignments WHERE event_id = $1 AND user_id = $2 RETURNING id',
    [eventId, userId]
  );
  return result.rowCount > 0;
}

async function exists(eventId, userId) {
  const result = await query(
    'SELECT 1 FROM event_admin_assignments WHERE event_id = $1 AND user_id = $2',
    [eventId, userId]
  );
  return result.rowCount > 0;
}

async function findEventsForUser(userId) {
  const result = await query(
    `SELECT e.id, e.title, e.event_date, e.status, v.name AS venue_name,
            (SELECT COUNT(*) FROM registrations r
              WHERE r.event_id = e.id AND r.status = 'registered')::int AS registered_count,
            (SELECT COUNT(*) FROM attendance att
               JOIN registrations r2 ON r2.id = att.registration_id
              WHERE r2.event_id = e.id AND r2.status = 'registered')::int AS marked_count
     FROM event_admin_assignments asg
     JOIN events e ON e.id = asg.event_id
     LEFT JOIN venues v ON v.id = e.venue_id
     WHERE asg.user_id = $1
     ORDER BY e.event_date DESC, e.title`,
    [userId]
  );
  return result.rows.map((row) => ({
    id: row.id,
    title: row.title,
    eventDate: row.event_date,
    status: row.status,
    venueName: row.venue_name,
    registeredCount: row.registered_count,
    markedCount: row.marked_count,
  }));
}

module.exports = {
  findAll,
  create,
  removeById,
  removeByEventAndUser,
  exists,
  findEventsForUser,
};