const { validationResult } = require('express-validator');

const Attendance = require('../models/Attendance');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');
const { attendanceWindow, summarize } = require('../utils/attendanceState');
const { eventBus, EVENTS } = require('../events/eventBus');

async function markFor(event, registrationId, status, markedBy) {
  const window = attendanceWindow(event);
  if (!window.open) throw httpError(409, window.message);

  const result = await Attendance.mark(event.id, registrationId, status, markedBy);
  if (!result) {
    throw httpError(
      404,
      'Participant not found for this event, or their registration was cancelled.'
    );
  }

  eventBus.emit(EVENTS.ATTENDANCE_RECORDED, {
    registrationId: result.registrationId,
    userId: result.userId,
    eventId: event.id,
    eventTitle: event.title,
    status: result.status,
    markedBy,
  });

  return result;
}

async function markWeb(req, res, next) {
  const back = `/manage/events/${req.event.id}/participants`;
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) throw httpError(400, result.array()[0].msg);

    const registrationId = parseId(req.body.registration_id, 'registration id');
    await markFor(req.event, registrationId, req.body.status, req.user.id);

    req.session.flash = {
      type: 'success',
      message: `Attendance saved: ${req.body.status}.`,
    };
    res.redirect(back);
  } catch (err) {
    if ([400, 404, 409].includes(err.status)) {
      req.session.flash = { type: 'error', message: err.message };
      return res.redirect(back);
    }
    next(err);
  }
}

async function apiMark(req, res, next) {
  try {
    const result = validationResult(req);
    if (!result.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: result.array().map((e) => ({ field: e.path, message: e.msg })),
      });
    }
    const registrationId = parseId(req.body.registration_id, 'registration id');
    const saved = await markFor(req.event, registrationId, req.body.status, req.user.id);
    res.status(200).json({
      success: true,
      message: 'Attendance recorded',
      data: {
        registrationId: saved.registrationId,
        eventId: req.event.id,
        status: saved.status,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function apiListAttendance(req, res, next) {
  try {
    const participants = await Attendance.findParticipants(req.event.id);
    const attendance = participants
      .filter((p) => p.status === 'registered')
      .map((p) => ({
        registrationId: p.registrationId,
        userId: p.userId,
        fullName: p.fullName,
        studentIdNo: p.studentIdNo,
        attendanceStatus: p.attendanceStatus,
        markedAt: p.markedAt,
        markedByName: p.markedByName,
      }));
    res.status(200).json({
      success: true,
      message: 'Attendance',
      data: { eventId: req.event.id, summary: summarize(participants), attendance },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { markWeb, apiMark, apiListAttendance };