const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { startTestApp } = require('./helpers/testApp');
const { U, E } = require('./helpers/seedData');

let t, sa, org1, org2, hackAdmin, dorji, ids, regs;

before(async () => {
  t = await startTestApp();
  [sa, org1, org2, hackAdmin, dorji] = await Promise.all(
    [U.superAdmin, U.org1, U.org2, U.hackAdmin, U.dorji].map((email) => t.loginAs(email))
  );
  ids = {
    hack: await t.eventId(E.hack),
    cultural: await t.eventId(E.cultural),
    career: await t.eventId(E.career),
  };
  regs = {
    nidupHack: await t.regId(U.hackAdmin, E.hack),
    tdorjiHack: await t.regId(U.cultAdmin, E.hack),
    dorjiHack: await t.regId(U.dorji, E.hack),
    karmaHack: await t.regId(U.karma, E.hack),      
    nidupCultural: await t.regId(U.hackAdmin, E.cultural),
    dorjiCareer: await t.regId(U.dorji, E.career),  
  };
});
after(async () => { await t.close(); });

const mark = (client, event, reg, status) =>
  client.post('/api/attendance', { event_id: event, registration_id: reg, status });

describe('attendance window', () => {
  test('cannot mark before the event date (409)', async () => {
    const res = await mark(sa, ids.cultural, regs.nidupCultural, 'present');
    assert.equal(res.status, 409);
    assert.match(res.json.message, /event date/i);
  });

  test('a completed (past) event still allows corrections', async () => {
    const res = await mark(org2, ids.career, regs.dorjiCareer, 'present'); 
    assert.equal(res.status, 200);
    const [row] = await t.sql('SELECT attendance_status FROM attendance WHERE registration_id = $1', [regs.dorjiCareer]);
    assert.equal(row.attendance_status, 'present');
  });
});

describe('marking on the event day', () => {
  before(async () => {
    await t.sql(`UPDATE events SET event_date = CURRENT_DATE WHERE id = $1`, [ids.hack]);
  });

  test('the owner marks present and the marker is recorded', async () => {
    const res = await mark(org1, ids.hack, regs.nidupHack, 'present');
    assert.equal(res.status, 200);
    const [row] = await t.sql('SELECT attendance_status, marked_by FROM attendance WHERE registration_id = $1', [regs.nidupHack]);
    assert.equal(row.attendance_status, 'present');
    assert.equal(row.marked_by, await t.userId(U.org1));
  });

  test('changing the status updates the same row (no duplicates)', async () => {
    assert.equal((await mark(org1, ids.hack, regs.nidupHack, 'absent')).status, 200);
    const rows = await t.sql('SELECT attendance_status FROM attendance WHERE registration_id = $1', [regs.nidupHack]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].attendance_status, 'absent');
  });

  test('the assigned Event Admin can mark attendance', async () => {
    assert.equal((await mark(hackAdmin, ids.hack, regs.tdorjiHack, 'present')).status, 200);
  });

  test('unassigned users cannot', async () => {
    assert.equal((await mark(dorji, ids.hack, regs.tdorjiHack, 'present')).status, 403);
    assert.equal((await mark(org2, ids.hack, regs.tdorjiHack, 'present')).status, 403);
    assert.equal((await mark(t.newClient(), ids.hack, regs.tdorjiHack, 'present')).status, 401);
  });

  test('invalid input is rejected', async () => {
    assert.equal((await mark(org1, ids.hack, regs.nidupHack, 'late')).status, 400);
    assert.equal((await mark(org1, 'abc', regs.nidupHack, 'present')).status, 400);
    assert.equal((await mark(org1, ids.hack, 'abc', 'present')).status, 400);
  });

  test('a registration from another event is not found (404)', async () => {
    const res = await mark(org1, ids.hack, regs.nidupCultural, 'present');
    assert.equal(res.status, 404);
    const rows = await t.sql('SELECT 1 FROM attendance WHERE registration_id = $1', [regs.nidupCultural]);
    assert.equal(rows.length, 0);
  });

  test('a cancelled registration cannot be marked (404)', async () => {
    assert.equal((await mark(org1, ids.hack, regs.karmaHack, 'present')).status, 404);
  });

  test('the participants list and summary are correct', async () => {
    const res = await hackAdmin.get(`/api/events/${ids.hack}/participants`);
    assert.equal(res.status, 200);
    assert.equal(res.json.data.participants.length, 4);
    assert.equal(res.json.data.summary.registered, 3);
    assert.equal(res.json.data.summary.cancelled, 1);
    assert.equal(res.json.data.summary.present, 1);    // Tshering Dorji
    assert.equal(res.json.data.summary.absent, 1);     // Tshering Nidup
    assert.equal(res.json.data.summary.notMarked, 1);  // Dorji Choden
  });

  test('once attendance is recorded the student can no longer cancel', async () => {
    // Tshering Nidup (a student) now has attendance recorded for the Hackathon
    assert.equal((await hackAdmin.del(`/api/events/${ids.hack}/register`)).status, 409);
  });

  test('the web attendance form works and shows the result', async () => {
    const res = await org1.postForm(`/manage/events/${ids.hack}/attendance`, {
      registration_id: String(regs.nidupHack), status: 'present',
    });
    assert.equal(res.status, 302);
    assert.equal(res.location, `/manage/events/${ids.hack}/participants`);
    const page = await org1.get(`/manage/events/${ids.hack}/participants`);
    assert.match(page.text, /Attendance saved/);
  });
});