const Notification = require('../models/Notification');
const httpError = require('../utils/httpError');
const parseId = require('../utils/parseId');

async function showNotifications(req, res, next) {
  try {
    const notifications = await Notification.findByUser(req.user.id);
    res.render('notifications', { title: 'Notifications', notifications });
  } catch (err) {
    next(err);
  }
}

async function markReadWeb(req, res, next) {
  try {
    const id = parseId(req.params.id, 'notification id');
    await Notification.markRead(id, req.user.id);
    res.redirect('/notifications');
  } catch (err) {
    next(err);
  }
}

async function markAllReadWeb(req, res, next) {
  try {
    await Notification.markAllRead(req.user.id);
    req.session.flash = { type: 'info', message: 'All notifications marked as read.' };
    res.redirect('/notifications');
  } catch (err) {
    next(err);
  }
}

async function apiList(req, res, next) {
  try {
    const [notifications, unread] = await Promise.all([
      Notification.findByUser(req.user.id),
      Notification.countUnread(req.user.id),
    ]);
    res.status(200).json({
      success: true,
      message: 'Notifications',
      data: { unread, notifications },
    });
  } catch (err) {
    next(err);
  }
}

async function apiMarkRead(req, res, next) {
  try {
    const id = parseId(req.params.id, 'notification id');
    const updated = await Notification.markRead(id, req.user.id);
    if (!updated) throw httpError(404, 'Notification not found.');
    res.status(200).json({ success: true, message: 'Notification marked as read.', data: {} });
  } catch (err) {
    next(err);
  }
}

module.exports = { showNotifications, markReadWeb, markAllReadWeb, apiList, apiMarkRead };