const { query } = require('../config/db');

function toVenue(row) {
  return {
    id: row.id,
    name: row.name,
    location: row.location,
    capacity: row.capacity,
    description: row.description,
    eventCount: row.event_count,
  };
}

const BASE_SELECT = `
  SELECT v.id, v.name, v.location, v.capacity, v.description,
         (SELECT COUNT(*) FROM events e WHERE e.venue_id = v.id)::int AS event_count
  FROM venues v
`;

async function findAll() {
  const result = await query(`${BASE_SELECT} ORDER BY v.name`);
  return result.rows.map(toVenue);
}

async function findById(id) {
  const result = await query(`${BASE_SELECT} WHERE v.id = $1`, [id]);
  return result.rows[0] ? toVenue(result.rows[0]) : null;
}

async function create({ name, location, capacity, description }) {
  const result = await query(
    `INSERT INTO venues (name, location, capacity, description)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [name, location, capacity, description]
  );
  return result.rows[0].id;
}

async function update(id, { name, location, capacity, description }) {
  const result = await query(
    `UPDATE venues
     SET name = $1, location = $2, capacity = $3, description = $4
     WHERE id = $5
     RETURNING id`,
    [name, location, capacity, description, id]
  );
  return result.rowCount > 0;
}

async function countEventsOverCapacity(id, newCapacity) {
  const result = await query(
    'SELECT COUNT(*)::int AS n FROM events WHERE venue_id = $1 AND capacity > $2',
    [id, newCapacity]
  );
  return result.rows[0].n;
}

async function remove(id) {
  const result = await query('DELETE FROM venues WHERE id = $1 RETURNING id', [id]);
  return result.rowCount > 0;
}

module.exports = { findAll, findById, create, update, countEventsOverCapacity, remove };