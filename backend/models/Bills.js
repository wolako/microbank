const db = require('../config/db');

const Bill = {
  async create({ userId, type, provider, amount, reference, status = 'pending' }) {
    const [result] = await db.execute(
      `INSERT INTO bills (user_id, type, provider, amount, reference, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [userId, type, provider, amount, reference, status]
    );
    return result.insertId;
  },

  async findById(id) {
    const [rows] = await db.execute('SELECT * FROM bills WHERE id = ?', [id]);
    return rows[0];
  },

  async findAllByUser(userId) {
    const [rows] = await db.execute('SELECT * FROM bills WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return rows;
  },

  async updateStatus(id, status) {
    await db.execute('UPDATE bills SET status = ? WHERE id = ?', [status, id]);
  },

  async delete(id) {
    await db.execute('DELETE FROM bills WHERE id = ?', [id]);
  }
};

module.exports = Bill;
