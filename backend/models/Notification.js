const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class Notification {
  static async create(userId, type, message, metadata = {}) {
    const { rows } = await db.query(
      `INSERT INTO notifications (
        id, user_id, type, message, metadata, is_read
       ) VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [uuidv4(), userId, type, message, metadata, false]
    );
    return rows[0];
  }

  static async markAsRead(notificationId) {
    await db.query(
      'UPDATE notifications SET is_read = true WHERE id = $1',
      [notificationId]
    );
  }

  static async getUserNotifications(userId, limit = 10) {
    const { rows } = await db.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  }
}

module.exports = Notification;