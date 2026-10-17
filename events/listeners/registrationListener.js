const { EVENTS, subscribe } = require('../eventBus');
const Notification = require('../../models/Notification');
const User = require('../../models/User');
const Event = require('../../models/Event');
const { sendMail } = require('../../config/mailer');
const formatDate = require('../../utils/formatDate');

function register() {
  subscribe(EVENTS.REGISTRATION_CREATED, async ({ userId, eventId }) => {
    const [user, event] = await Promise.all([User.findById(userId), Event.findById(eventId)]);
    if (!user || !event) return;

    const when = formatDate(event.eventDate);

    await Notification.create(
      userId,
      `You are registered for "${event.title}" on ${when}.`
    );

    try {
      await sendMail({
        to: user.email,
        subject: `Registration confirmed: ${event.title}`,
        text:
          `Hello ${user.fullName},\n\n` +
          `Your registration is confirmed.\n\n` +
          `Event: ${event.title}\n` +
          `Date : ${when}\n` +
          `Venue: ${event.venueName || 'To be announced'}\n\n` +
          `Sherubtse College Event Management System`,
      });
    } catch (err) {
      console.error('[mail] confirmation email failed:', err.message);
    }
  });
}

module.exports = { register };