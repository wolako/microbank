const Notification = require('../models/Notification');

async function checkUnreadNotifications(req, res, next) {
  if (req.user) {
    const unreadCount = await Notification.countUnread(req.user.id);
    res.locals.unreadNotifications = unreadCount;
  }
  next();
}

module.exports = checkUnreadNotifications;