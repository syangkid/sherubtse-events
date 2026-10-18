const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U } = require('./helpers/seedData');

let t, anon;
before(async () => { t = await startTestApp(); anon = t.newClient(); });
after(async () => { await t.close(); });

describe('API errors are JSON', () => {
  test('unknown API route: 404 JSON', async () => {
    const res = await anon.get('/api/does-not-exist');
    assert.equal(res.status, 404);
    assert.equal(res.json.success, false);
    assert.ok(res.json.message);
  });

  test('malformed JSON body: 400 JSON', async () => {
    const res = await anon.postRaw('/api/auth/login', '{ this is not json');
    assert.equal(res.status, 400);
    assert.equal(res.json.success, false);
  });

  test('malformed and out-of-range ids: 400', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999']) {
      const res = await anon.get(`/api/events/${id}`);
      assert.equal(res.status, 400, `id ${id}`);
      assert.equal(res.json.success, false);
    }
  });

  test('missing record: 404', async () => {
    assert.equal((await anon.get('/api/events/999999')).status, 404);
  });

  test('every response uses the same envelope', async () => {
    const ok = await anon.get('/api/health');
    assert.equal(ok.json.success, true);
    assert.ok('message' in ok.json && 'data' in ok.json);
  });

  test('the API root lists the endpoints', async () => {
    const res = await anon.get('/api');
    assert.equal(res.status, 200);
    assert.ok(res.json.data.endpoints.length > 20);
  });
});

describe('web errors are HTML pages', () => {
  test('unknown page: 404 page', async () => {
    const res = await anon.get('/no-such-page');
    assert.equal(res.status, 404);
    assert.match(res.text, /Page not found/);
    assert.equal(res.json, null);
  });

  test('forbidden page: 403 page', async () => {
    const student = await t.loginAs(U.dorji);
    const res = await student.get('/superadmin/users');
    assert.equal(res.status, 403);
    assert.match(res.text, /Access denied/);
  });

  test('bad id in a web URL: 400', async () => {
    assert.equal((await anon.get('/events/abc')).status, 400);
  });

  test('public pages render', async () => {
    for (const url of ['/', '/events', '/login', '/signup']) {
      assert.equal((await anon.get(url)).status, 200, url);
    }
  });
});