const { validationResult } = require('express-validator');

const User = require('../models/User');
const Event = require('../models/Event');
const Stats = require('../models/Stats');
const OrganizerRequest = require('../models/OrganizerRequest');
const EventAdminAssignment = require('../models/EventAdminAssignment');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');

const ROLES = ['super_admin', 'organizer', 'student'];
const REQUEST_FILTERS = ['pending', 'approved', 'rejected', 'all'];


async function assignEventAdmin(eventId, userId, assignedBy) {
  const event = await Event.findById(eventId);
  if (!event) throw httpError(404, 'Event not found.');

  const user = await User.findById(userId);
  if (!user) throw httpError(404, 'User not found.');

  if (user.role === 'super_admin') {
    throw httpError(400, 'A Super Admin already has access to every event.');
  }
  if (event.organizerId === user.id) {
    throw httpError(400, 'This user is the organizer of the event and already manages it.');
  }

  try {
    const id = await EventAdminAssignment.create(eventId, userId, assignedBy);
    return { id, event, user };
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'This user is already Event Admin for this event.');
    }
    throw err;
  }
}

function redirectWithError(err, req, res, next, to) {
  if ([400, 404, 409].includes(err.status)) {
    req.session.flash = { type: 'error', message: err.message };
    return res.redirect(to);
  }
  next(err);
}


async function showDashboard(req, res, next) {
  try {
    const [stats, recentRequests] = await Promise.all([
      Stats.getSuperAdminStats(),
      OrganizerRequest.findAll(null, 5),
    ]);
    res.render('superadmin/dashboard', {
      title: 'Super Admin Dashboard',
      stats,
      recentRequests,
    });
  } catch (err) {
    next(err);
  }
}

async function showUsers(req, res, next) {
  try {
    const search = (req.query.search || '').trim().slice(0, 100);
    const role = ROLES.includes(req.query.role) ? req.query.role : '';
    const users = await User.findAll({ search, role });
    res.render('superadmin/users', {
      title: 'Users',
      users,
      filters: { search, role },
    });
  } catch (err) {
    next(err);
  }
}

async function showOrganizerRequests(req, res, next) {
  try {
    const filter = REQUEST_FILTERS.includes(req.query.status) ? req.query.status : 'pending';
    const requests = await OrganizerRequest.findAll(filter === 'all' ? null : filter);
    res.render('superadmin/organizer-requests', {
      title: 'Organizer Requests',
      requests,
      filter,
    });
  } catch (err) {
    next(err);
  }
}

async function approveRequest(req, res, next) {
  const back = '/superadmin/organizer-requests';
  try {
    const id = parseId(req.params.id, 'request id');
    const result = await OrganizerRequest.approve(id, req.user.id);
    req.session.flash = {
      type: 'success',
      message: `Request approved. ${result.fullName} is now an Organizer.`,
    };
    res.redirect(back);
  } catch (err) {
    redirectWithError(err, req, res, next, back);
  }
}

async function rejectRequest(req, res, next) {
  const back = '/superadmin/organizer-requests';
  try {
    const id = parseId(req.params.id, 'request id');
    await OrganizerRequest.reject(id, req.user.id);
    req.session.flash = { type: 'info', message: 'Request rejected.' };
    res.redirect(back);
  } catch (err) {
    redirectWithError(err, req, res, next, back);
  }
}

async function showAssignments(req, res, next) {
  try {
    const [events, users, assignments] = await Promise.all([
      Event.findAll(),
      User.findAssignable(),
      EventAdminAssignment.findAll(),
    ]);
    res.render('superadmin/event-admin-assignments', {
      title: 'Event Admin Assignments',
      events,
      users,
      assignments,
    });
  } catch (err) {
    next(err);
  }
}

async function assignEventAdminWeb(req, res, next) {
  const back = '/superadmin/event-admin-assignments';
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      throw httpError(400, 'Please choose both an event and a user.');
    }
    const eventId = parseId(req.body.event_id, 'event id');
    const userId = parseId(req.body.user_id, 'user id');

    const { event, user } = await assignEventAdmin(eventId, userId, req.user.id);
    req.session.flash = {
      type: 'success',
      message: `${user.fullName} is now Event Admin for "${event.title}".`,
    };
    res.redirect(back);
  } catch (err) {
    redirectWithError(err, req, res, next, back);
  }
}

async function removeAssignmentWeb(req, res, next) {
  const back = '/superadmin/event-admin-assignments';
  try {
    const id = parseId(req.params.id, 'assignment id');
    const removed = await EventAdminAssignment.removeById(id);
    if (!removed) throw httpError(404, 'Assignment not found.');
    req.session.flash = { type: 'info', message: 'Event Admin assignment removed.' };
    res.redirect(back);
  } catch (err) {
    redirectWithError(err, req, res, next, back);
  }
}

async function apiListUsers(req, res, next) {
  try {
    const search = (req.query.search || '').trim().slice(0, 100);
    const role = ROLES.includes(req.query.role) ? req.query.role : '';
    const users = await User.findAll({ search, role });
    res.status(200).json({ success: true, message: 'Users', data: { users } });
  } catch (err) {
    next(err);
  }
}

async function apiListRequests(req, res, next) {
  try {
    const filter = REQUEST_FILTERS.includes(req.query.status) ? req.query.status : 'all';
    const requests = await OrganizerRequest.findAll(filter === 'all' ? null : filter);
    res.status(200).json({
      success: true,
      message: 'Organizer requests',
      data: { requests },
    });
  } catch (err) {
    next(err);
  }
}

async function apiApproveRequest(req, res, next) {
  try {
    const id = parseId(req.params.id, 'request id');
    const result = await OrganizerRequest.approve(id, req.user.id);
    res.status(200).json({
      success: true,
      message: `Request approved. ${result.fullName} is now an Organizer.`,
      data: { requestId: result.requestId, userId: result.userId, newRole: 'organizer' },
    });
  } catch (err) {
    next(err);
  }
}

async function apiRejectRequest(req, res, next) {
  try {
    const id = parseId(req.params.id, 'request id');
    const result = await OrganizerRequest.reject(id, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Request rejected.',
      data: { requestId: result.requestId, userId: result.userId },
    });
  } catch (err) {
    next(err);
  }
}

async function apiAssignEventAdmin(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }
    const eventId = parseId(req.params.id, 'event id');
    const userId = parseId(req.body.user_id, 'user id');

    const { id, event, user } = await assignEventAdmin(eventId, userId, req.user.id);
    res.status(201).json({
      success: true,
      message: `${user.fullName} is now Event Admin for "${event.title}".`,
      data: { assignmentId: id, eventId: event.id, userId: user.id },
    });
  } catch (err) {
    next(err);
  }
}

async function apiRemoveEventAdmin(req, res, next) {
  try {
    const eventId = parseId(req.params.id, 'event id');
    const userId = parseId(req.params.userId, 'user id');
    const removed = await EventAdminAssignment.removeByEventAndUser(eventId, userId);
    if (!removed) throw httpError(404, 'Assignment not found.');
    res.status(200).json({
      success: true,
      message: 'Event Admin assignment removed.',
      data: {},
    });
  } catch (err) {
    next(err);
  }
}


module.exports = {
  showDashboard,
  showUsers,
  showOrganizerRequests,
  approveRequest,
  rejectRequest,
  showAssignments,
  assignEventAdminWeb,
  removeAssignmentWeb,
  apiListUsers,
  apiListRequests,
  apiApproveRequest,
  apiRejectRequest,
  apiAssignEventAdmin,
  apiRemoveEventAdmin,
};
