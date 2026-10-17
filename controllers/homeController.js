const Event = require('../models/Event');
const Schedule = require('../models/Schedule');
const Registration = require('../models/Registration');
const EventAdminAssignment = require('../models/EventAdminAssignment');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');
const { describeRegistration } = require('../utils/registrationState');

const WHEN_OPTIONS = ['upcoming', 'past', 'all'];

function showHome(req, res) {
  res.render('index', { title: 'Home' });
}

async function showEvents(req, res, next) {
  try {
    const search = (req.query.search || '').trim().slice(0, 100);
    const when = WHEN_OPTIONS.includes(req.query.when) ? req.query.when : 'upcoming';

    const events = await Event.findPublic({
      search,
      when,
      userId: req.user ? req.user.id : null,
    });

    res.render('events/index', {
      title: 'Events',
      events,
      filters: { search, when },
    });
  } catch (err) {
    next(err);
  }
}

async function showEventDetails(req, res, next) {
  try {
    const id = parseId(req.params.id, 'event id');
    const event = await Event.findById(id);
    if (!event) throw httpError(404, 'Event not found.');

    const canManageEvent = Event.canManage(req.user, event);
    const canOperate =
      canManageEvent ||
      (req.user ? await EventAdminAssignment.exists(id, req.user.id) : false);

    if (event.status === 'draft' && !canOperate) {
      throw httpError(404, 'Event not found.');
    }

    const isStudent = req.user && req.user.role === 'student';
    const [schedules, myRegistration] = await Promise.all([
      Schedule.findByEvent(id),
      isStudent ? Registration.findOne(req.user.id, id) : null,
    ]);

    const registration = describeRegistration({
      event,
      user: req.user,
      myStatus: myRegistration ? myRegistration.status : null,
    });

    res.render('events/details', {
      title: event.title,
      event,
      schedules,
      registration,
      canManageEvent,
      canOperate,
    });
  } catch (err) {
    next(err);
  }
}

// GET /student/profile 
function showProfile(req, res) {
  res.render('student/profile', { title: 'My Profile' });
}

module.exports = { showHome, showEvents, showEventDetails, showProfile };