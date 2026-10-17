const { EVENTS, subscribe } = require('../eventBus');
const Notification = require('../../models/Notification');

function register() {
  subscribe(EVENTS.ATTENDANCE_RECORDED, async ({ userId, eventTitle, status }) => {
    await Notification.create(
      userId,
      `Your attendance for "${eventTitle}" was recorded as ${status}.`
    );
  });
}

module.exports = { register };