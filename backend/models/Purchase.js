const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class Purchase {
  static async create({
    userId,
    accountId,
    amount,
    merchantName,
    productName,
    description = '',
    status = 'pending',
    metadata = {}
  }) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const result = await db.query(`
      INSERT INTO purchases (
        id, user_id, account_id, amount, merchant_name, product_name, description,
        status, metadata, created_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [
      id,
      userId,
      accountId,
      amount,
      merchantName,
      productName,
      description,
      status,
      metadata,
      createdAt
    ]);

    return result.rows[0];
  }

  static async findByUser(userId, limit = 5) {
    const { rows } = await db.query(`
      SELECT * FROM purchases 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `, [userId, limit]);
    return rows;
  }
}

module.exports = Purchase;
