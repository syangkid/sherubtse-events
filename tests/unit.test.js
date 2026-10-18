const { test, describe } = require('node:test');
const assert = require('node:assert/strict');

const parseId = require('../utils/parseId');
const httpError = require('../utils/httpError');
const { describeRegistration } = require('../utils/registrationState');
const { attendanceWindow, summarize } = require('../utils/attendanceState');

const day = (offset) => new Date(Date.now() + offset * 86400000);

describe('parseId', () => {
  test('accepts positive integers', () => {
    assert.equal(parseId('5'), 5);
    assert.equal(parseId(12), 12);
  });

  test('rejects everything else with a 400 error', () => {
    for (const bad of ['abc', '0', '-1', '1.5', '', ' ', '1;DROP TABLE users', '2147483648']) {
      assert.throws(() => parseId(bad), (err) => err.status === 400, `should reject "${bad}"`);
    }
  });
});

describe('httpError', () => {
  test('carries status, message and optional field', () => {
    const err = httpError(409, 'Taken', 'email');
    assert.equal(err.status, 409);
    assert.equal(err.message, 'Taken');
    assert.equal(err.field, 'email');
  });
});

describe('describeRegistration', () => {
  const event = { status: 'published', eventDate: day(5), capacity: 10, registeredCount: 3 };
  const student = { role: 'student' };

  test('logged out visitors are told to log in', () => {
    assert.equal(describeRegistration({ event, user: null, myStatus: null }).state, 'login');
  });

  test('non-students cannot register', () => {
    for (const role of ['organizer', 'super_admin']) {
      assert.equal(describeRegistration({ event, user: { role }, myStatus: null }).state, 'not_student');
    }
  });

  test('open event shows remaining seats', () => {
    const r = describeRegistration({ event, user: student, myStatus: null });
    assert.equal(r.state, 'open');
    assert.equal(r.seatsLeft, 7);
  });

  test('full event', () => {
    const full = { ...event, registeredCount: 10 };
    assert.equal(describeRegistration({ event: full, user: student, myStatus: null }).state, 'full');
  });

  test('registered student can cancel only before the event', () => {
    assert.equal(describeRegistration({ event, user: student, myStatus: 'registered' }).canCancel, true);
    const past = { ...event, eventDate: day(-3) };
    assert.equal(describeRegistration({ event: past, user: student, myStatus: 'registered' }).canCancel, false);
  });

  test('draft, cancelled and past events are closed', () => {
    assert.equal(describeRegistration({ event: { ...event, status: 'draft' }, user: student, myStatus: null }).state, 'closed');
    const cancelled = describeRegistration({ event: { ...event, status: 'cancelled' }, user: student, myStatus: null });
    assert.equal(cancelled.state, 'closed');
    assert.match(cancelled.message, /cancelled/i);
    assert.equal(describeRegistration({ event: { ...event, eventDate: day(-3) }, user: student, myStatus: null }).state, 'closed');
  });

  test('a student who cancelled earlier may register again', () => {
    const r = describeRegistration({ event, user: student, myStatus: 'cancelled' });
    assert.equal(r.state, 'open');
    assert.match(r.message, /again/i);
  });
});

describe('attendanceWindow', () => {
  test('open for published events on the event date', () => {
    assert.equal(attendanceWindow({ status: 'published', eventDate: new Date() }).open, true);
  });
  test('open for completed events in the past (corrections)', () => {
    assert.equal(attendanceWindow({ status: 'completed', eventDate: day(-10) }).open, true);
  });
  test('closed before the event date', () => {
    assert.equal(attendanceWindow({ status: 'published', eventDate: day(3) }).open, false);
  });
  test('closed for draft and cancelled events', () => {
    assert.equal(attendanceWindow({ status: 'draft', eventDate: day(-1) }).open, false);
    assert.equal(attendanceWindow({ status: 'cancelled', eventDate: day(-1) }).open, false);
  });
});

describe('summarize', () => {
  test('counts attendance states and ignores cancelled registrations', () => {
    const result = summarize([
      { status: 'registered', attendanceStatus: 'present' },
      { status: 'registered', attendanceStatus: 'absent' },
      { status: 'registered', attendanceStatus: null },
      { status: 'cancelled', attendanceStatus: null },
    ]);
    assert.deepEqual(result, { registered: 3, present: 1, absent: 1, notMarked: 1, cancelled: 1 });
  });
});