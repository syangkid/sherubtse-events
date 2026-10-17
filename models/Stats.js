const { query } = require('../config/db');

async function getSuperAdminStats() {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM users)::int                                   AS total_users,
       (SELECT COUNT(*) FROM events)::int                                  AS total_events,
       (SELECT COUNT(*) FROM organizer_requests WHERE status = 'pending')::int AS pending_requests,
       (SELECT COUNT(*) FROM events
         WHERE status = 'published' AND event_date >= CURRENT_DATE)::int   AS upcoming_events,
       (SELECT COUNT(*) FROM registrations WHERE status = 'registered')::int AS active_registrations,
       (SELECT COUNT(*) FROM attendance)::int                              AS attendance_records`
  );
  const row = result.rows[0];
  return {
    totalUsers: row.total_users,
    totalEvents: row.total_events,
    pendingRequests: row.pending_requests,
    upcomingEvents: row.upcoming_events,
    activeRegistrations: row.active_registrations,
    attendanceRecords: row.attendance_records,
  };
}

async function getOrganizerStats(organizerId) {
  const result = await query(
    `SELECT
       (SELECT COUNT(*) FROM events WHERE organizer_id = $1)::int AS my_events,
       (SELECT COUNT(*) FROM events
         WHERE organizer_id = $1 AND status = 'published'
           AND event_date >= CURRENT_DATE)::int                   AS upcoming_events,
       (SELECT COUNT(*) FROM registrations r
          JOIN events e ON e.id = r.event_id
         WHERE e.organizer_id = $1 AND r.status = 'registered')::int AS total_participants,
       (SELECT COUNT(*) FROM attendance a
          JOIN registrations r ON r.id = a.registration_id
          JOIN events e ON e.id = r.event_id
         WHERE e.organizer_id = $1
           AND a.attendance_status = 'present')::int              AS attended`,
    [organizerId]
  );
  const row = result.rows[0];
  return {
    myEvents: row.my_events,
    upcomingEvents: row.upcoming_events,
    totalParticipants: row.total_participants,
    attended: row.attended,
  };
}

module.exports = { getSuperAdminStats, getOrganizerStats };