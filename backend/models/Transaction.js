const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');

class Transaction {
  static async create({
    userId,
    accountId,
    amount,
    type,
    channel = null,
    description = '',
    status = 'pending',
    balanceAfter = null,
    reference = null,
    metadata = {}
  }) {
    const id = uuidv4();
    const createdAt = new Date().toISOString();

    const result = await db.query(`
      INSERT INTO transactions (
        id, user_id, account_id, amount, type, channel, description,
        status, balance_after, reference, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `, [
      id,
      userId,
      accountId,
      amount,
      type,
      channel,
      description,
      status,
      balanceAfter,
      reference,
      metadata,
      createdAt
    ]);

    return result.rows[0];
  }

  static async findByUser(userId, limit = 5) {
    const { rows } = await db.query(
      `SELECT * FROM transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2`,
      [userId, limit]
    );
    return rows;
  }

  // ⚡ Calculer le solde exact depuis les transactions
  static async getBalance(userId) {
    const { rows } = await db.query(`
      SELECT COALESCE(SUM(
        CASE
          WHEN type = 'withdrawal' OR type = 'debit' THEN -amount
          ELSE amount
        END
      ), 0) AS balance
      FROM transactions
      WHERE user_id = $1
    `, [userId]);
    return parseFloat(rows[0].balance) || 0;
  }
}

module.exports = Transaction;
