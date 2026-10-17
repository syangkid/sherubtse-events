const { validationResult } = require('express-validator');
const Venue = require('../models/Venue');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');

function readVenueInput(body) {
  return {
    name: body.name,
    location: body.location,
    capacity: Number(body.capacity),
    description: body.description || null,
  };
}

async function createVenue(data) {
  try {
    const id = await Venue.create(data);
    return Venue.findById(id);
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'A venue with this name already exists.', 'name');
    }
    throw err;
  }
}

async function updateVenue(id, data) {
  const venue = await Venue.findById(id);
  if (!venue) throw httpError(404, 'Venue not found.');

  const tooBig = await Venue.countEventsOverCapacity(id, data.capacity);
  if (tooBig > 0) {
    throw httpError(
      409,
      `${tooBig} event(s) at this venue have a larger capacity than ${data.capacity}.`,
      'capacity'
    );
  }

  try {
    await Venue.update(id, data);
    return Venue.findById(id);
  } catch (err) {
    if (err.code === '23505') {
      throw httpError(409, 'A venue with this name already exists.', 'name');
    }
    throw err;
  }
}

async function deleteVenue(id) {
  try {
    const deleted = await Venue.remove(id);
    if (!deleted) throw httpError(404, 'Venue not found.');
  } catch (err) {
    if (err.code === '23503') {
      throw httpError(409, 'This venue is used by one or more events and cannot be deleted.');
    }
    throw err;
  }
}

function errorList(result) {
  return result.array().map((e) => ({ field: e.path, message: e.msg }));
}


async function showVenues(req, res, next) {
  try {
    const venues = await Venue.findAll();
    res.render('superadmin/venues', { title: 'Venues', venues });
  } catch (err) {
    next(err);
  }
}

function showNewForm(req, res) {
  res.render('superadmin/venue-form', {
    title: 'Add Venue',
    heading: 'Add a venue',
    action: '/superadmin/venues',
    values: {},
    errors: {},
  });
}

async function createVenueWeb(req, res, next) {
  const render = (status, errors) =>
    res.status(status).render('superadmin/venue-form', {
      title: 'Add Venue',
      heading: 'Add a venue',
      action: '/superadmin/venues',
      values: req.body,
      errors,
    });

  try {
    const result = validationResult(req);
    if (!result.isEmpty()) return render(400, result.mapped());

    const venue = await createVenue(readVenueInput(req.body));
    req.session.flash = { type: 'success', message: `Venue "${venue.name}" added.` };
    res.redirect('/superadmin/venues');
  } catch (err) {
    if (err.status === 409 && err.field) return render(409, { [err.field]: { msg: err.message } });
    next(err);
  }
}

async function showEditForm(req, res, next) {
  try {
    const id = parseId(req.params.id, 'venue id');
    const venue = await Venue.findById(id);
    if (!venue) throw httpError(404, 'Venue not found.');

    res.render('superadmin/venue-form', {
      title: 'Edit Venue',
      heading: `Edit venue: ${venue.name}`,
      action: `/superadmin/venues/${venue.id}/edit`,
      values: {
        name: venue.name,
        location: venue.location,
        capacity: venue.capacity,
        description: venue.description,
      },
      errors: {},
    });
  } catch (err) {
    next(err);
  }
}

async function updateVenueWeb(req, res, next) {
  try {
    const id = parseId(req.params.id, 'venue id');
    const render = (status, errors) =>
      res.status(status).render('superadmin/venue-form', {
        title: 'Edit Venue',
        heading: 'Edit venue',
        action: `/superadmin/venues/${id}/edit`,
        values: req.body,
        errors,
      });

    const result = validationResult(req);
    if (!result.isEmpty()) return render(400, result.mapped());

    try {
      const venue = await updateVenue(id, readVenueInput(req.body));
      req.session.flash = { type: 'success', message: `Venue "${venue.name}" updated.` };
      res.redirect('/superadmin/venues');
    } catch (err) {
      if (err.status === 409 && err.field) {
        return render(409, { [err.field]: { msg: err.message } });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
}

async function deleteVenueWeb(req, res, next) {
  try {
    const id = parseId(req.params.id, 'venue id');
    await deleteVenue(id);
    req.session.flash = { type: 'info', message: 'Venue deleted.' };
    res.redirect('/superadmin/venues');
  } catch (err) {
    if ([404, 409].includes(err.status)) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect('/superadmin/venues');
    }
    next(err);
  }
}

async function apiListVenues(req, res, next) {
  try {
    const venues = await Venue.findAll();
    res.status(200).json({ success: true, message: 'Venues', data: { venues } });
  } catch (err) {
    next(err);
  }
}

async function apiCreateVenue(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorList(result),
      });
    }
    const venue = await createVenue(readVenueInput(req.body));
    res.status(201).json({ success: true, message: 'Venue created successfully', data: { venue } });
  } catch (err) {
    next(err);
  }
}

async function apiUpdateVenue(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errorList(result),
      });
    }
    const id = parseId(req.params.id, 'venue id');
    const venue = await updateVenue(id, readVenueInput(req.body));
    res.status(200).json({ success: true, message: 'Venue updated successfully', data: { venue } });
  } catch (err) {
    next(err);
  }
}

async function apiGetVenue(req, res, next) {
  try {
    const id = parseId(req.params.id, 'venue id');
    const venue = await Venue.findById(id);
    if (!venue) throw httpError(404, 'Venue not found.');
    res.status(200).json({ success: true, message: 'Venue', data: { venue } });
  } catch (err) {
    next(err);
  }
}

async function apiDeleteVenue(req, res, next) {
  try {
    const id = parseId(req.params.id, 'venue id');
    await deleteVenue(id);
    res.status(200).json({ success: true, message: 'Venue deleted successfully', data: {} });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  showVenues,
  showNewForm,
  createVenueWeb,
  showEditForm,
  updateVenueWeb,
  deleteVenueWeb,
  apiListVenues,
  apiGetVenue,
  apiCreateVenue,
  apiUpdateVenue,
  apiDeleteVenue,
};