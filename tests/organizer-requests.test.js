const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U } = require('./helpers/seedData');

let t, sa, org1, dorji, lhamo, tdorji, nidup;
let requestId;

before(async () => {
  t = await startTestApp();
  [sa, org1, dorji, lhamo, tdorji, nidup] = await Promise.all(
    [U.superAdmin, U.org1, U.dorji, U.lhamo, U.cultAdmin, U.hackAdmin].map((email) => t.loginAs(email))
  );
});
after(async () => { await t.close(); });

const reason = 'I want to organize workshops for my department.';
const roleOf = async (email) =>
  (await t.sql(
    `SELECT r.role_name FROM users u JOIN roles r ON r.id = u.role_id WHERE u.email = $1`, [email]
  ))[0].role_name;

describe('submitting a request', () => {
  test('a student submits a request', async () => {
    const res = await dorji.post('/api/organizer-requests', { reason });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.status, 'pending');
    requestId = res.json.data.requestId;
  });

  test('a second pending request is a 409', async () => {
    assert.equal((await dorji.post('/api/organizer-requests', { reason })).status, 409);
  });

  test('too-short reason is a 400', async () => {
    assert.equal((await nidup.post('/api/organizer-requests', { reason: 'short' })).status, 400);
  });

  test('non-students cannot submit', async () => {
    assert.equal((await org1.post('/api/organizer-requests', { reason })).status, 403);
  });

  test('only the Super Admin can list requests', async () => {
    assert.equal((await dorji.get('/api/organizer-requests')).status, 403);
    const res = await sa.get('/api/organizer-requests?status=pending');
    assert.equal(res.status, 200);
    assert.ok(res.json.data.requests.some((r) => r.id === requestId));
  });
});

describe('approval', () => {
  test('approving marks the request and changes the role together', async () => {
    const res = await sa.put(`/api/organizer-requests/${requestId}/approve`);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.newRole, 'organizer');

    const [req] = await t.sql('SELECT status, reviewed_by, reviewed_at FROM organizer_requests WHERE id = $1', [requestId]);
    assert.equal(req.status, 'approved');
    assert.equal(req.reviewed_by, await t.userId(U.superAdmin));
    assert.ok(req.reviewed_at);
    assert.equal(await roleOf(U.dorji), 'organizer');
  });

  test('the new role works immediately, without logging in again', async () => {
    const me = await dorji.get('/api/auth/me');
    assert.equal(me.json.data.user.role, 'organizer');

    const venue = await t.venueId('ITLT');
    const create = await dorji.post('/api/events', {
      title: 'My First Event', event_date: t.future(25), capacity: 10, venue_id: venue, status: 'draft',
    });
    assert.equal(create.status, 201);
  });

  test('a reviewed request cannot be reviewed again', async () => {
    assert.equal((await sa.put(`/api/organizer-requests/${requestId}/approve`)).status, 409);
    assert.equal((await sa.put(`/api/organizer-requests/${requestId}/reject`)).status, 409);
  });

  test('unknown and malformed ids', async () => {
    assert.equal((await sa.put('/api/organizer-requests/999999/approve')).status, 404);
    assert.equal((await sa.put('/api/organizer-requests/abc/approve')).status, 400);
  });

  test('only the Super Admin can approve', async () => {
    assert.equal((await org1.put(`/api/organizer-requests/${requestId}/approve`)).status, 403);
  });
});

describe('rejection', () => {
  test('rejecting leaves the role alone, and the student may apply again', async () => {
    const submit = await lhamo.post('/api/organizer-requests', { reason });
    assert.equal(submit.status, 201);

    const rej = await sa.put(`/api/organizer-requests/${submit.json.data.requestId}/reject`);
    assert.equal(rej.status, 200);
    assert.equal(await roleOf(U.lhamo), 'student');

    assert.equal((await lhamo.post('/api/organizer-requests', { reason })).status, 201);
  });
});

describe('transaction safety', () => {
  test('ROLLBACK: if the role cannot change, the request stays pending', async () => {
    const [pending] = await t.sql(
      `SELECT r.id FROM organizer_requests r JOIN users u ON u.id = r.user_id
       WHERE u.email = $1 AND r.status = 'pending'`, [U.choki]);
    await t.sql(
      `UPDATE users SET role_id = (SELECT id FROM roles WHERE role_name = 'organizer')
       WHERE email = $1`, [U.choki]);

    const res = await sa.put(`/api/organizer-requests/${pending.id}/approve`);
    assert.equal(res.status, 409);

    const [req] = await t.sql('SELECT status, reviewed_by FROM organizer_requests WHERE id = $1', [pending.id]);
    assert.equal(req.status, 'pending', 'the first UPDATE must have been rolled back');
    assert.equal(req.reviewed_by, null);
  });

  test('LOCKING: two simultaneous approvals of one request: exactly one succeeds', async () => {
    const submit = await tdorji.post('/api/organizer-requests', { reason });
    const id = submit.json.data.requestId;

    const results = await Promise.all([
      sa.put(`/api/organizer-requests/${id}/approve`),
      sa.put(`/api/organizer-requests/${id}/approve`),
    ]);
    assert.deepEqual(results.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await roleOf(U.cultAdmin), 'organizer');
  });
});