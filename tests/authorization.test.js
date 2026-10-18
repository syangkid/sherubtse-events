const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U, E } = require('./helpers/seedData');

let t, sa, org1, org2, hackAdmin, cultAdmin, student, ids;

before(async () => {
  t = await startTestApp();
  [sa, org1, org2, hackAdmin, cultAdmin, student] = await Promise.all(
    [U.superAdmin, U.org1, U.org2, U.hackAdmin, U.cultAdmin, U.dorji].map((email) => t.loginAs(email))
  );
  ids = {
    hack: await t.eventId(E.hack),
    cultural: await t.eventId(E.cultural),
    draft: await t.eventId(E.draft),
    hackAdmin: await t.userId(U.hackAdmin),
    sa: await t.userId(U.superAdmin),
    org1: await t.userId(U.org1),
    venue: await t.venueId('ITLT'),
    culturalReg: await t.regId(U.hackAdmin, E.cultural),
  };
});
after(async () => { await t.close(); });

const body = (venueId) => ({
  title: 'Some Title', description: 'x', event_date: t.future(20),
  capacity: 10, venue_id: venueId, status: 'published',
});

describe('401: not logged in', () => {
  test('protected API endpoints demand login', async () => {
    const anon = t.newClient();
    const checks = [
      ['get', '/api/users'],
      ['get', '/api/venues'],
      ['get', '/api/notifications'],
      ['get', '/api/registrations/me'],
      ['get', `/api/events/${ids.hack}/participants`],
      ['post', '/api/events'],
      ['post', '/api/attendance'],
      ['post', `/api/events/${ids.hack}/register`],
    ];
    for (const [method, url] of checks) {
      const res = await anon[method](url);
      assert.equal(res.status, 401, `${method.toUpperCase()} ${url}`);
      assert.equal(res.json.success, false);
    }
  });
});

describe('403: role rules', () => {
  test('students and organizers cannot use Super Admin endpoints', async () => {
    for (const client of [student, org1]) {
      assert.equal((await client.get('/api/users')).status, 403);
      assert.equal((await client.get('/api/organizer-requests')).status, 403);
      assert.equal((await client.post('/api/venues', { name: 'X Hall', location: 'Y', capacity: 5 })).status, 403);
      assert.equal((await client.post(`/api/events/${ids.hack}/event-admin`, { user_id: ids.hackAdmin })).status, 403);
    }
  });

  test('students cannot create events; organizers cannot register', async () => {
    assert.equal((await student.post('/api/events', body(ids.venue))).status, 403);
    assert.equal((await org1.post(`/api/events/${ids.hack}/register`)).status, 403);
  });

  test('web pages: wrong role shows the 403 page', async () => {
    const a = await student.get('/superadmin/dashboard');
    assert.equal(a.status, 403);
    assert.match(a.text, /Access denied/);
    assert.equal((await student.get('/organizer/dashboard')).status, 403);
    assert.equal((await org1.get('/student/my-registrations')).status, 403);
    assert.equal((await t.newClient().get('/superadmin/users')).status, 302); // logged out: redirect
  });
});

describe('ownership', () => {
  test('an organizer cannot manage another organizer\'s event', async () => {
    assert.equal((await org2.put(`/api/events/${ids.hack}`, body(ids.venue))).status, 403);
    assert.equal((await org2.del(`/api/events/${ids.hack}`)).status, 403);
    assert.equal((await org2.get(`/api/events/${ids.hack}/participants`)).status, 403);
    assert.equal((await org2.get(`/manage/events/${ids.hack}/edit`)).status, 403);
  });

  test('owning one event gives no access to another organizer\'s event', async () => {
    assert.equal((await org1.get(`/api/events/${ids.cultural}/participants`)).status, 403);
    assert.equal((await org1.put(`/api/events/${ids.cultural}`, body(ids.venue))).status, 403);
  });

  test('the owner and the Super Admin can open the edit page', async () => {
    assert.equal((await org1.get(`/manage/events/${ids.hack}/edit`)).status, 200);
    assert.equal((await sa.get(`/manage/events/${ids.cultural}/edit`)).status, 200);
  });

  test('missing event is 404 and a malformed id is 400', async () => {
    assert.equal((await student.get('/api/events/999999/participants')).status, 404);
    assert.equal((await student.get('/api/events/abc/participants')).status, 400);
    assert.equal((await org1.get('/manage/events/999999/edit')).status, 404);
  });
});

describe('Event Admin is event-scoped (not a role)', () => {
  test('the user keeps the student role but is flagged as Event Admin', async () => {
    const me = await hackAdmin.get('/api/auth/me');
    assert.equal(me.json.data.user.role, 'student');
    assert.equal(me.json.data.user.isEventAdmin, true);
  });

  test('the Hackathon admin can operate the Hackathon (the assigned event)', async () => {
    assert.equal((await hackAdmin.get(`/api/events/${ids.hack}/participants`)).status, 200);
    assert.equal((await hackAdmin.get(`/api/events/${ids.hack}/attendance`)).status, 200);
    assert.equal((await hackAdmin.get(`/manage/events/${ids.hack}/participants`)).status, 200);
  });

  test('the same user gets 403 on Cultural Night (same user, different event)', async () => {
    assert.equal((await hackAdmin.get(`/api/events/${ids.cultural}/participants`)).status, 403);
    assert.equal((await hackAdmin.get(`/api/events/${ids.cultural}/attendance`)).status, 403);
    assert.equal((await hackAdmin.get(`/manage/events/${ids.cultural}/participants`)).status, 403);
    const mark = await hackAdmin.post('/api/attendance', {
      event_id: ids.cultural, registration_id: ids.culturalReg, status: 'present',
    });
    assert.equal(mark.status, 403);
  });

  test('an Event Admin runs an event but cannot edit or delete it', async () => {
    assert.equal((await hackAdmin.put(`/api/events/${ids.hack}`, body(ids.venue))).status, 403);
    assert.equal((await hackAdmin.del(`/api/events/${ids.hack}`)).status, 403);
    assert.equal((await hackAdmin.get(`/manage/events/${ids.hack}/edit`)).status, 403);
  });

  test('the dashboard lists only the assigned events', async () => {
    const res = await hackAdmin.get('/event-admin/dashboard');
    assert.equal(res.status, 200);
    assert.match(res.text, new RegExp(E.hack));
    assert.doesNotMatch(res.text, new RegExp(E.cultural));
  });

  test('the Cultural Night admin is Event Admin for Cultural Night only', async () => {
    assert.equal((await cultAdmin.get(`/api/events/${ids.cultural}/participants`)).status, 200);
    assert.equal((await cultAdmin.get(`/api/events/${ids.hack}/participants`)).status, 403);
  });

  test('a normal student gets nothing', async () => {
    assert.equal((await student.get(`/api/events/${ids.hack}/participants`)).status, 403);
    assert.equal((await student.get('/event-admin/dashboard')).status, 403);
  });

  test('removing the assignment takes effect on the very next request', async () => {
    const del = await sa.del(`/api/events/${ids.hack}/event-admin/${ids.hackAdmin}`);
    assert.equal(del.status, 200);

    assert.equal((await hackAdmin.get(`/api/events/${ids.hack}/participants`)).status, 403);
    assert.equal((await hackAdmin.get('/event-admin/dashboard')).status, 403);

    const add = await sa.post(`/api/events/${ids.hack}/event-admin`, { user_id: ids.hackAdmin });
    assert.equal(add.status, 201);
    assert.equal((await hackAdmin.get(`/api/events/${ids.hack}/participants`)).status, 200);
  });

  test('assignment rules: no duplicates, no Super Admin, no event owner', async () => {
    assert.equal((await sa.post(`/api/events/${ids.hack}/event-admin`, { user_id: ids.hackAdmin })).status, 409);
    assert.equal((await sa.post(`/api/events/${ids.hack}/event-admin`, { user_id: ids.sa })).status, 400);
    assert.equal((await sa.post(`/api/events/${ids.hack}/event-admin`, { user_id: ids.org1 })).status, 400);
    assert.equal((await sa.post(`/api/events/${ids.hack}/event-admin`, { user_id: 999999 })).status, 404);
  });

  test('the Super Admin can operate every event', async () => {
    assert.equal((await sa.get(`/api/events/${ids.cultural}/participants`)).status, 200);
    assert.equal((await sa.get(`/api/events/${ids.hack}/participants`)).status, 200);
  });
});

describe('draft events are hidden', () => {
  test('anonymous visitors and other organizers get 404', async () => {
    assert.equal((await t.newClient().get(`/api/events/${ids.draft}`)).status, 404);
    assert.equal((await org2.get(`/api/events/${ids.draft}`)).status, 404);
    assert.equal((await t.newClient().get(`/events/${ids.draft}`)).status, 404);
  });

  test('the owner and the Super Admin can see them', async () => {
    assert.equal((await org1.get(`/api/events/${ids.draft}`)).status, 200);
    assert.equal((await sa.get(`/api/events/${ids.draft}`)).status, 200);
  });

  test('the public list never includes drafts, the Super Admin list does', async () => {
    const pub = await t.newClient().get('/api/events');
    assert.ok(!pub.json.data.events.some((e) => e.title === E.draft));
    const all = await sa.get('/api/events');
    assert.ok(all.json.data.events.some((e) => e.title === E.draft));
  });
});