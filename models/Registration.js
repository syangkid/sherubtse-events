const { query, getClient } = require('../config/db');
const httpError = require('../utils/httpError');

function toRegistration(row) {
  const isUpcoming = row.is_upcoming;
  return {
    id: row.id,
    status: row.status,
    registeredAt: row.registered_at,
    eventId: row.event_id,
    eventTitle: row.title,
    eventDate: row.event_date,
    eventStatus: row.event_status,
    venueName: row.venue_name,
    attendanceStatus: row.attendance_status, 
    isUpcoming,
    canCancel:
      row.status === 'registered' &&
      isUpcoming &&
      row.event_status !== 'completed' &&
      !row.attendance_status,
  };
}

async function findOne(userId, eventId) {
  const result = await query(
    'SELECT id, status FROM registrations WHERE user_id = $1 AND event_id = $2',
    [userId, eventId]
  );
  return result.rows[0] || null;
}

async function findByUser(userId) {
  const result = await query(
    `SELECT r.id, r.status, r.registered_at, r.event_id,
            e.title, e.event_date, e.status AS event_status,
            v.name AS venue_name,
            a.attendance_status,
            (e.event_date >= CURRENT_DATE) AS is_upcoming
     FROM registrations r
     JOIN events e ON e.id = r.event_id
     LEFT JOIN venues v ON v.id = e.venue_id
     LEFT JOIN attendance a ON a.registration_id = r.id
     WHERE r.user_id = $1
     ORDER BY e.event_date DESC, r.id DESC`,
    [userId]
  );
  return result.rows.map(toRegistration);
}

async function countsForUser(userId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM events
         WHERE status = 'published' AND event_date >= CURRENT_DATE)::int AS available_events,
       (SELECT COUNT(*) FROM registrations
         WHERE user_id = $1 AND status = 'registered')::int              AS my_registrations,
       (SELECT COUNT(*) FROM registrations r
          JOIN events e ON e.id = r.event_id
         WHERE r.user_id = $1 AND r.status = 'registered'
           AND e.event_date >= CURRENT_DATE)::int                       AS upcoming_registered,
       (SELECT COUNT(*) FROM attendance a
          JOIN registrations r ON r.id = a.registration_id
         WHERE r.user_id = $1 AND a.attendance_status = 'present')::int AS attended`,
    [userId]
  );
  const row = result.rows[0];
  return {
    availableEvents: row.available_events,
    myRegistrations: row.my_registrations,
    upcomingRegistered: row.upcoming_registered,
    attended: row.attended,
  };
}

async function register(userId, eventId) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const found = await client.query(
      `SELECT id, title, status, capacity, (event_date >= CURRENT_DATE) AS is_upcoming
       FROM events WHERE id = $1 FOR UPDATE`,
      [eventId]
    );
    const event = found.rows[0];

    if (!event || event.status === 'draft') throw httpError(404, 'Event not found.');
    if (event.status === 'cancelled') throw httpError(409, 'This event has been cancelled.');
    if (event.status !== 'published') throw httpError(409, 'Registration is closed for this event.');
    if (!event.is_upcoming) throw httpError(409, 'This event has already taken place.');

    const existing = await client.query(
      'SELECT id, status FROM registrations WHERE user_id = $1 AND event_id = $2',
      [userId, eventId]
    );
    const current = existing.rows[0];
    if (current && current.status === 'registered') {
      throw httpError(409, 'You are already registered for this event.');
    }

    const taken = await client.query(
      `SELECT COUNT(*)::int AS n FROM registrations
       WHERE event_id = $1 AND status = 'registered'`,
      [eventId]
    );
    if (taken.rows[0].n >= event.capacity) {
      throw httpError(409, 'Sorry, this event is full.');
    }

    let registrationId;
    if (current) {
      await client.query(
        `UPDATE registrations SET status = 'registered', registered_at = NOW() WHERE id = $1`,
        [current.id]
      );
      registrationId = current.id;
    } else {
      const inserted = await client.query(
        'INSERT INTO registrations (user_id, event_id) VALUES ($1, $2) RETURNING id',
        [userId, eventId]
      );
      registrationId = inserted.rows[0].id;
    }

    await client.query('COMMIT');
    return { registrationId, eventId, eventTitle: event.title };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function cancel(userId, eventId) {
  const result = await query(
    `UPDATE registrations r
     SET status = 'cancelled'
     FROM events e
     WHERE r.event_id = e.id
       AND r.user_id = $1 AND r.event_id = $2
       AND r.status = 'registered'
       AND e.event_date >= CURRENT_DATE
       AND e.status <> 'completed'
       AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.registration_id = r.id)
     RETURNING r.id`,
    [userId, eventId]
  );
  if (result.rowCount === 1) return { registrationId: result.rows[0].id };

  const why = await query(
    `SELECT r.status FROM registrations r WHERE r.user_id = $1 AND r.event_id = $2`,
    [userId, eventId]
  );
  if (why.rowCount === 0) throw httpError(404, 'You are not registered for this event.');
  if (why.rows[0].status === 'cancelled') {
    throw httpError(409, 'Your registration is already cancelled.');
  }
  throw httpError(
    409,
    'This registration can no longer be cancelled because the event has started, finished, or attendance was recorded.'
  );
}

module.exports = { findOne, findByUser, countsForUser, register, cancel };