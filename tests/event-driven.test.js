const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U, E } = require('./helpers/seedData');
const { eventBus, EVENTS, subscribe } = require('../events/eventBus');

let t, sa, org1, dorji, karma, nidup, lhamo;

before(async () => {
  t = await startTestApp();
  [sa, org1, dorji, karma, nidup, lhamo] = await Promise.all(
    [U.superAdmin, U.org1, U.dorji, U.karma, U.hackAdmin, U.lhamo].map((email) => t.loginAs(email))
  );
});
after(async () => { await t.close(); });

const tick = (ms = 150) => new Promise((r) => setTimeout(r, ms));
const notificationsFor = (email, like) =>
  t.sql(
    `SELECT n.message FROM notifications n JOIN users u ON u.id = n.user_id
     WHERE u.email = $1 AND n.message LIKE $2`, [email, like]);

describe('the event bus itself', () => {
  test('handlers run after emit() returns, and receive the payload', async () => {
    const order = [];
    let received;
    subscribe('TestOrdering', async (payload) => { received = payload; order.push('handler'); });

    eventBus.emit('TestOrdering', { n: 1 });
    order.push('after-emit');
    await tick(20);

    assert.deepEqual(order, ['after-emit', 'handler']);
    assert.deepEqual(received, { n: 1 });
  });

  test('a failing listener cannot crash the emitter or stop other listeners', async () => {
    const silence = console.error;
    console.error = () => {};        
    let secondRan = false;
    try {
      subscribe('TestFailure', async () => { throw new Error('boom'); });
      subscribe('TestFailure', async () => { secondRan = true; });
      assert.doesNotThrow(() => eventBus.emit('TestFailure', {}));
      await tick(20);
    } finally {
      console.error = silence;
    }
    assert.equal(secondRan, true);
  });

  test('tests can never send real email', () => {
    assert.equal(require('../config/mailer').mailMode(), 'console');
  });
});

describe('RegistrationCreated', () => {
  const calls = [];
  const spy = (payload) => calls.push(payload);
  before(() => eventBus.on(EVENTS.REGISTRATION_CREATED, spy));
  after(() => eventBus.off(EVENTS.REGISTRATION_CREATED, spy));

  test('a successful registration emits the event once and creates a notification', async () => {
    const football = await t.eventId(E.football);
    const res = await dorji.post(`/api/events/${football}/register`);
    assert.equal(res.status, 201);

    assert.equal(calls.length, 1);
    assert.equal(calls[0].eventId, football);
    assert.equal(calls[0].userId, await t.userId(U.dorji));

    await t.waitFor(async () =>
      (await notificationsFor(U.dorji, `%${E.football}%`)).length === 1);
  });

  test('failed registrations emit nothing (the event is sent only after COMMIT)', async () => {
    const football = await t.eventId(E.football);
    const before = calls.length;

    assert.equal((await dorji.post(`/api/events/${football}/register`)).status, 409);
    const career = await t.eventId(E.career);
    assert.equal((await karma.post(`/api/events/${career}/register`)).status, 409); 

    await tick();
    assert.equal(calls.length, before);
    assert.equal((await notificationsFor(U.dorji, `%${E.football}%`)).length, 1);
  });
});

describe('AttendanceRecorded', () => {
  test('marking attendance notifies the student', async () => {
    const hack = await t.eventId(E.hack);
    await t.sql(`UPDATE events SET event_date = CURRENT_DATE WHERE id = $1`, [hack]);
    const reg = await t.regId(U.dorji, E.hack);

    const res = await org1.post('/api/attendance', { event_id: hack, registration_id: reg, status: 'present' });
    assert.equal(res.status, 200);

    await t.waitFor(async () =>
      (await notificationsFor(U.dorji, `%${E.hack}%recorded as present%`)).length === 1);
  });
});

describe('OrganizerRequestCreated', () => {
  test('a new request notifies the Super Admin', async () => {
    // Karma Wangmo's earlier request was rejected, so she may apply again
    const res = await karma.post('/api/organizer-requests', { reason: 'I would like to organize sports days.' });
    assert.equal(res.status, 201);

    await t.waitFor(async () =>
      (await notificationsFor(U.superAdmin, 'New organizer request from Karma Wangmo%')).length === 1);
  });
});

describe('notifications API', () => {
  test('lists own notifications with an unread count', async () => {
    const res = await nidup.get('/api/notifications');
    assert.equal(res.status, 200);
    assert.ok(res.json.data.unread >= 1);   
    assert.ok(res.json.data.notifications.length >= 1);
  });

  test('mark one as read, and the unread count drops', async () => {
    const before = (await nidup.get('/api/notifications')).json.data;
    const unread = before.notifications.find((n) => n.status === 'unread');
    assert.equal((await nidup.put(`/api/notifications/${unread.id}/read`)).status, 200);
    const after = (await nidup.get('/api/notifications')).json.data;
    assert.equal(after.unread, before.unread - 1);
  });

  test('you cannot touch another user\'s notification', async () => {
    const [others] = await t.sql(
      `SELECT n.id FROM notifications n JOIN users u ON u.id = n.user_id WHERE u.email = $1 LIMIT 1`,
      [U.superAdmin]);
    assert.equal((await lhamo.put(`/api/notifications/${others.id}/read`)).status, 404);
    assert.equal((await lhamo.put('/api/notifications/abc/read')).status, 400);
  });

  test('the notifications page renders for a logged-in user', async () => {
    const res = await sa.get('/notifications');
    assert.equal(res.status, 200);
    assert.match(res.text, /Notifications/);
  });
});