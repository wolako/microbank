const db = require('../config/db');

exports.getFinancialReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const report = await db.query(`
      SELECT 
        -- Résumé financier
        (SELECT SUM(amount) FROM transactions 
         WHERE type = 'deposit' AND created_at BETWEEN $1 AND $2) AS total_deposits,
         
        (SELECT SUM(amount) FROM transactions 
         WHERE type = 'withdrawal' AND created_at BETWEEN $1 AND $2) AS total_withdrawals,
         
        (SELECT SUM(amount) FROM loans 
         WHERE status = 'active' AND created_at BETWEEN $1 AND $2) AS active_loans,
         
        -- Détails des prêts
        json_agg(
          json_build_object(
            'loan_id', l.id,
            'client', u.first_name || ' ' || u.last_name,
            'amount', l.amount,
            'interest_rate', l.interest_rate,
            'paid_amount', l.paid_amount
          )
        ) AS loan_details
      FROM loans l
      JOIN users u ON l.user_id = u.id
      WHERE l.created_at BETWEEN $1 AND $2
      GROUP BY l.id
    `, [startDate, endDate]);

    res.json({
      period: { startDate, endDate },
      data: report.rows[0]
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};