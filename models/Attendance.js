const { query } = require('../config/db');

function toParticipant(row) {
  return {
    registrationId: row.id,
    status: row.status, 
    registeredAt: row.registered_at,
    userId: row.user_id,
    fullName: row.full_name,
    email: row.email,
    studentIdNo: row.student_id_no,
    phone: row.phone,
    attendanceStatus: row.attendance_status, 
    markedAt: row.marked_at,
    markedByName: row.marked_by_name,
  };
}

async function findParticipants(eventId) {
  const result = await query(
    `SELECT r.id, r.status, r.registered_at,
            u.id AS user_id, u.full_name, u.email, u.student_id_no, u.phone,
            a.attendance_status, a.marked_at,
            mb.full_name AS marked_by_name
     FROM registrations r
     JOIN users u ON u.id = r.user_id
     LEFT JOIN attendance a ON a.registration_id = r.id
     LEFT JOIN users mb ON mb.id = a.marked_by
     WHERE r.event_id = $1
     ORDER BY (r.status = 'registered') DESC, u.full_name`,
    [eventId]
  );
  return result.rows.map(toParticipant);
}

async function mark(eventId, registrationId, status, markedBy) {
  const result = await query(
    `INSERT INTO attendance (registration_id, attendance_status, marked_by)
     SELECT r.id, $3::varchar, $4::int
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     WHERE r.id = $1 AND r.event_id = $2
       AND r.status = 'registered'
       AND e.status IN ('published', 'completed')
       AND e.event_date <= CURRENT_DATE
     ON CONFLICT (registration_id) DO UPDATE
       SET attendance_status = EXCLUDED.attendance_status,
           marked_at = NOW(),
           marked_by = EXCLUDED.marked_by
     RETURNING registration_id,
               attendance_status,
               (SELECT r2.user_id FROM registrations r2 WHERE r2.id = $1) AS user_id`,
    [registrationId, eventId, status, markedBy]
  );
  if (result.rowCount === 0) return null;
  const row = result.rows[0];
  return {
    registrationId: row.registration_id,
    userId: row.user_id,
    status: row.attendance_status,
  };
}

module.exports = { findParticipants, mark };