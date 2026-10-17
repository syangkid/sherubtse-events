const fs = require('fs');
const path = require('path');

const steps = [];

function s(folder, name, method, url, expected, body, opts) {
  steps.push({ folder, name, method, url, expected, body: body || null, opts: opts || {} });
}

const login = (email, password) => JSON.stringify({ email, password });
const DEMO = 'Demo@12345';

const F1 = '1. Public (no login)';
s(F1, 'Health check', 'GET', '/api/health', 200, null, {
  pre: [
    'const run = Date.now();',
    'pm.collectionVariables.set("runId", run);',
    'pm.collectionVariables.set("newEmail", "collection." + run + "@example.test");',
    'pm.collectionVariables.set("futureDate", new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10));',
  ],
});
s(F1, 'API root lists endpoints', 'GET', '/api', 200);
s(F1, 'List events', 'GET', '/api/events', 200);
s(F1, 'Search events (hack)', 'GET', '/api/events?search=hack', 200);
s(F1, 'Get event 1', 'GET', '/api/events/1', 200);
s(F1, 'Draft event is hidden (404)', 'GET', '/api/events/5', 404);
s(F1, 'Event 1 schedule', 'GET', '/api/events/1/schedules', 200);
s(F1, 'Venues need login (401)', 'GET', '/api/venues', 401);

const F2 = '2. Authentication';
const newUser = '{"full_name":"Collection Tester","email":"{{newEmail}}","password":"Test@12345"}';
s(F2, 'Register new student', 'POST', '/api/auth/register', 201, newUser);
s(F2, 'Register same email again (409)', 'POST', '/api/auth/register', 409, newUser);
s(F2, 'Register with weak password (400)', 'POST', '/api/auth/register', 400,
  '{"full_name":"Weak Pw","email":"weak.{{runId}}@example.test","password":"abc"}');
s(F2, 'Login with wrong password (401)', 'POST', '/api/auth/login', 401,
  login('{{newEmail}}', 'Wrong@1234'));
s(F2, 'Me while logged out (401)', 'GET', '/api/auth/me', 401);

const F3 = '3. Student';
s(F3, 'Login as the new student', 'POST', '/api/auth/login', 200, login('{{newEmail}}', 'Test@12345'));
s(F3, 'Me', 'GET', '/api/auth/me', 200);
s(F3, 'Student cannot create events (403)', 'POST', '/api/events', 403,
  '{"title":"Nope","event_date":"{{futureDate}}","capacity":10,"venue_id":3,"status":"draft"}');
s(F3, 'Student cannot see participants (403)', 'GET', '/api/events/1/participants', 403);
s(F3, 'Organizer request too short (400)', 'POST', '/api/organizer-requests', 400, '{"reason":"short"}');
s(F3, 'Submit organizer request', 'POST', '/api/organizer-requests', 201,
  '{"reason":"I want to run workshops for my department."}', { save: { requestId: 'j.data.requestId' } });
s(F3, 'Second pending request (409)', 'POST', '/api/organizer-requests', 409,
  '{"reason":"I want to run workshops for my department."}');
s(F3, 'Student cannot list requests (403)', 'GET', '/api/organizer-requests', 403);
s(F3, 'Register for event 3', 'POST', '/api/events/3/register', 201);
s(F3, 'Register again (409)', 'POST', '/api/events/3/register', 409);
s(F3, 'Register for draft event (404)', 'POST', '/api/events/5/register', 404);
s(F3, 'Register for completed event (409)', 'POST', '/api/events/4/register', 409);
s(F3, 'My registrations', 'GET', '/api/registrations/me', 200);
s(F3, 'My notifications', 'GET', '/api/notifications', 200);
s(F3, 'Cancel registration', 'DELETE', '/api/events/3/register', 200);
s(F3, 'Cancel again (409)', 'DELETE', '/api/events/3/register', 409);
s(F3, 'Cancel never-registered event (404)', 'DELETE', '/api/events/2/register', 404);
s(F3, 'Logout', 'POST', '/api/auth/logout', 200);
s(F3, 'Me after logout (401)', 'GET', '/api/auth/me', 401);

const F4 = '4. Organizer (organizer1)';
const eventBody =
  '{"title":"Collection Test Event","description":"Created by Postman","event_date":"{{futureDate}}","capacity":30,"venue_id":3,"status":"published"}';
s(F4, 'Login as organizer1', 'POST', '/api/auth/login', 200, login('organizer1@demo.test', DEMO));
s(F4, 'Create event', 'POST', '/api/events', 201, eventBody, { save: { eventId: 'j.data.event.id' } });
s(F4, 'Create event in the past (400)', 'POST', '/api/events', 400,
  '{"title":"Old Event","event_date":"2020-01-01","capacity":10,"venue_id":3,"status":"draft"}');
s(F4, 'Capacity above venue capacity (400)', 'POST', '/api/events', 400,
  '{"title":"Too Big","event_date":"{{futureDate}}","capacity":500,"venue_id":3,"status":"draft"}');
s(F4, 'Update own event', 'PUT', '/api/events/{{eventId}}', 200,
  '{"title":"Collection Test Event (edited)","description":"Edited","event_date":"{{futureDate}}","capacity":30,"venue_id":3,"status":"published"}');
s(F4, "Update someone else's event (403)", 'PUT', '/api/events/2', 403, eventBody);
s(F4, 'Add schedule slot', 'POST', '/api/events/{{eventId}}/schedules', 201,
  '{"start_time":"09:00","end_time":"10:30","description":"Opening session"}',
  { save: { scheduleId: 'j.data.schedule.id' } });
s(F4, 'Schedule end before start (400)', 'POST', '/api/events/{{eventId}}/schedules', 400,
  '{"start_time":"10:00","end_time":"09:00","description":"Backwards"}');
s(F4, 'List schedule', 'GET', '/api/events/{{eventId}}/schedules', 200);
s(F4, 'Remove schedule slot', 'DELETE', '/api/events/{{eventId}}/schedules/{{scheduleId}}', 200);
s(F4, "Add slot to someone else's event (403)", 'POST', '/api/events/2/schedules', 403,
  '{"start_time":"09:00","end_time":"10:00","description":"Nope"}');
s(F4, 'Own events only (?mine=true)', 'GET', '/api/events?mine=true', 200);
s(F4, 'Delete event with registrations (409)', 'DELETE', '/api/events/1', 409);
s(F4, 'Participants of own event', 'GET', '/api/events/1/participants', 200, null,
  { save: { regId: 'j.data.participants[0].registrationId' } });
s(F4, "Participants of someone else's event (403)", 'GET', '/api/events/2/participants', 403);
s(F4, 'Attendance before event date (409)', 'POST', '/api/attendance', 409,
  '{"event_id":1,"registration_id":{{regId}},"status":"present"}');
s(F4, 'Attendance with bad status (400)', 'POST', '/api/attendance', 400,
  '{"event_id":1,"registration_id":{{regId}},"status":"late"}');
s(F4, 'Organizer cannot create venues (403)', 'POST', '/api/venues', 403,
  '{"name":"Nope","location":"Nope","capacity":10}');
s(F4, 'List venues', 'GET', '/api/venues', 200);
s(F4, 'Delete own new event', 'DELETE', '/api/events/{{eventId}}', 200);
s(F4, 'Delete it again (404)', 'DELETE', '/api/events/{{eventId}}', 404);
s(F4, 'Logout', 'POST', '/api/auth/logout', 200);

const F5 = '5. Event Admin (student3, assigned to Hackathon only)';
s(F5, 'Login as student3', 'POST', '/api/auth/login', 200, login('student3@demo.test', DEMO));
s(F5, 'Participants of assigned event', 'GET', '/api/events/1/participants', 200);
s(F5, 'Attendance list of assigned event', 'GET', '/api/events/1/attendance', 200);
s(F5, 'Participants of another event (403)', 'GET', '/api/events/2/participants', 403);
s(F5, 'Cannot edit event details (403)', 'PUT', '/api/events/1', 403, eventBody);
s(F5, 'Mark attendance before event date (409)', 'POST', '/api/attendance', 409,
  '{"event_id":1,"registration_id":{{regId}},"status":"present"}');
s(F5, 'Mark attendance for another event (403)', 'POST', '/api/attendance', 403,
  '{"event_id":2,"registration_id":{{regId}},"status":"present"}');
s(F5, 'Logout', 'POST', '/api/auth/logout', 200);

const F6 = '6. Super Admin';
s(F6, 'Login as Super Admin', 'POST', '/api/auth/login', 200, login('superadmin@demo.test', DEMO));
s(F6, 'Find Student One', 'GET', '/api/users?search=student1@demo.test', 200, null,
  { save: { studentId: 'j.data.users[0].id' } });
s(F6, 'List all users', 'GET', '/api/users', 200);
s(F6, 'List pending organizer requests', 'GET', '/api/organizer-requests?status=pending', 200);
s(F6, 'Approve the collection tester', 'PUT', '/api/organizer-requests/{{requestId}}/approve', 200);
s(F6, 'Approve again (409)', 'PUT', '/api/organizer-requests/{{requestId}}/approve', 409);
s(F6, 'Reject unknown request (404)', 'PUT', '/api/organizer-requests/9999/reject', 404);
s(F6, 'Request id must be a number (400)', 'PUT', '/api/organizer-requests/abc/approve', 400);
s(F6, 'Create venue', 'POST', '/api/venues', 201,
  '{"name":"Collection Hall {{runId}}","location":"Demo","capacity":60}',
  { save: { venueId: 'j.data.venue.id' } });
s(F6, 'Duplicate venue name (409)', 'POST', '/api/venues', 409,
  '{"name":"Collection Hall {{runId}}","location":"Demo","capacity":60}');
s(F6, 'Get venue', 'GET', '/api/venues/{{venueId}}', 200);
s(F6, 'Update venue', 'PUT', '/api/venues/{{venueId}}', 200,
  '{"name":"Collection Hall {{runId}}","location":"Demo","capacity":80}');
s(F6, 'Delete venue', 'DELETE', '/api/venues/{{venueId}}', 200);
s(F6, 'Get deleted venue (404)', 'GET', '/api/venues/{{venueId}}', 404);
s(F6, 'Assign Event Admin to event 1', 'POST', '/api/events/1/event-admin', 201, '{"user_id":{{studentId}}}');
s(F6, 'Assign again (409)', 'POST', '/api/events/1/event-admin', 409, '{"user_id":{{studentId}}}');
s(F6, 'Super Admin sees any event participants', 'GET', '/api/events/2/participants', 200);
s(F6, 'Remove Event Admin assignment', 'DELETE', '/api/events/1/event-admin/{{studentId}}', 200);
s(F6, 'Remove again (404)', 'DELETE', '/api/events/1/event-admin/{{studentId}}', 404);
s(F6, 'Super Admin sees all events incl. drafts', 'GET', '/api/events', 200);
s(F6, 'Logout', 'POST', '/api/auth/logout', 200);

function buildItem(step) {
  const t = [
    `pm.test("${step.name}: status ${step.expected}", function () { pm.response.to.have.status(${step.expected}); });`,
    `pm.test("${step.name}: JSON envelope", function () { const j = pm.response.json(); pm.expect(j.success).to.eql(${step.expected < 400}); });`,
  ];
  if (step.opts.save) {
    Object.entries(step.opts.save).forEach(([name, expr]) => {
      t.push(
        `try { const j = pm.response.json(); pm.collectionVariables.set("${name}", ${expr}); } catch (e) {}`
      );
    });
  }

  const events = [];
  if (step.opts.pre) {
    events.push({ listen: 'prerequest', script: { type: 'text/javascript', exec: step.opts.pre } });
  }
  events.push({ listen: 'test', script: { type: 'text/javascript', exec: t } });

  const request = {
    method: step.method,
    header: [{ key: 'Content-Type', value: 'application/json' }],
    url: { raw: '{{baseUrl}}' + step.url },
  };
  if (step.body) request.body = { mode: 'raw', raw: step.body };

  return { name: step.name, event: events, request };
}

const folders = [];
steps.forEach((step) => {
  let folder = folders.find((f) => f.name === step.folder);
  if (!folder) {
    folder = { name: step.folder, item: [] };
    folders.push(folder);
  }
  folder.item.push(buildItem(step));
});

const collection = {
  info: {
    name: 'Sherubtse College Event Management System API',
    description: 'Run on a freshly seeded database (npm run db:reset). Run the whole collection in order with the Collection Runner.',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }],
  item: folders,
};

const outDir = path.join(__dirname, '..', 'postman');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'sherubtse-events.postman_collection.json');
fs.writeFileSync(outFile, JSON.stringify(collection, null, 2));
console.log(`Wrote ${outFile} (${steps.length} requests)`);