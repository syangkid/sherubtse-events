const { query, getClient } = require('../config/db');
const httpError = require('../utils/httpError');

const BASE_SELECT = `
  SELECT e.id, e.title, e.description, e.event_date, e.capacity, e.status,
         e.organizer_id, e.venue_id, e.created_at,
         u.full_name AS organizer_name,
         v.name      AS venue_name,
         v.capacity  AS venue_capacity,
         (SELECT COUNT(*) FROM registrations r
           WHERE r.event_id = e.id AND r.status = 'registered')::int AS registered_count
  FROM events e
  JOIN users u ON u.id = e.organizer_id
  LEFT JOIN venues v ON v.id = e.venue_id
`;

function toEvent(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    capacity: row.capacity,
    status: row.status,
    organizerId: row.organizer_id,
    organizerName: row.organizer_name,
    venueId: row.venue_id,
    venueName: row.venue_name,
    venueCapacity: row.venue_capacity,
    registeredCount: row.registered_count,
    myRegistrationStatus: row.my_registration_status || null, 
    createdAt: row.created_at,
  };
}

async function findAll({ organizerId, hideDrafts } = {}) {
  const result = await query(
    `${BASE_SELECT}
     WHERE ($1::int IS NULL OR e.organizer_id = $1)
       AND ($2::boolean = FALSE OR e.status <> 'draft')
     ORDER BY e.event_date DESC, e.title`,
    [organizerId || null, Boolean(hideDrafts)]
  );
  return result.rows.map(toEvent);
}

async function findPublic({ search, when, userId } = {}) {
  const result = await query(
    `SELECT e.id, e.title, e.description, e.event_date, e.capacity, e.status,
            e.organizer_id, e.venue_id, e.created_at,
            u.full_name AS organizer_name,
            v.name      AS venue_name,
            v.capacity  AS venue_capacity,
            (SELECT COUNT(*) FROM registrations r
              WHERE r.event_id = e.id AND r.status = 'registered')::int AS registered_count,
            mr.status AS my_registration_status
     FROM events e
     JOIN users u ON u.id = e.organizer_id
     LEFT JOIN venues v ON v.id = e.venue_id
     LEFT JOIN registrations mr ON mr.event_id = e.id AND mr.user_id = $1::int
     WHERE e.status <> 'draft'
       AND ($2::text IS NULL
            OR e.title ILIKE '%' || $2::text || '%'
            OR e.description ILIKE '%' || $2::text || '%')
       AND ( $3::text = 'all'
             OR ($3::text = 'upcoming' AND e.status = 'published' AND e.event_date >= CURRENT_DATE)
             OR ($3::text = 'past' AND (e.event_date < CURRENT_DATE OR e.status = 'completed')) )
     ORDER BY CASE WHEN $3::text = 'upcoming' THEN e.event_date END ASC,
              e.event_date DESC, e.title`,
    [userId || null, search || null, when || 'upcoming']
  );
  return result.rows.map(toEvent);
}

async function findById(id) {
  const result = await query(`${BASE_SELECT} WHERE e.id = $1`, [id]);
  return result.rows[0] ? toEvent(result.rows[0]) : null;
}

async function create({ title, description, eventDate, capacity, organizerId, venueId, status }) {
  const result = await query(
    `INSERT INTO events
       (title, description, event_date, capacity, organizer_id, venue_id, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [title, description, eventDate, capacity, organizerId, venueId, status]
  );
  return result.rows[0].id;
}

async function update(id, { title, description, eventDate, capacity, venueId, status }) {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // Lock the event row so nobody else edits it at the same moment
    const locked = await client.query(
      'SELECT id FROM events WHERE id = $1 FOR UPDATE',
      [id]
    );
    if (locked.rowCount === 0) throw httpError(404, 'Event not found.');

    await client.query(
      `UPDATE schedules s
       SET start_time = s.start_time + (($1::date - e.event_date) * INTERVAL '1 day'),
           end_time   = s.end_time   + (($1::date - e.event_date) * INTERVAL '1 day')
       FROM events e
       WHERE e.id = s.event_id AND s.event_id = $2`,
      [eventDate, id]
    );

    await client.query(
      `UPDATE events
       SET title = $1, description = $2, event_date = $3,
           capacity = $4, venue_id = $5, status = $6
       WHERE id = $7`,
      [title, description, eventDate, capacity, venueId, status, id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function remove(id) {
  const result = await query(
    `DELETE FROM events
     WHERE id = $1
       AND NOT EXISTS (SELECT 1 FROM registrations WHERE event_id = $1)
     RETURNING id`,
    [id]
  );
  return result.rowCount > 0;
}

function canManage(user, event) {
  if (!user || !event) return false;
  if (user.role === 'super_admin') return true;
  if (user.role === 'organizer' && event.organizerId === user.id) return true;
  return false;
}

module.exports = { findAll, findPublic, findById, create, update, remove, canManage };