const U = {
  superAdmin: 'yangki01@gmail.com',      // Sonam Yangki
  org1: 'srai444@gmail.com',             // Sangay Rai: owns Hackathon, Football, Photography Workshop
  org2: 'otdorji55@gmail.com',           // Tobden Dorji: owns Cultural Night, Career Talk
  hackAdmin: 'tnidp66@gmail.com',        // Tshering Nidup: student, Event Admin for the Hackathon ONLY
  cultAdmin: 'tdorji77@gmail.com',       // Tshering Dorji: student, Event Admin for Cultural Night ONLY
  dorji: 'dcden92@gmail.com',            // Dorji Choden: normal student
  lhamo: 'wlham@gmail.com',              // Wangchuk Lhamo: student
  choki: 'cdorjj64@gmail.com',           // Choki Dorji: student with a PENDING organizer request
  karma: 'karma.wangmo@gmail.com',       // Karma Wangmo: student, REJECTED request, cancelled Hackathon registration
};

const E = {
  hack: 'Sherubtse Innovation Hackathon',
  cultural: 'Sherubtse Cultural Night',
  football: 'Inter-Class Football Tournament',
  career: 'Career Talk Series',
  draft: 'Photography Workshop',
};

const HINT =
  '\n\nThe test database was built from database/seed.sql, but it does not match ' +
  'tests/helpers/seedData.js.\nEither fix database/seed.sql (a common cause: the events block ' +
  'still uses old organizer emails or titles) or update seedData.js.';

async function verifySeed(sql) {
  const same = (label, actual, expected) => {
    const a = JSON.stringify([...actual].sort());
    const b = JSON.stringify([...expected].sort());
    if (a !== b) {
      throw new Error(`Seed check failed: ${label}\n  expected: ${b}\n  actual  : ${a}${HINT}`);
    }
  };

  const [c] = await sql(`
    SELECT (SELECT COUNT(*) FROM roles)::int                    AS roles,
           (SELECT COUNT(*) FROM users)::int                    AS users,
           (SELECT COUNT(*) FROM venues)::int                   AS venues,
           (SELECT COUNT(*) FROM events)::int                   AS events,
           (SELECT COUNT(*) FROM schedules)::int                AS schedules,
           (SELECT COUNT(*) FROM registrations)::int            AS registrations,
           (SELECT COUNT(*) FROM attendance)::int               AS attendance,
           (SELECT COUNT(*) FROM organizer_requests)::int       AS organizer_requests,
           (SELECT COUNT(*) FROM event_admin_assignments)::int  AS event_admin_assignments,
           (SELECT COUNT(*) FROM notifications)::int            AS notifications`);
  same('row counts', Object.entries(c).map(([k, v]) => `${k}=${v}`), [
    'roles=3', 'users=9', 'venues=6', 'events=5', 'schedules=8', 'registrations=12',
    'attendance=4', 'organizer_requests=4', 'event_admin_assignments=2', 'notifications=4',
  ]);

  const roles = await sql(
    `SELECT u.email, r.role_name FROM users u JOIN roles r ON r.id = u.role_id`);
  same('user roles', roles.map((r) => `${r.email}=${r.role_name}`), [
    `${U.superAdmin}=super_admin`, `${U.org1}=organizer`, `${U.org2}=organizer`,
    `${U.hackAdmin}=student`, `${U.cultAdmin}=student`, `${U.dorji}=student`,
    `${U.lhamo}=student`, `${U.choki}=student`, `${U.karma}=student`,
  ]);

  const events = await sql(
    `SELECT e.title, u.email AS owner, e.status, v.name AS venue
     FROM events e JOIN users u ON u.id = e.organizer_id JOIN venues v ON v.id = e.venue_id`);
  same('events (title | owner | status | venue)',
    events.map((r) => `${r.title}|${r.owner}|${r.status}|${r.venue}`), [
      `${E.hack}|${U.org1}|published|ITLT`,
      `${E.cultural}|${U.org2}|published|Auditorium`,
      `${E.football}|${U.org1}|published|MPH`,
      `${E.career}|${U.org2}|completed|New LT`,
      `${E.draft}|${U.org1}|draft|Seminar Hall`,
    ]);

  const regs = await sql(
    `SELECT e.title, r.status, COUNT(*)::int AS n
     FROM registrations r JOIN events e ON e.id = r.event_id GROUP BY e.title, r.status`);
  same('registrations per event (title | status | count)',
    regs.map((r) => `${r.title}|${r.status}|${r.n}`), [
      `${E.hack}|registered|3`, `${E.hack}|cancelled|1`,
      `${E.cultural}|registered|2`, `${E.football}|registered|2`, `${E.career}|registered|4`,
    ]);

  const att = await sql(
    `SELECT u.email, a.attendance_status FROM attendance a
     JOIN registrations r ON r.id = a.registration_id JOIN users u ON u.id = r.user_id`);
  same('Career Talk attendance', att.map((r) => `${r.email}=${r.attendance_status}`), [
    `${U.hackAdmin}=present`, `${U.cultAdmin}=present`, `${U.dorji}=absent`, `${U.lhamo}=present`,
  ]);

  const assignments = await sql(
    `SELECT e.title, u.email FROM event_admin_assignments a
     JOIN events e ON e.id = a.event_id JOIN users u ON u.id = a.user_id`);
  same('Event Admin assignments (event | user)', assignments.map((r) => `${r.title}|${r.email}`), [
    `${E.hack}|${U.hackAdmin}`, `${E.cultural}|${U.cultAdmin}`,
  ]);

  const requests = await sql(
    `SELECT u.email, r.status FROM organizer_requests r JOIN users u ON u.id = r.user_id`);
  same('organizer requests', requests.map((r) => `${r.email}=${r.status}`), [
    `${U.org1}=approved`, `${U.org2}=approved`, `${U.choki}=pending`, `${U.karma}=rejected`,
  ]);
}

module.exports = { U, E, verifySeed };