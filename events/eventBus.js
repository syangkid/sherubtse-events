
const EventEmitter = require('events'); // Node's built-in module (not this folder)

const eventBus = new EventEmitter();

const EVENTS = Object.freeze({
  REGISTRATION_CREATED: 'RegistrationCreated',
  ATTENDANCE_RECORDED: 'AttendanceRecorded',
  ORGANIZER_REQUEST_CREATED: 'OrganizerRequestCreated',
});

function subscribe(eventName, handler) {
  eventBus.on(eventName, (payload) => {
        if (process.env.NODE_ENV !== 'test') {
      console.log(`[event] ${eventName}`, JSON.stringify(payload));
    }
    Promise.resolve()
      .then(() => handler(payload))
      .catch((err) => {
        console.error(`[event] ${eventName} listener failed:`, err.message);
      });
  });
}

module.exports = { eventBus, EVENTS, subscribe };