const Event = require('../models/Event');
const Attendance = require('../models/Attendance');
const EventAdminAssignment = require('../models/EventAdminAssignment');
const { attendanceWindow, summarize } = require('../utils/attendanceState');

async function showDashboard(req, res, next) {
  try {
    const events = await EventAdminAssignment.findEventsForUser(req.user.id);
    const stats = {
      assignedEvents: events.length,
      participants: events.reduce((sum, e) => sum + e.registeredCount, 0),
      attendanceMarked: events.reduce((sum, e) => sum + e.markedCount, 0),
    };
    res.render('event-admin/dashboard', { title: 'Event Admin Dashboard', events, stats });
  } catch (err) {
    next(err);
  }
}

async function showParticipants(req, res, next) {
  try {
    const participants = await Attendance.findParticipants(req.event.id);
    const window = attendanceWindow(req.event);
    res.render('event-admin/participants', {
      title: 'Participants',
      event: req.event,
      participants,
      summary: summarize(participants),
      attendanceOpen: window.open,
      attendanceMessage: window.message,
      canManageEvent: Event.canManage(req.user, req.event),
    });
  } catch (err) {
    next(err);
  }
}

async function apiParticipants(req, res, next) {
  try {
    const participants = await Attendance.findParticipants(req.event.id);
    res.status(200).json({
      success: true,
      message: 'Participants',
      data: { eventId: req.event.id, summary: summarize(participants), participants },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { showDashboard, showParticipants, apiParticipants };