const { query } = require('../config/db');

function toSchedule(row) {
  return {
    id: row.id,
    eventId: row.event_id,
    startTime: row.start_time,
    endTime: row.end_time,
    description: row.description,
  };
}

async function findByEvent(eventId) {
  const result = await query(
    `SELECT id, event_id, start_time, end_time, description
     FROM schedules
     WHERE event_id = $1
     ORDER BY start_time`,
    [eventId]
  );
  return result.rows.map(toSchedule);
}

async function create(eventId, { startTime, endTime, description }) {
  const result = await query(
    `INSERT INTO schedules (event_id, start_time, end_time, description)
     SELECT e.id, e.event_date + $2::time, e.event_date + $3::time, $4
     FROM events e
     WHERE e.id = $1
     RETURNING id`,
    [eventId, startTime, endTime, description]
  );
  return result.rows[0] ? result.rows[0].id : null;
}

async function removeFromEvent(eventId, scheduleId) {
  const result = await query(
    'DELETE FROM schedules WHERE id = $1 AND event_id = $2 RETURNING id',
    [scheduleId, eventId]
  );
  return result.rowCount > 0;
}

module.exports = { findByEvent, create, removeFromEvent };