const User = require('../models/User');
const Event = require('../models/Event');
const EventAdminAssignment = require('../models/EventAdminAssignment');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');

const HOME_BY_ROLE = {
  super_admin: '/superadmin/dashboard',
  organizer: '/organizer/dashboard',
  student: '/student/dashboard',
};

function homePathForRole(role) {
  return HOME_BY_ROLE[role] || '/';
}

function isApiRequest(req) {
  return (
    req.originalUrl.startsWith('/api') ||
    (req.headers.accept || '').includes('application/json')
  );
}

async function attachUser(req, res, next) {
  req.user = null;
  res.locals.currentUser = null;

  try {
    if (req.session && req.session.userId) {
      const user = await User.findById(req.session.userId);
      if (user) {
        req.user = user;
        res.locals.currentUser = user; 
      } else {
        delete req.session.userId; 
      }
    }
    next();
  } catch (err) {
    next(err);
  }
}

function requireAuth(req, res, next) {
  if (req.user) return next();

  if (isApiRequest(req)) {
    return next(httpError(401, 'Authentication required. Please log in.'));
  }

  req.session.flash = { type: 'error', message: 'Please log in to continue.' };
  res.redirect('/login');
}

function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) return requireAuth(req, res, next);

    if (!allowedRoles.includes(req.user.role)) {
      return next(httpError(403, 'You do not have permission to access this resource.'));
    }
    next();
  };
}

async function authorizeEvent(req, rawId, level) {
  const eventId = parseId(rawId, 'event id');
  const event = await Event.findById(eventId);
  if (!event) throw httpError(404, 'Event not found.');

  let allowed = Event.canManage(req.user, event);
  if (!allowed && level === 'operate') {
    allowed = await EventAdminAssignment.exists(event.id, req.user.id);
  }
  if (!allowed) {
    throw httpError(403, 'You do not have permission to access this event.');
  }
  return event;
}

function eventGuard(level, getRawId) {
  return async (req, res, next) => {
    try {
      if (!req.user) return requireAuth(req, res, next);
      req.event = await authorizeEvent(req, getRawId(req), level);
      next();
    } catch (err) {
      next(err);
    }
  };
}

const requireEventAccess = eventGuard('manage', (req) => req.params.id);
const requireEventOperations = eventGuard('operate', (req) => req.params.id);
const requireEventOperationsFromBody = eventGuard(
  'operate',
  (req) => (req.body ? req.body.event_id : undefined)
);

function requireEventAdminAssignment(req, res, next) {
  if (!req.user) return requireAuth(req, res, next);
  if (!req.user.isEventAdmin) {
    return next(httpError(403, 'You are not assigned as Event Admin for any event.'));
  }
  next();
}

function redirectIfAuthenticated(req, res, next) {
  if (!req.user) return next();
  res.redirect(homePathForRole(req.user.role));
}

module.exports = {
  attachUser,
  requireAuth,
  requireRole,
  requireEventAccess,
  requireEventOperations,
  requireEventOperationsFromBody,
  requireEventAdminAssignment,
  redirectIfAuthenticated,
  homePathForRole,
};