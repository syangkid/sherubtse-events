const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U } = require('./helpers/seedData');

let t;
before(async () => { t = await startTestApp(); });
after(async () => { await t.close(); });

const newStudent = { full_name: 'New Student', email: 'new.student@example.test', password: 'Secret123' };

describe('signup (API)', () => {
  test('creates a student and never returns secrets', async () => {
    const res = await t.newClient().post('/api/auth/register', newStudent);
    assert.equal(res.status, 201);
    assert.equal(res.json.success, true);
    assert.equal(res.json.data.user.role, 'student');
    assert.ok(!/password/i.test(res.text), 'response must not mention a password or hash');
  });

  test('the password is stored as a bcrypt hash', async () => {
    const [row] = await t.sql('SELECT password_hash FROM users WHERE email = $1', [newStudent.email]);
    assert.ok(row.password_hash.startsWith('$2'), 'bcrypt hashes start with $2');
    assert.notEqual(row.password_hash, newStudent.password);
  });

  test('the role cannot be chosen at signup', async () => {
    const res = await t.newClient().post('/api/auth/register', {
      full_name: 'Sneaky Person', email: 'sneaky@example.test', password: 'Secret123',
      role: 'super_admin', role_id: 1, role_name: 'super_admin',
    });
    assert.equal(res.status, 201);
    assert.equal(res.json.data.user.role, 'student');
  });

  test('duplicate email is a 409, even in different letter case', async () => {
    const res = await t.newClient().post('/api/auth/register', { ...newStudent, email: 'NEW.Student@Example.test' });
    assert.equal(res.status, 409);
  });

  test('an email already used by a seeded account is a 409', async () => {
    const res = await t.newClient().post('/api/auth/register', { ...newStudent, email: U.dorji.toUpperCase() });
    assert.equal(res.status, 409);
  });

  test('weak or invalid input is a 400 with an error list', async () => {
    const cases = [
      { ...newStudent, email: 'a1@example.test', password: 'abc' },
      { ...newStudent, email: 'a2@example.test', password: 'abcdefgh' },
      { ...newStudent, email: 'a3@example.test', password: 'x'.repeat(80) + '1' },
      { ...newStudent, email: 'not-an-email' },
      { ...newStudent, email: 'a4@example.test', full_name: 'A' },
    ];
    for (const body of cases) {
      const res = await t.newClient().post('/api/auth/register', body);
      assert.equal(res.status, 400, JSON.stringify(body));
      assert.ok(Array.isArray(res.json.errors) && res.json.errors.length > 0);
    }
  });
});

describe('login and sessions (API)', () => {
  test('wrong password and unknown email give the same 401 message', async () => {
    const wrongPw = await t.newClient().post('/api/auth/login', { email: newStudent.email, password: 'Wrong1234' });
    const noUser = await t.newClient().post('/api/auth/login', { email: 'nobody@example.test', password: 'Wrong1234' });
    assert.equal(wrongPw.status, 401);
    assert.equal(noUser.status, 401);
    assert.equal(wrongPw.json.message, noUser.json.message);
  });

  test('SQL-injection style input is rejected as invalid', async () => {
    const res = await t.newClient().post('/api/auth/login', { email: "' OR '1'='1", password: "' OR '1'='1" });
    assert.equal(res.status, 400);
  });

  test('seeded demo accounts log in with the shared demo password', async () => {
    const res = await t.newClient().post('/api/auth/login', { email: U.superAdmin, password: t.DEMO_PASSWORD });
    assert.equal(res.status, 200);
    assert.equal(res.json.data.user.role, 'super_admin');
  });

  test('login sets an HttpOnly session cookie and stores the session in PostgreSQL', async () => {
    const client = t.newClient();
    const res = await client.post('/api/auth/login', { email: newStudent.email, password: newStudent.password });
    assert.equal(res.status, 200);
    assert.ok(res.setCookies.some((c) => c.startsWith('connect.sid') && /HttpOnly/i.test(c)));

    const sessions = await t.sql(`SELECT sess FROM session WHERE sess::text LIKE '%userId%'`);
    assert.ok(sessions.length >= 1);

    const me = await client.get('/api/auth/me');
    assert.equal(me.status, 200);
    assert.equal(me.json.data.user.email, newStudent.email);
  });

  test('logout ends the session', async () => {
    const client = await t.loginAs(newStudent.email, newStudent.password);
    assert.equal((await client.post('/api/auth/logout')).status, 200);
    assert.equal((await client.get('/api/auth/me')).status, 401);
  });

  test('/api/auth/me requires login', async () => {
    assert.equal((await t.newClient().get('/api/auth/me')).status, 401);
  });

  test('no API response leaks password hashes (user list)', async () => {
    const sa = await t.loginAs(U.superAdmin);
    const res = await sa.get('/api/users');
    assert.equal(res.status, 200);
    assert.ok(!/password/i.test(res.text));
  });
});

describe('login pages (web)', () => {
  test('a protected page redirects visitors to /login', async () => {
    const res = await t.newClient().get('/student/dashboard');
    assert.equal(res.status, 302);
    assert.equal(res.location, '/login');
  });

  test('wrong password re-shows the form with a generic message', async () => {
    const res = await t.newClient().postForm('/login', { email: U.superAdmin, password: 'Wrong1234' });
    assert.equal(res.status, 401);
    assert.match(res.text, /Invalid email or password/);
  });

  test('each role lands on its own dashboard', async () => {
    const expected = {
      [U.superAdmin]: '/superadmin/dashboard',
      [U.org1]: '/organizer/dashboard',
      [U.dorji]: '/student/dashboard',
    };
    for (const [email, landing] of Object.entries(expected)) {
      const client = t.newClient();
      const res = await client.postForm('/login', { email, password: t.DEMO_PASSWORD });
      assert.equal(res.status, 302);
      assert.equal(res.location, landing);
      assert.equal((await client.get(landing)).status, 200);
    }
  });

  test('logged-in users are redirected away from /login, and logout works', async () => {
    const client = t.newClient();
    await client.postForm('/login', { email: U.dorji, password: t.DEMO_PASSWORD });
    const again = await client.get('/login');
    assert.equal(again.status, 302);
    assert.equal(again.location, '/student/dashboard');

    const out = await client.get('/logout');
    assert.equal(out.location, '/login');
    assert.equal((await client.get('/student/dashboard')).status, 302);
  });
});