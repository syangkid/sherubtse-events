require('dotenv').config({ quiet: true });

process.env.NODE_ENV = 'test';
process.env.MAIL_MODE = 'console';    
process.env.DATABASE_URL = '';           
process.env.DB_NAME = process.env.DB_NAME_TEST || 'sherubtse_events_test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-only-session-secret';

const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

const dbHost = process.env.DB_HOST || 'localhost';
if (!['localhost', '127.0.0.1', '::1'].includes(dbHost)) {
  throw new Error(`Refusing to run tests: DB_HOST is "${dbHost}". Tests only run against a local database.`);
}
if (!/_test$/.test(process.env.DB_NAME)) {
  throw new Error(`Refusing to run tests: database name "${process.env.DB_NAME}" must end in _test.`);
}

const app = require('../../app');
const { pool } = require('../../config/db');
const { verifySeed } = require('./seedData');

const DEMO_PASSWORD = 'Demo@12345';

function createClient(baseUrl) {
  const jar = new Map();

  async function send(method, urlPath, { json, form, raw } = {}) {
    const headers = {};
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

    let body;
    if (raw !== undefined) {
      headers['content-type'] = 'application/json';
      body = raw;
    } else if (json !== undefined) {
      headers['content-type'] = 'application/json';
      body = JSON.stringify(json);
    } else if (form) {
      headers['content-type'] = 'application/x-www-form-urlencoded';
      body = new URLSearchParams(form).toString();
    }

    // redirect: 'manual' lets tests see the 302 and its Location header
    const res = await fetch(baseUrl + urlPath, { method, headers, body, redirect: 'manual' });

    const setCookies = res.headers.getSetCookie();
    for (const line of setCookies) {
      const pair = line.split(';')[0];
      const i = pair.indexOf('=');
      const name = pair.slice(0, i).trim();
      const value = pair.slice(i + 1).trim();
      if (value === '' || /expires=Thu, 01 Jan 1970/i.test(line)) jar.delete(name);
      else jar.set(name, value);
    }

    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not JSON (an HTML page) */ }

    return { status: res.status, text, json: data, location: res.headers.get('location'), setCookies };
  }

  return {
    get: (p) => send('GET', p),
    post: (p, json) => send('POST', p, { json }),
    put: (p, json) => send('PUT', p, { json }),
    del: (p) => send('DELETE', p),
    postForm: (p, form) => send('POST', p, { form }),
    postRaw: (p, raw) => send('POST', p, { raw }),
  };
}

async function resetDb() {
  for (const file of ['schema.sql', 'seed.sql']) {
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'database', file), 'utf8');
    await pool.query(sql);
  }
}

const future = (days) =>
  new Date(Date.now() + days * 86400000).toLocaleDateString('en-CA');

async function waitFor(fn, { timeout = 3000, interval = 50 } = {}) {
  const end = Date.now() + timeout;
  for (;;) {
    const value = await fn();
    if (value) return value;
    if (Date.now() > end) throw new Error('waitFor timed out');
    await new Promise((r) => setTimeout(r, interval));
  }
}
async function startTestApp() {
  const sql = async (text, params) => (await pool.query(text, params)).rows;
  const one = async (text, params) => (await sql(text, params))[0];

  let dbName;
  try {
    dbName = (await one('SELECT current_database() AS db')).db;
  } catch (err) {
    await pool.end();
    throw new Error(
      `Cannot connect to the test database "${process.env.DB_NAME}". ` +
      `Run "npm run test:db" first. Reason: ${err.message}`
    );
  }
  if (!dbName.endsWith('_test')) {
    await pool.end();
    throw new Error(`Refusing to run tests against "${dbName}". The database name must end in _test.`);
  }

  try {
    await resetDb();
    await verifySeed(sql);
  } catch (err) {
    await pool.end();
    throw err;
  }

  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s)); // port 0 = any free port
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    sql,
    future,
    waitFor,
    DEMO_PASSWORD,
    newClient: () => createClient(baseUrl),

    async loginAs(email, password = DEMO_PASSWORD) {
      const client = createClient(baseUrl);
      const res = await client.post('/api/auth/login', { email, password });
      assert.equal(res.status, 200, `login failed for ${email}: ${res.text}`);
      return client;
    },

    userId: async (email) =>
      (await one('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [email])).id,
    eventId: async (title) => (await one('SELECT id FROM events WHERE title = $1', [title])).id,
    venueId: async (name) => (await one('SELECT id FROM venues WHERE name = $1', [name])).id,
    regId: async (email, title) =>
      (await one(
        `SELECT r.id FROM registrations r
         JOIN users u ON u.id = r.user_id JOIN events e ON e.id = r.event_id
         WHERE u.email = $1 AND e.title = $2`,
        [email, title]
      )).id,

    resetDb,

    async close() {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
      await pool.end();
    },
  };
}

module.exports = { startTestApp };