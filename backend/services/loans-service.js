exports.getLoanStatistics = async (userId) => {
  const [
    { count: activeLoans },
    { total_borrowed: totalBorrowed },
    { count: pendingPayments },
    { count: completedLoans },
    { count: overdueLoans },
    { total_interest_paid: totalInterestPaid },
    nextPayment,
    currentLoan
  ] = await Promise.all([
    db.one(`SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status = 'active'`, [userId]),
    db.one(`SELECT COALESCE(SUM(amount), 0) AS total_borrowed FROM loans WHERE user_id = $1`, [userId]),
    db.one(`
      SELECT COUNT(*) FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      WHERE l.user_id = $1 AND i.status = 'pending'`, [userId]),
    db.one(`SELECT COUNT(*) FROM loans WHERE user_id = $1 AND status = 'completed'`, [userId]),
    db.one(`
      SELECT COUNT(*) FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      WHERE l.user_id = $1 AND i.status = 'overdue'`, [userId]),
    db.one(`
      SELECT COALESCE(SUM(lp.interest_amount), 0) AS total_interest_paid
      FROM loan_payments lp
      JOIN loans l ON lp.loan_id = l.id
      WHERE l.user_id = $1`, [userId]),
    db.oneOrNone(`
      SELECT i.due_date, i.amount FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      WHERE l.user_id = $1 AND i.status = 'pending'
      ORDER BY i.due_date ASC LIMIT 1`, [userId]),
    db.oneOrNone(`SELECT id FROM loans WHERE user_id = $1 AND status = 'active' ORDER BY start_date DESC LIMIT 1`, [userId])
  ]);

  return {
    activeLoans: parseInt(activeLoans),
    totalBorrowed: parseFloat(totalBorrowed),
    pendingPayments: parseInt(pendingPayments),
    completedLoans: parseInt(completedLoans),
    overdueLoans: parseInt(overdueLoans),
    totalInterestPaid: parseFloat(totalInterestPaid),
    nextPaymentDate: nextPayment?.due_date || null,
    nextPaymentAmount: nextPayment?.amount || null,
    currentLoanId: currentLoan?.id || null
  };
};
