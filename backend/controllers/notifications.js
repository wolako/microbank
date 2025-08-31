const Notification = require('../models/Notification');
const { ApiError } = require('../middleware/error');

exports.getNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.getUserNotifications(req.user.id);
    res.json(notifications);
  } catch (err) {
    next(err);
  }
};

exports.markAsRead = async (req, res, next) => {
  try {
    await Notification.markAsRead(req.params.id);
    res.json({ message: 'Notification marquée comme lue' });
  } catch (err) {
    next(err);
  }
};