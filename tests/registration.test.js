const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U, E } = require('./helpers/seedData');

let t, dorji, nidup, choki, karma, sa, org1, ids;

before(async () => {
  t = await startTestApp();
  [dorji, nidup, choki, karma, sa, org1] = await Promise.all(
    [U.dorji, U.hackAdmin, U.choki, U.karma, U.superAdmin, U.org1].map((email) => t.loginAs(email))
  );
  ids = {
    football: await t.eventId(E.football),
    cultural: await t.eventId(E.cultural),
    career: await t.eventId(E.career),
    draft: await t.eventId(E.draft),
    dorji: await t.userId(U.dorji),
    nidup: await t.userId(U.hackAdmin),
  };
});
after(async () => { await t.close(); });

const rowsFor = (userId, eventId) =>
  t.sql('SELECT status FROM registrations WHERE user_id = $1 AND event_id = $2', [userId, eventId]);

describe('register, duplicate, cancel, register again', () => {
  test('a student registers', async () => {
    const res = await dorji.post(`/api/events/${ids.football}/register`);
    assert.equal(res.status, 201);
    assert.equal(res.json.data.status, 'registered');
  });

  test('registering twice is a 409 and leaves exactly one row', async () => {
    const res = await dorji.post(`/api/events/${ids.football}/register`);
    assert.equal(res.status, 409);
    assert.equal((await rowsFor(ids.dorji, ids.football)).length, 1);
  });

  test('cancel works once, then 409', async () => {
    assert.equal((await dorji.del(`/api/events/${ids.football}/register`)).status, 200);
    assert.equal((await dorji.del(`/api/events/${ids.football}/register`)).status, 409);
  });

  test('registering again reuses the same row (still exactly one row)', async () => {
    assert.equal((await dorji.post(`/api/events/${ids.football}/register`)).status, 201);
    const rows = await rowsFor(ids.dorji, ids.football);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, 'registered');
  });

  test('cancelling something you never registered for is a 404', async () => {
    // Choki is registered for Football only
    assert.equal((await choki.del(`/api/events/${ids.cultural}/register`)).status, 404);
  });
});

describe('who and what can be registered', () => {
  test('only students can register', async () => {
    assert.equal((await sa.post(`/api/events/${ids.cultural}/register`)).status, 403);
    assert.equal((await org1.post(`/api/events/${ids.cultural}/register`)).status, 403);
    assert.equal((await t.newClient().post(`/api/events/${ids.cultural}/register`)).status, 401);
  });

  test('draft events look like they do not exist (404)', async () => {
    assert.equal((await choki.post(`/api/events/${ids.draft}/register`)).status, 404);
  });

  test('a past/completed event is closed (409)', async () => {
    assert.equal((await choki.post(`/api/events/${ids.career}/register`)).status, 409);
  });

  test('a cancelled event is closed (409)', async () => {
    await t.sql(`UPDATE events SET status = 'cancelled' WHERE id = $1`, [ids.cultural]);
    const res = await choki.post(`/api/events/${ids.cultural}/register`);
    assert.equal(res.status, 409);
    assert.match(res.json.message, /cancelled/i);
    await t.sql(`UPDATE events SET status = 'published' WHERE id = $1`, [ids.cultural]);
  });

  test('bad ids: 400 for malformed, 404 for missing', async () => {
    assert.equal((await choki.post('/api/events/abc/register')).status, 400);
    assert.equal((await choki.post('/api/events/999999/register')).status, 404);
  });

  test('attendance already recorded: the registration cannot be cancelled', async () => {
    // Tshering Nidup attended (present) the completed Career Talk Series in the seed
    const res = await nidup.del(`/api/events/${ids.career}/register`);
    assert.equal(res.status, 409);
    const rows = await rowsFor(ids.nidup, ids.career);
    assert.equal(rows[0].status, 'registered');
  });

  test('"my registrations" shows status and the cancel flag', async () => {
    const res = await nidup.get('/api/registrations/me');
    assert.equal(res.status, 200);
    const list = res.json.data.registrations;
    assert.equal(list.length, 3); // Hackathon, Cultural Night, Career Talk
    const career = list.find((r) => r.eventTitle === E.career);
    assert.equal(career.attendanceStatus, 'present');
    assert.equal(career.canCancel, false);
  });
});

describe('capacity', () => {
  let tinyId;

  test('five students race for the last seat: exactly one wins', async () => {
    const [{ id }] = await t.sql(
      `INSERT INTO events (title, description, event_date, capacity, organizer_id, venue_id, status)
       VALUES ('Tiny Race Event', 'x', CURRENT_DATE + 5, 1, $1, $2, 'published') RETURNING id`,
      [await t.userId(U.org1), await t.venueId('ITLT')]
    );
    tinyId = id;

    const students = await Promise.all(
      [U.hackAdmin, U.cultAdmin, U.dorji, U.lhamo, U.choki].map((email) => t.loginAs(email))
    );
    const results = await Promise.all(students.map((c) => c.post(`/api/events/${tinyId}/register`)));

    assert.deepEqual(results.map((r) => r.status).sort(), [201, 409, 409, 409, 409]);
    const [count] = await t.sql(
      `SELECT COUNT(*)::int AS n FROM registrations WHERE event_id = $1 AND status = 'registered'`, [tinyId]);
    assert.equal(count.n, 1);
  });

  test('a full event answers 409 "full" and the page says so', async () => {
    const res = await karma.post(`/api/events/${tinyId}/register`);
    assert.equal(res.status, 409);
    assert.match(res.json.message, /full/i);

    const page = await karma.get(`/events/${tinyId}`);
    assert.match(page.text, /This event is full/);
  });

  test('registered never exceeds capacity for any event', async () => {
    const [bad] = await t.sql(
      `SELECT COUNT(*)::int AS n FROM events e
       WHERE (SELECT COUNT(*) FROM registrations r WHERE r.event_id = e.id AND r.status = 'registered') > e.capacity`);
    assert.equal(bad.n, 0);
  });
});

describe('registration from the web page', () => {
  test('the form registers, then the page shows it', async () => {
    const res = await choki.postForm(`/events/${ids.cultural}/register`, {});
    assert.equal(res.status, 302);
    assert.equal(res.location, `/events/${ids.cultural}`);
    const page = await choki.get(`/events/${ids.cultural}`);
    assert.match(page.text, /You are registered/);
  });
});