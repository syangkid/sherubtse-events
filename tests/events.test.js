const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U, E } = require('./helpers/seedData');

let t, sa, org1, org2, student, lab, hack, cultural, createdId;

before(async () => {
  t = await startTestApp();
  [sa, org1, org2, student] = await Promise.all(
    [U.superAdmin, U.org1, U.org2, U.dorji].map((email) => t.loginAs(email))
  );
  lab = await t.venueId('ITLT'); // capacity 80
  hack = await t.eventId(E.hack);
  cultural = await t.eventId(E.cultural);
});
after(async () => { await t.close(); });

const eventBody = (over = {}) => ({
  title: 'Test Event', description: 'Created by tests', event_date: t.future(30),
  capacity: 30, venue_id: lab, status: 'published', ...over,
});

describe('create and validate events', () => {
  test('an organizer creates an event they own', async () => {
    const res = await org1.post('/api/events', eventBody());
    assert.equal(res.status, 201);
    createdId = res.json.data.event.id;
    const [row] = await t.sql('SELECT organizer_id FROM events WHERE id = $1', [createdId]);
    assert.equal(row.organizer_id, await t.userId(U.org1));
  });

  test('invalid input is a 400 with field errors', async () => {
    const bad = [
      eventBody({ event_date: '2020-01-01' }),     
      eventBody({ event_date: '2026-02-31' }),   
      eventBody({ title: 'ab' }),           
      eventBody({ capacity: 0 }),
      eventBody({ status: 'cancelled' }),       
      eventBody({ venue_id: '' }),
    ];
    for (const b of bad) {
      const res = await org1.post('/api/events', b);
      assert.equal(res.status, 400, JSON.stringify(b));
      assert.ok(Array.isArray(res.json.errors));
    }
  });

  test('capacity cannot exceed the venue capacity', async () => {
    const res = await org1.post('/api/events', eventBody({ capacity: 500 }));
    assert.equal(res.status, 400);
    assert.match(res.json.message, /venue capacity/i);
  });

  test('capacity cannot drop below current registrations', async () => {

    const res = await org1.put(`/api/events/${hack}`, eventBody({ title: E.hack, capacity: 2 }));
    assert.equal(res.status, 400);
    assert.match(res.json.message, /registration/i);
  });

  test('the owner can update; a different organizer cannot', async () => {
    const ok = await org1.put(`/api/events/${createdId}`, eventBody({ title: 'Renamed Event' }));
    assert.equal(ok.status, 200);
    assert.equal(ok.json.data.event.title, 'Renamed Event');
    assert.equal((await org2.put(`/api/events/${createdId}`, eventBody())).status, 403);
  });
});

describe('schedules', () => {
  test('add, list and remove a slot', async () => {
    const add = await org1.post(`/api/events/${createdId}/schedules`,
      { start_time: '09:00', end_time: '10:30', description: 'Opening' });
    assert.equal(add.status, 201);
    const scheduleId = add.json.data.schedule.id;

    const list = await t.newClient().get(`/api/events/${createdId}/schedules`);
    assert.equal(list.status, 200);
    assert.equal(list.json.data.schedules.length, 1);

    assert.equal((await org1.del(`/api/events/${createdId}/schedules/${scheduleId}`)).status, 200);
    assert.equal((await org1.del(`/api/events/${createdId}/schedules/${scheduleId}`)).status, 404);
  });

  test('bad times are rejected', async () => {
    for (const b of [
      { start_time: '10:00', end_time: '09:00', description: 'Backwards' },
      { start_time: '25:00', end_time: '26:00', description: 'Not a time' },
      { start_time: '09:00', end_time: '10:00', description: '' },
    ]) {
      assert.equal((await org1.post(`/api/events/${createdId}/schedules`, b)).status, 400);
    }
  });

  test('only the owner or Super Admin can change a schedule', async () => {
    const res = await org2.post(`/api/events/${createdId}/schedules`,
      { start_time: '09:00', end_time: '10:00', description: 'Nope' });
    assert.equal(res.status, 403);
  });

  test('a slot can only be deleted through the event it belongs to', async () => {
    const [slot] = await t.sql('SELECT id FROM schedules WHERE event_id = $1 LIMIT 1', [hack]);
    // org2 owns Cultural Night and tries to delete a Hackathon slot through their own event
    const res = await org2.del(`/api/events/${cultural}/schedules/${slot.id}`);
    assert.equal(res.status, 404);
    const [still] = await t.sql('SELECT COUNT(*)::int AS n FROM schedules WHERE id = $1', [slot.id]);
    assert.equal(still.n, 1);
  });

  test('moving the event date moves its schedule (transaction)', async () => {
    await org1.post(`/api/events/${createdId}/schedules`,
      { start_time: '09:00', end_time: '10:00', description: 'Slot to move' });

    const res = await org1.put(`/api/events/${createdId}`,
      eventBody({ title: 'Renamed Event', event_date: t.future(40) }));
    assert.equal(res.status, 200);

    const [bad] = await t.sql(
      `SELECT COUNT(*)::int AS n FROM schedules s JOIN events e ON e.id = s.event_id
       WHERE e.id = $1 AND s.start_time::date <> e.event_date`, [createdId]);
    assert.equal(bad.n, 0, 'every slot must be on the event date');

    const [time] = await t.sql(
      `SELECT to_char(start_time, 'HH24:MI') AS hhmm FROM schedules WHERE event_id = $1`, [createdId]);
    assert.equal(time.hhmm, '09:00', 'time of day must not change');
  });
});

describe('deleting events', () => {
  test('an event with registrations cannot be deleted', async () => {
    const res = await org1.del(`/api/events/${hack}`);
    assert.equal(res.status, 409);
    const [row] = await t.sql('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [hack]);
    assert.equal(row.n, 1);
  });

  test('an empty event can be deleted once', async () => {
    assert.equal((await org1.del(`/api/events/${createdId}`)).status, 200);
    assert.equal((await org1.del(`/api/events/${createdId}`)).status, 404);
  });
});

describe('listing and searching', () => {
  const titles = (res) => res.json.data.events.map((e) => e.title).sort();

  test('public list: 4 events, no draft', async () => {
    const res = await t.newClient().get('/api/events');
    assert.equal(res.status, 200);
    assert.equal(res.json.data.events.length, 4);
  });

  test('search and the when filter', async () => {
    const anon = t.newClient();
    assert.deepEqual(titles(await anon.get('/api/events?search=hack')), [E.hack]);
    assert.deepEqual(titles(await anon.get('/api/events?when=past')), [E.career]);
    assert.equal((await anon.get('/api/events?when=upcoming')).json.data.events.length, 3);
  });

  test('?mine=true returns only the organizer\'s own events (drafts included)', async () => {
    const res = await org1.get('/api/events?mine=true');
    assert.deepEqual(titles(res), [E.football, E.draft, E.hack].sort());
  });

  test('SQL injection in the search box finds nothing and breaks nothing', async () => {
    const res = await t.newClient().get(`/api/events?search=${encodeURIComponent("' OR 1=1 --")}`);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.events.length, 0);
  });
});

describe('venues', () => {
  test('only the Super Admin writes; any logged-in user reads', async () => {
    assert.equal((await org1.post('/api/venues', { name: 'Org Hall', location: 'X', capacity: 10 })).status, 403);
    assert.equal((await t.newClient().get('/api/venues')).status, 401);
    const list = await student.get('/api/venues');
    assert.equal(list.status, 200);
    assert.equal(list.json.data.venues.length, 6);
  });

  test('create, duplicate name, validation, get, update, delete', async () => {
    const create = await sa.post('/api/venues', { name: 'Test Hall', location: 'Demo', capacity: 50 });
    assert.equal(create.status, 201);
    const venueId = create.json.data.venue.id;

    assert.equal((await sa.post('/api/venues', { name: 'Test Hall', location: 'Demo', capacity: 50 })).status, 409);
    assert.equal((await sa.post('/api/venues', { name: 'Bad Hall', location: 'Demo', capacity: 0 })).status, 400);
    assert.equal((await sa.get(`/api/venues/${venueId}`)).status, 200);
    assert.equal((await sa.put(`/api/venues/${venueId}`, { name: 'Test Hall', location: 'Demo', capacity: 80 })).status, 200);
    assert.equal((await sa.del(`/api/venues/${venueId}`)).status, 200);
    assert.equal((await sa.get(`/api/venues/${venueId}`)).status, 404);
  });

  test('a venue used by events cannot be deleted or shrunk below an event', async () => {
    const del = await sa.del(`/api/venues/${lab}`);
    assert.equal(del.status, 409);

    // The Hackathon (capacity 40) is booked at ITLT, so shrinking ITLT to 30 must fail
    const shrink = await sa.put(`/api/venues/${lab}`, { name: 'ITLT', location: 'Main campus', capacity: 30 });
    assert.equal(shrink.status, 409);
  });
});