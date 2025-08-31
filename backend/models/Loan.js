const db = require('../config/db');

class Loan {
  static async create(client, loanData) {
    const { rows } = await client.query(
      `INSERT INTO loans (
        user_id, account_id, product_id,
        amount, interest_rate, term_months, 
        monthly_payment, start_date, end_date, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending')
      RETURNING *`,
      [
        loanData.userId,
        loanData.accountId,      // ✅ nécessaire
        loanData.productId || null, // si tu as un produit de prêt à lier
        loanData.amount,
        loanData.interestRate,
        loanData.termMonths,
        loanData.monthlyPayment,
        loanData.startDate,
        loanData.endDate
      ]
    );
    return rows[0];
  }

  static async findById(id, client = db) {
    const { rows } = await client.query(
      'SELECT * FROM loans WHERE id = $1',
      [id]
    );
    return rows[0];
  }

  static async findByUser(userId, status) {
    let query = 'SELECT * FROM loans WHERE user_id = $1';
    const params = [userId];
    if (status) {
      query += ' AND status = $2';
      params.push(status);
    }
    const { rows } = await db.query(query, params);
    return rows;
  }

  static async findAll(client = db) {
    const { rows } = await client.query(`
      SELECT l.*, 
            u.firstName, u.lastName, u.email,
            a.accountNumber,
            p.name AS product_name
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN accounts a ON l.account_id = a.id
      JOIN loan_products p ON l.product_id = p.id
      ORDER BY l.created_at DESC
    `);
    return rows;
  }

  static async updateStatus(client, loanId, status) {
    await client.query(
      'UPDATE loans SET status = $1 WHERE id = $2',
      [status, loanId]
    );
  }

  static async generateInstallments(client, loanId, amount, termMonths) {
    const installments = [];
    const now = new Date();
    for (let i = 1; i <= termMonths; i++) {
      const dueDate = new Date(now);
      dueDate.setMonth(dueDate.getMonth() + i);
      installments.push([loanId, dueDate, amount]);
    }

    await client.query(
      `INSERT INTO loan_installments (loan_id, due_date, amount)
       SELECT * FROM UNNEST($1::uuid[], $2::timestamp[], $3::decimal[])`,
      [
        installments.map(i => i[0]),
        installments.map(i => i[1]),
        installments.map(i => i[2])
      ]
    );
  }

  static async getInstallments(loanId) {
    const { rows } = await db.query(
      `SELECT * FROM loan_installments WHERE loan_id = $1 ORDER BY due_date`,
      [loanId]
    );
    return rows;
  }

  static async getPayments(loanId) {
    const { rows } = await db.query(
      `SELECT * FROM loan_payments WHERE loan_id = $1 ORDER BY created_at`,
      [loanId]
    );
    return rows;
  }

  static async getPaymentsCount(loanId) {
    const { rows } = await db.query(
      `SELECT COUNT(*) FROM loan_payments WHERE loan_id = $1`,
      [loanId]
    );
    return parseInt(rows[0].count, 10);
  }

  static async getNextPayment(loanId) {
    const { rows } = await db.query(
      `SELECT * FROM loan_installments 
       WHERE loan_id = $1 AND status = 'pending'
       ORDER BY due_date ASC LIMIT 1`,
      [loanId]
    );
    return rows[0];
  }

  static async getLatePayments(loanId) {
    const { rows } = await db.query(
      `SELECT * FROM loan_installments 
       WHERE loan_id = $1 AND status = 'overdue'`,
      [loanId]
    );
    return rows;
  }

  static async getPaymentSchedule(loanId) {
    const { rows } = await db.query(
      `SELECT * FROM loan_installments WHERE loan_id = $1 ORDER BY due_date`,
      [loanId]
    );
    return rows;
  }

  static async findPending(client = db) {
    const { rows } = await client.query(`
      SELECT l.*, 
            u.firstName, u.lastName, u.email,
            a.accountNumber,
            p.name AS product_name
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN accounts a ON l.account_id = a.id
      JOIN loan_products p ON l.product_id = p.id
      WHERE l.status = 'pending'
      ORDER BY l.created_at DESC
    `);
    return rows;
  }

  static async findByStatus(status, client = db) {
    const { rows } = await client.query(`
      SELECT l.*, 
             u.firstName, u.lastName, u.email,
             a.accountNumber,
             p.name AS product_name
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN accounts a ON l.account_id = a.id
      JOIN loan_products p ON l.product_id = p.id
      WHERE l.status = $1
      ORDER BY l.created_at DESC
    `, [status]);
    return rows;
  }

  static async findWithFilters(filters = {}, client = db) {
    const conditions = [];
    const values = [];
    let idx = 1;

    if (filters.userId) {
      conditions.push(`l.user_id = $${idx++}`);
      values.push(filters.userId);
    }

    if (filters.status) {
      conditions.push(`l.status = $${idx++}`);
      values.push(filters.status);
    }

    if (filters.startDate) {
      conditions.push(`l.created_at >= $${idx++}`);
      values.push(filters.startDate);
    }

    if (filters.endDate) {
      conditions.push(`l.created_at <= $${idx++}`);
      values.push(filters.endDate);
    }

    if (filters.minAmount) {
      conditions.push(`l.amount >= $${idx++}`);
      values.push(filters.minAmount);
    }

    if (filters.maxAmount) {
      conditions.push(`l.amount <= $${idx++}`);
      values.push(filters.maxAmount);
    }

    if (filters.productId) {
      conditions.push(`l.product_id = $${idx++}`);
      values.push(filters.productId);
    }

    const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
      SELECT l.*, 
             u.firstName, u.lastName, u.email,
             a.accountNumber,
             p.name AS product_name
      FROM loans l
      JOIN users u ON l.user_id = u.id
      JOIN accounts a ON l.account_id = a.id
      JOIN loan_products p ON l.product_id = p.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;

    const { rows } = await client.query(query, values);
    return rows;
  }

  static async checkAndMarkAsCompleted(loanId) {
    try {
      console.log(`[Loan.checkAndMarkAsCompleted] Start - loanId: ${loanId}`);

      // Exécution de la requête
      const { rows } = await db.query(`
        SELECT COUNT(*) AS remaining
        FROM loan_installments
        WHERE loan_id = $1 AND status != 'paid'
      `, [loanId]);

      console.log(`[Loan.checkAndMarkAsCompleted] Query result:`, rows);

      // Vérification du résultat
      if (!rows || rows.length === 0 || rows[0].remaining === undefined) {
        console.error(`[Loan.checkAndMarkAsCompleted] Unexpected query result`, rows);
        throw new Error('Impossible de déterminer le nombre d’échéances restantes');
      }

      const remaining = parseInt(rows[0].remaining, 10);
      if (isNaN(remaining)) {
        console.error(`[Loan.checkAndMarkAsCompleted] Remaining is NaN`, rows[0].remaining);
        throw new Error('Valeur "remaining" non numérique');
      }

      console.log(`[Loan.checkAndMarkAsCompleted] Remaining installments: ${remaining}`);

      // Mise à jour du statut si toutes payées
      if (remaining === 0) {
        console.log(`[Loan.checkAndMarkAsCompleted] All installments paid. Updating loan status to "completed"...`);
        const updateRes = await db.query(
          `UPDATE loans SET status = 'completed' WHERE id = $1 RETURNING id, status`,
          [loanId]
        );
        console.log(`[Loan.checkAndMarkAsCompleted] Update result:`, updateRes.rows);
      } else {
        console.log(`[Loan.checkAndMarkAsCompleted] Loan not fully paid yet.`);
      }

      console.log(`[Loan.checkAndMarkAsCompleted] Done - loanId: ${loanId}`);
    } catch (err) {
      console.error(`[Loan.checkAndMarkAsCompleted] ERROR for loanId ${loanId}:`, err);
      throw err; // on relance l'erreur pour que le middleware Express l’intercepte
    }
  }


}

module.exports = Loan;
