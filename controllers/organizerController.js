const { validationResult } = require('express-validator');
const OrganizerRequest = require('../models/OrganizerRequest');
const Event = require('../models/Event');
const Stats = require('../models/Stats');
const httpError = require('../utils/httpError');
const { eventBus, EVENTS } = require('../events/eventBus');

async function createRequestFor(userId, reason) {
  if (await OrganizerRequest.findPendingByUser(userId)) {
    throw httpError(409, 'You already have a pending organizer request.');
  }

  let requestId;
  try {
    requestId = await OrganizerRequest.create(userId, reason);
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'You already have a pending organizer request.');
    }
    throw err;
  }

  eventBus.emit(EVENTS.ORGANIZER_REQUEST_CREATED, { requestId, userId });
  return requestId;
}

async function showDashboard(req, res, next) {
  try {
    const [stats, events] = await Promise.all([
      Stats.getOrganizerStats(req.user.id),
      Event.findAll({ organizerId: req.user.id }),
    ]);
    res.render('organizer/dashboard', {
      title: 'Organizer Dashboard',
      stats,
      recentEvents: events.slice(0, 5),
    });
  } catch (err) {
    next(err);
  }
}

async function showRequestForm(req, res, next) {
  try {
    const latest = await OrganizerRequest.findLatestByUser(req.user.id);
    res.render('student/organizer-request', {
      title: 'Request Organizer Role',
      latest,
      errors: {},
      old: {},
    });
  } catch (err) {
    next(err);
  }
}

async function submitRequest(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      const latest = await OrganizerRequest.findLatestByUser(req.user.id);
      return res.status(400).render('student/organizer-request', {
        title: 'Request Organizer Role',
        latest,
        errors: result.mapped(),
        old: { reason: req.body.reason },
      });
    }

    await createRequestFor(req.user.id, req.body.reason);
    req.session.flash = {
      type: 'success',
      message: 'Your request was submitted. A Super Admin will review it.',
    };
    res.redirect('/student/organizer-request');
  } catch (err) {
    if (err.status === 409) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect('/student/organizer-request');
    }
    next(err);
  }
}

async function apiCreateRequest(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
    });
  }

  try {
    const id = await createRequestFor(req.user.id, req.body.reason);
    res.status(201).json({
      success: true,
      message: 'Organizer request submitted',
      data: { requestId: id, status: 'pending' },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showDashboard, showRequestForm, submitRequest, apiCreateRequest };