const { validationResult } = require('express-validator');

const Event = require('../models/Event');
const Venue = require('../models/Venue');
const Schedule = require('../models/Schedule');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');

const CREATE_STATUSES = ['draft', 'published'];
const ALL_STATUSES = ['draft', 'published', 'cancelled', 'completed'];
const WHEN_OPTIONS = ['upcoming', 'past', 'all'];

function readEventInput(body) {
  return {
    title: body.title,
    description: body.description || null,
    eventDate: body.event_date,
    capacity: Number(body.capacity),
    venueId: Number(body.venue_id),
    status: body.status,
  };
}

async function checkBusinessRules(data, existing) {
  const venue = await Venue.findById(data.venueId);
  if (!venue) {
    throw httpError(400, 'The selected venue does not exist.', 'venue_id');
  }
  if (data.capacity > venue.capacity) {
    throw httpError(
      400,
      `Capacity cannot exceed the venue capacity (${venue.capacity}).`,
      'capacity'
    );
  }
  if (existing && data.capacity < existing.registeredCount) {
    throw httpError(
      400,
      `Capacity cannot be lower than the ${existing.registeredCount} current registration(s).`,
      'capacity'
    );
  }
}

async function createEvent(data, organizerId) {
  await checkBusinessRules(data, null);
  return Event.create({ ...data, organizerId });
}

function listPathFor(user) {
  return user.role === 'super_admin' ? '/superadmin/events' : '/organizer/my-events';
}

function errorList(result) {
  return result.array().map((e) => ({ field: e.path, message: e.msg }));
}

// Event data 
function valuesFromEvent(event) {
  return {
    title: event.title,
    description: event.description,
    event_date: event.eventDate,
    capacity: event.capacity,
    venue_id: event.venueId,
    status: event.status,
  };
}

async function showAllEvents(req, res, next) {
  try {
    const events = await Event.findAll();
    res.render('superadmin/events', { title: 'All Events', events });
  } catch (err) {
    next(err);
  }
}

async function showMyEvents(req, res, next) {
  try {
    const events = await Event.findAll({ organizerId: req.user.id });
    res.render('organizer/my-events', { title: 'My Events', events });
  } catch (err) {
    next(err);
  }
}

async function showCreateForm(req, res, next) {
  try {
    const venues = await Venue.findAll();
    res.render('organizer/create-event', {
      title: 'Create Event',
      venues,
      statuses: CREATE_STATUSES,
      values: { status: 'draft' },
      errors: {},
    });
  } catch (err) {
    next(err);
  }
}

async function createEventWeb(req, res, next) {
  try {
    const venues = await Venue.findAll();
    const render = (status, errors) =>
      res.status(status).render('organizer/create-event', {
        title: 'Create Event',
        venues,
        statuses: CREATE_STATUSES,
        values: req.body,
        errors,
      });

    const result = validationResult(req);
    if (!result.isEmpty()) return render(400, result.mapped());

    try {
      const id = await createEvent(readEventInput(req.body), req.user.id);
      req.session.flash = {
        type: 'success',
        message: 'Event created. You can now add its schedule below.',
      };
      res.redirect(`/manage/events/${id}/edit`);
    } catch (err) {
      if (err.status === 400 && err.field) return render(400, { [err.field]: { msg: err.message } });
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function renderEdit(req, res, options = {}) {
  const {
    status = 200,
    values,
    errors = {},
    scheduleErrors = {},
    scheduleValues = {},
  } = options;

  const [venues, schedules] = await Promise.all([
    Venue.findAll(),
    Schedule.findByEvent(req.event.id),
  ]);

  res.status(status).render('organizer/edit-event', {
    title: 'Edit Event',
    event: req.event,
    schedules,
    venues,
    statuses: ALL_STATUSES,
    values: values || valuesFromEvent(req.event),
    errors,
    scheduleErrors,
    scheduleValues,
  });
}

async function showEditForm(req, res, next) {
  try {
    await renderEdit(req, res);
  } catch (err) {
    next(err);
  }
}

async function updateEventWeb(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return await renderEdit(req, res, {
        status: 400,
        values: req.body,
        errors: result.mapped(),
      });
    }

    try {
      const data = readEventInput(req.body);
      await checkBusinessRules(data, req.event);
      await Event.update(req.event.id, data);
    } catch (err) {
      if (err.status === 400 && err.field) {
        return await renderEdit(req, res, {
          status: 400,
          values: req.body,
          errors: { [err.field]: { msg: err.message } },
        });
      }
      throw err;
    }

    req.session.flash = { type: 'success', message: 'Event updated.' };
    res.redirect(`/manage/events/${req.event.id}/edit`);
  } catch (err) {
    next(err);
  }
}

async function deleteEventWeb(req, res, next) {
  try {
    const deleted = await Event.remove(req.event.id);
    if (!deleted) {
      req.session.flash = {
        type: 'error',
        message:
          'This event has registrations and cannot be deleted. Set its status to Cancelled instead.',
      };
      return res.redirect(`/manage/events/${req.event.id}/edit`);
    }
    req.session.flash = { type: 'info', message: `Event "${req.event.title}" deleted.` };
    res.redirect(listPathFor(req.user));
  } catch (err) {
    next(err);
  }
}

async function addScheduleWeb(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return await renderEdit(req, res, {
        status: 400,
        scheduleErrors: result.mapped(),
        scheduleValues: req.body,
      });
    }

    await Schedule.create(req.event.id, {
      startTime: req.body.start_time,
      endTime: req.body.end_time,
      description: req.body.description,
    });
    req.session.flash = { type: 'success', message: 'Schedule slot added.' };
    res.redirect(`/manage/events/${req.event.id}/edit`);
  } catch (err) {
    next(err);
  }
}

async function removeScheduleWeb(req, res, next) {
  try {
    const scheduleId = parseId(req.params.scheduleId, 'schedule id');
    const removed = await Schedule.removeFromEvent(req.event.id, scheduleId);
    req.session.flash = removed
      ? { type: 'info', message: 'Schedule slot removed.' }
      : { type: 'error', message: 'Schedule slot not found for this event.' };
    res.redirect(`/manage/events/${req.event.id}/edit`);
  } catch (err) {
    next(err);
  }
}

async function apiListEvents(req, res, next) {
  try {
    let events;
    if (req.user && req.user.role === 'super_admin') {
      events = await Event.findAll();
    } else if (req.user && req.user.role === 'organizer' && req.query.mine === 'true') {
      events = await Event.findAll({ organizerId: req.user.id });
    } else {
      const search = (req.query.search || '').trim().slice(0, 100);
      const when = WHEN_OPTIONS.includes(req.query.when) ? req.query.when : 'all';
      events = await Event.findPublic({
        search,
        when,
        userId: req.user ? req.user.id : null,
      });
    }
    res.status(200).json({ success: true, message: 'Events', data: { events } });
  } catch (err) {
    next(err);
  }
}

// Loads an event, hiding drafts from people who cannot manage them
async function loadVisibleEvent(req) {
  const id = parseId(req.params.id, 'event id');
  const event = await Event.findById(id);
  const visible = event && (event.status !== 'draft' || Event.canManage(req.user, event));
  if (!visible) throw httpError(404, 'Event not found.');
  return event;
}

async function apiListSchedules(req, res, next) {
  try {
    const event = await loadVisibleEvent(req);
    const schedules = await Schedule.findByEvent(event.id);
    res.status(200).json({
      success: true,
      message: 'Schedule',
      data: { eventId: event.id, schedules },
    });
  } catch (err) {
    next(err);
  }
}

async function apiAddSchedule(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorList(result),
      });
    }
    const id = await Schedule.create(req.event.id, {
      startTime: req.body.start_time,
      endTime: req.body.end_time,
      description: req.body.description,
    });
    const schedules = await Schedule.findByEvent(req.event.id);
    res.status(201).json({
      success: true,
      message: 'Schedule slot added',
      data: { schedule: schedules.find((s) => s.id === id) },
    });
  } catch (err) {
    next(err);
  }
}

async function apiRemoveSchedule(req, res, next) {
  try {
    const scheduleId = parseId(req.params.scheduleId, 'schedule id');
    const removed = await Schedule.removeFromEvent(req.event.id, scheduleId);
    if (!removed) throw httpError(404, 'Schedule slot not found for this event.');
    res.status(200).json({ success: true, message: 'Schedule slot removed', data: {} });
  } catch (err) {
    next(err);
  }
}

async function apiGetEvent(req, res, next) {
  try {
    const id = parseId(req.params.id, 'event id');
    const event = await Event.findById(id);
    const visible = event && (event.status !== 'draft' || Event.canManage(req.user, event));
    if (!visible) throw httpError(404, 'Event not found.');

    const schedules = await Schedule.findByEvent(id);
    res.status(200).json({ success: true, message: 'Event', data: { event, schedules } });
  } catch (err) {
    next(err);
  }
}

async function apiCreateEvent(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorList(result),
      });
    }
    const id = await createEvent(readEventInput(req.body), req.user.id);
    const event = await Event.findById(id);
    res.status(201).json({ success: true, message: 'Event created successfully', data: { event } });
  } catch (err) {
    next(err);
  }
}

async function apiUpdateEvent(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorList(result),
      });
    }
    const data = readEventInput(req.body);
    await checkBusinessRules(data, req.event);
    await Event.update(req.event.id, data);
    const event = await Event.findById(req.event.id);
    res.status(200).json({ success: true, message: 'Event updated successfully', data: { event } });
  } catch (err) {
    next(err);
  }
}

async function apiDeleteEvent(req, res, next) {
  try {
    const deleted = await Event.remove(req.event.id);
    if (!deleted) {
      throw httpError(
        409,
        'This event has registrations and cannot be deleted. Set its status to cancelled instead.'
      );
    }
    res.status(200).json({ success: true, message: 'Event deleted successfully', data: {} });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showAllEvents,
  showMyEvents,
  showCreateForm,
  createEventWeb,
  showEditForm,
  updateEventWeb,
  deleteEventWeb,
  addScheduleWeb,
  removeScheduleWeb,
  apiListEvents,
  apiGetEvent,
  apiCreateEvent,
  apiUpdateEvent,
  apiDeleteEvent,
  apiListSchedules,
  apiAddSchedule,
  apiRemoveSchedule,
};