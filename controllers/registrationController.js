const Registration = require('../models/Registration');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');
const { eventBus, EVENTS } = require('../events/eventBus');

async function registerFor(userId, eventId) {
  let result;
  try {
    result = await Registration.register(userId, eventId);
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'You are already registered for this event.');
    }
    throw err;
  }

  eventBus.emit(EVENTS.REGISTRATION_CREATED, {
    registrationId: result.registrationId,
    userId,
    eventId,
  });

  return result;
}

async function showStudentDashboard(req, res, next) {
  try {
    const [stats, registrations] = await Promise.all([
      Registration.countsForUser(req.user.id),
      Registration.findByUser(req.user.id),
    ]);

    const upcoming = registrations
      .filter((r) => r.status === 'registered' && r.isUpcoming)
      .reverse()
      .slice(0, 5);

    res.render('student/dashboard', {
      title: 'Student Dashboard',
      stats,
      upcoming,
    });
  } catch (err) {
    next(err);
  }
}

async function showMyRegistrations(req, res, next) {
  try {
    const registrations = await Registration.findByUser(req.user.id);
    res.render('student/my-registrations', {
      title: 'My Registrations',
      registrations,
    });
  } catch (err) {
    next(err);
  }
}

async function registerWeb(req, res, next) {
  try {
    const eventId = parseId(req.params.id, 'event id');
    const result = await registerFor(req.user.id, eventId);
    req.session.flash = {
      type: 'success',
      message: `You are registered for "${result.eventTitle}".`,
    };
    res.redirect(`/events/${eventId}`);
  } catch (err) {
    if (err.status === 409) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect(`/events/${req.params.id}`);
    }
    next(err);
  }
}

async function cancelWeb(req, res, next) {
  const back = req.body.return_to === 'my-registrations'
    ? '/student/my-registrations'
    : `/events/${req.params.id}`;

  try {
    const eventId = parseId(req.params.id, 'event id');
    await Registration.cancel(req.user.id, eventId);
    req.session.flash = { type: 'info', message: 'Your registration was cancelled.' };
    res.redirect(back);
  } catch (err) {
    if ([404, 409].includes(err.status)) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect(back);
    }
    next(err);
  }
}

async function apiRegister(req, res, next) {
  try {
    const eventId = parseId(req.params.id, 'event id');
    const result = await registerFor(req.user.id, eventId);
    res.status(201).json({
      success: true,
      message: `Registered for "${result.eventTitle}"`,
      data: { registrationId: result.registrationId, eventId, status: 'registered' },
    });
  } catch (err) {
    next(err);
  }
}

async function apiCancel(req, res, next) {
  try {
    const eventId = parseId(req.params.id, 'event id');
    const result = await Registration.cancel(req.user.id, eventId);
    res.status(200).json({
      success: true,
      message: 'Registration cancelled',
      data: { registrationId: result.registrationId, eventId, status: 'cancelled' },
    });
  } catch (err) {
    next(err);
  }
}

async function apiMyRegistrations(req, res, next) {
  try {
    const registrations = await Registration.findByUser(req.user.id);
    res.status(200).json({
      success: true,
      message: 'Your registrations',
      data: { registrations },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showStudentDashboard,
  showMyRegistrations,
  registerWeb,
  cancelWeb,
  apiRegister,
  apiCancel,
  apiMyRegistrations,
};