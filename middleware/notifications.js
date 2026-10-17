const Notification = require('../models/Notification');

async function attachUnreadCount(req, res, next) {
  res.locals.unreadCount = 0;

  if (!req.user || req.originalUrl.startsWith('/api')) return next();

  try {
    res.locals.unreadCount = await Notification.countUnread(req.user.id);
  } catch (err) {
    console.error('Could not count notifications:', err.message); // the page still loads
  }
  next();
}

module.exports = { attachUnreadCount };