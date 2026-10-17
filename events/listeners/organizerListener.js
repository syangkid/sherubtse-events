const { EVENTS, subscribe } = require('../eventBus');
const Notification = require('../../models/Notification');
const User = require('../../models/User');

function register() {
  subscribe(EVENTS.ORGANIZER_REQUEST_CREATED, async ({ userId }) => {
    const applicant = await User.findById(userId);
    const name = applicant ? applicant.fullName : 'A student';
    await Notification.createForSuperAdmins(
      `New organizer request from ${name}. Review it under Organizer Requests.`
    );
  });
}

module.exports = { register };