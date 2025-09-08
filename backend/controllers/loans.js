const Loan = require('../models/Loan');
const PaymentService = require('../services/payment');
const { ApiError } = require('../middleware/error');
const Notification = require('../models/Notification');
const SMSService = require('../services/sms');
const db = require('../config/db');
const { calculateInstallment } = require('../utils/finance');
const loanService = require('../services/loans-service');
const { calculateCreditScore } = require('../utils/creditScore');
const { Console } = require('winston/lib/winston/transports');


exports.createLoan = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { amount, term, fullName, email, phone } = req.body;
    const user = req.user;

    if (!user || !user.id || !user.main_account_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Utilisateur invalide ou compte bancaire principal manquant." });
    }

    // 🔒 Vérification que les informations personnelles correspondent à l'utilisateur connecté
    if (
      (fullName && fullName.trim() !== `${user.firstname} ${user.lastname}`) ||
      (email && email.trim() !== user.email) ||
      (phone && phone.trim() !== user.phone)
    ) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: "Les informations personnelles saisies ne correspondent pas à votre profil." });
    }

    // Vérifier le solde du compte principal (minimum 50 000 XOF par exemple)
    const { rows: accountRows } = await client.query(
      `SELECT balance FROM accounts WHERE id = $1`,
      [user.main_account_id]
    );

    if (accountRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Compte principal introuvable." });
    }

    const balance = parseFloat(accountRows[0].balance);
    const minimumBalanceRequired = 50000;

    if (balance < minimumBalanceRequired) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Vous devez avoir au moins ${minimumBalanceRequired} XOF sur votre compte principal pour demander un prêt.` });
    }

    // Validation montant et durée
    const termMonths = parseInt(term, 10);
    if (!amount || isNaN(amount) || amount <= 0 || !termMonths || isNaN(termMonths) || termMonths <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Montant ou durée invalide." });
    }

    // Vérifie si l'utilisateur a un prêt en cours non remboursé
    const { rows: activeLoans } = await client.query(`
      SELECT l.id
      FROM loans l
      LEFT JOIN loan_installments i ON l.id = i.loan_id
      WHERE l.user_id = $1
      AND l.status != 'completed'
      GROUP BY l.id
      HAVING COUNT(*) FILTER (WHERE i.status != 'paid') > 0
    `, [user.id]);

    if (activeLoans.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: "Vous avez déjà un prêt en cours non remboursé." });
    }

    // Récupération du produit de prêt adapté
    const { rows: productRows } = await client.query(
      `SELECT id, interest_rate FROM loan_products
       WHERE $1 BETWEEN min_amount AND max_amount
       AND $2 BETWEEN min_term_months AND max_term_months
       ORDER BY interest_rate ASC
       LIMIT 1`,
      [amount, termMonths]
    );

    if (productRows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Aucun produit de prêt correspondant à ce montant et cette durée.' });
    }

    const product = productRows[0];
    const interestRate = parseFloat(product.interest_rate);

    // Calcul total à rembourser et mensualité
    const totalAmount = amount + (amount * (interestRate / 100));
    const monthlyPayment = parseFloat((totalAmount / termMonths).toFixed(2));

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + termMonths);

    const loanData = {
      userId: user.id,
      accountId: user.main_account_id,
      productId: product.id,
      amount,
      interestRate,
      termMonths,
      monthlyPayment,
      startDate,
      endDate
    };

    // Création du prêt en base
    const loan = await Loan.create(client, loanData);

    await client.query('COMMIT');
    res.status(201).json({ message: 'Demande de prêt enregistrée', loan });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur dans createLoan:', err);
    res.status(500).json({ error: 'Erreur lors de la création du prêt.' });
  } finally {
    client.release();
  }
};

exports.repayLoan = async (req, res, next) => {
  try {
    const loanId = req.params.loanId;
    const { method, phone, reference, installmentId } = req.body;
    console.log(`[repayLoan] Start - loanId=${loanId}, user=${req.user.id}, method=${method}`);

    if (!method) {
      return res.status(400).json({ error: 'La méthode de paiement est requise' });
    }

    // Récupérer le prêt
    const loan = await Loan.findById(loanId);
    console.log("[repayLoan] Loan fetched:", loan);
    if (!loan || loan.user_id !== req.user.id) {
      return res.status(404).json({ error: 'Prêt non trouvé ou accès refusé' });
    }

    // Récupérer le montant réel de la prochaine échéance
    const nextPayment = loan.nextPayment || null;
    if (!nextPayment) {
      return res.status(400).json({ error: 'Aucune échéance en attente à payer pour ce prêt.' });
    }

    const paymentData = {
      loanId,
      installmentId: installmentId || nextPayment.id, // on prend l’échéance suivante si non précisé
      amount: parseFloat(nextPayment.amount), // valeur sécurisée depuis la base
      method,
      reference: reference || `MAN-${Date.now()}`,
      userId: req.user.id,
      phone: phone || req.user.phone,
      isRecurring: false
    };

    console.log("[repayLoan] Payment data:", paymentData);

    // 1. Traitement du paiement
    const result = await PaymentService.processLoanPayment(paymentData);
    console.log("[repayLoan] Payment processed OK:", result);

    // 2. Vérification du prêt
    try {
      await Loan.checkAndMarkAsCompleted(loanId);
    } catch (checkErr) {
      console.warn("⚠️ Erreur lors de la mise à jour du statut du prêt :", checkErr.message);
    }

    // 3. Recharger le prêt après paiement
    const updatedLoan = await Loan.findById(loanId);
    console.log("[repayLoan] Updated loan after payment:", updatedLoan);

    // 4. Calcul solde restant
    const paid = updatedLoan.paid_amount || 0;
    const remaining = (updatedLoan.amount || 0) - paid;
    console.log(`[repayLoan] Remaining = ${remaining} (amount=${updatedLoan.amount}, paid=${paid})`);

    // 5. Réponse OK
    return res.json({
      success: true,
      message: 'Paiement effectué avec succès',
      result,
      newBalance: remaining > 0 ? remaining : 0,
      nextPaymentDate: updatedLoan.next_payment_date || null
    });

  } catch (err) {
    console.error("🔥 [repayLoan] Erreur critique paiement :", err);
    return res.status(500).json({
      success: false,
      message: "Le paiement a peut-être été traité, mais une erreur est survenue.",
      details: err.message
    });
  }
};

exports.getLoanDetails = async (req, res, next) => {
  try {
    const loanId = req.params.id;

    // 1️⃣ Récupération du prêt
    const loan = await Loan.findById(loanId);
    if (!loan || loan.user_id !== req.user.id) {
      throw new ApiError(404, 'Prêt non trouvé');
    }

    // 2️⃣ Récupération des informations complémentaires
    const [installments, payments, latePayments] = await Promise.all([
      Loan.getInstallments(loan.id),
      Loan.getPayments(loan.id),
      Loan.getLatePayments(loan.id)
    ]);

    // 3️⃣ Calcul des statistiques
    const totalPaid = payments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
    const remainingAmount = loan.amount - totalPaid;

    // 4️⃣ Mise à jour du status de chaque échéance
    const updatedInstallments = installments.map(inst => {
      const paidAmount = payments
        .filter(p => p.installment_id === inst.id)
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      if (paidAmount >= parseFloat(inst.amount)) {
        return { ...inst, status: 'paid' };
      } else if (new Date(inst.due_date) < new Date()) {
        return { ...inst, status: 'late' };
      } else {
        return { ...inst, status: 'upcoming' };
      }
    });

    // 5️⃣ Calcul du statut global du prêt
    const loanStatus = updatedInstallments.every(i => i.status === 'paid') ? 'paid' : loan.status;

    // 6️⃣ Trouver la prochaine échéance
    const nextPayment = updatedInstallments.find(i => i.status === 'upcoming');

    // 7️⃣ Formatage de la réponse
    const response = {
      id: loan.id,
      amount: loan.amount,
      interestRate: loan.interest_rate,
      termMonths: loan.term_months,
      status: loanStatus,
      createdAt: loan.created_at,
      totalPaid,
      remainingAmount,
      monthlyPayment: loan.monthly_payment,
      nextPaymentDate: nextPayment?.due_date,
      latePaymentsCount: latePayments.length,
      installments: updatedInstallments,
      payments
    };

    res.json(response);
  } catch (err) {
    console.error('Erreur dans getLoanDetails:', err);
    res.status(500).json({ message: 'Erreur lors de la récupération du prêt.' });
  }
};

exports.approveLoan = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. Vérification des permissions
    if (!req.user.isAdmin && !req.user.isLoanOfficer) {
      throw new ApiError(403, 'Permission refusée');
    }

    // 2. Récupération du prêt
    const loan = await Loan.findById(req.params.id, client);
    if (!loan) {
      throw new ApiError(404, 'Prêt non trouvé');
    }

    // 3. Mise à jour du statut
    await Loan.updateStatus(client, loan.id, 'approved');

    // 4. Planification des paiements récurrents
    if (req.body.autoDebitEnabled) {
      await PaymentService.scheduleRecurringPayment({
        id: loan.id,
        user_id: loan.user_id,
        monthly_payment: loan.monthly_payment,
        user_phone: loan.user_phone,
        next_payment_date: loan.start_date,
        end_date: loan.end_date
      });
    }

    await client.query('COMMIT');

    // 5. Notification
    await Notification.create(
      loan.user_id,
      'loan_approved',
      'Votre demande de prêt a été approuvée',
      { loanId: loan.id }
    );

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.getUserLoans = async (req, res, next) => {
  try {
    const { status } = req.query;
    const loans = await Loan.findByUser(req.user.id, status);
    
    const enrichedLoans = await Promise.all(loans.map(async loan => ({
      ...loan,
      nextPayment: await Loan.getNextPayment(loan.id),
      paymentsCount: await Loan.getPaymentsCount(loan.id)
    })));

    res.json(enrichedLoans);
  } catch (err) {
    next(err);
  }
};

exports.cancelLoan = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const loan = await Loan.findById(req.params.id, client);
    if (!loan || loan.user_id !== req.user.id) {
      throw new ApiError(404, 'Prêt non trouvé');
    }

    if (loan.status !== 'pending') {
      throw new ApiError(400, 'Seuls les prêts en attente peuvent être annulés');
    }

    await Loan.updateStatus(client, loan.id, 'cancelled');
    await client.query('COMMIT');

    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};
exports.getLoanSchedule = async (req, res, next) => {
  try {
    const loan = await Loan.findById(req.params.id);
    if (!loan || loan.user_id !== req.user.id) {
      throw new ApiError(404, 'Prêt non trouvé');
    }

    const schedule = await Loan.getPaymentSchedule(loan.id);
    res.json(schedule);
  } catch (err) {
    next(err);
  }
};

// Get all loan products
exports.getLoanProducts = async (req, res, next) => {
  try {
    const { rows } = await db.query(`SELECT * FROM loan_products ORDER BY name`);
    res.json(rows.map(row => ({
      id: row.id,
      name: row.name,
      type: row.name.toLowerCase().includes('agricole') ? 'business' :
            row.name.toLowerCase().includes('immobilier') ? 'mortgage' :
            'personal',
      description: row.description,
      interestRate: parseFloat(row.interest_rate),
      minAmount: parseFloat(row.min_amount),
      maxAmount: parseFloat(row.max_amount),
      minTerm: row.min_term_months,
      maxTerm: row.max_term_months,
      features: [] // Tu peux ajouter des features si tu veux
    })));
  } catch (err) {
    next(err);
  }
};

// Récupérer un seul produit de prêt par ID
exports.getLoanProductById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rows } = await db.query('SELECT * FROM loan_products WHERE id = $1', [id]);

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Produit non trouvé' });
    }

    const row = rows[0];

    res.json({
      id: row.id,
      name: row.name,
      type: row.name.toLowerCase().includes('agricole') ? 'business' :
            row.name.toLowerCase().includes('immobilier') ? 'mortgage' :
            'personal',
      description: row.description,
      interestRate: parseFloat(row.interest_rate),
      minAmount: parseFloat(row.min_amount),
      maxAmount: parseFloat(row.max_amount),
      minTerm: row.min_term_months,
      maxTerm: row.max_term_months,
      features: [] // tu peux enrichir plus tard
    });
  } catch (err) {
    next(err);
  }
};

// ✅ Statistiques globales des prêts (admin)
exports.getLoanStats = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_count,
        COUNT(*) FILTER (WHERE status = 'completed') AS completed_count,
        COALESCE(SUM(amount), 0) AS total_requested,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN amount ELSE 0 END), 0) AS total_approved
      FROM loans
    `);

    const stats = rows[0];

    res.json({
      pending: parseInt(stats.pending_count),
      approved: parseInt(stats.approved_count),
      rejected: parseInt(stats.rejected_count),
      cancelled: parseInt(stats.cancelled_count),
      completed: parseInt(stats.completed_count),
      totalRequested: parseFloat(stats.total_requested),
      totalApproved: parseFloat(stats.total_approved),
    });
  } catch (err) {
    console.error('❌ Erreur getLoanStats:', err);
    next(err);
  }
};

exports.getPaymentStats = async (req, res) => {
  try {
    const [results] = await db.query(`
      SELECT 
        COUNT(*) AS totalPayments,
        SUM(amount) AS totalPaid,
        COUNT(DISTINCT loan_id) AS loansWithPayments,
        SUM(CASE WHEN DATE(payment_date) >= DATE_SUB(CURDATE(), INTERVAL 30 DAY) THEN amount ELSE 0 END) AS paidLast30Days
      FROM loan_payments
    `);

    const stats = results[0];

    res.json({
      totalPayments: stats.totalPayments || 0,
      totalPaid: stats.totalPaid || 0,
      loansWithPayments: stats.loansWithPayments || 0,
      paidLast30Days: stats.paidLast30Days || 0
    });
  } catch (error) {
    console.error('Erreur lors de la récupération des stats de paiements :', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des statistiques de paiements' });
  }
};

exports.getLoanStatistics = async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'approved' OR status = 'active' OR status = 'pending') AS active_loans,
        COALESCE(SUM(amount) FILTER (WHERE status = 'approved' OR status = 'active' OR status = 'pending'), 0) AS total_borrowed,
        (
          SELECT COUNT(*)
          FROM loan_installments i
          JOIN loans l ON i.loan_id = l.id
          WHERE l.user_id = $1 AND i.status = 'pending'
        ) AS unpaid_installments,
        (
          SELECT COUNT(*)
          FROM loan_installments i
          JOIN loans l ON i.loan_id = l.id
          WHERE l.user_id = $1 AND i.status = 'pending' AND i.due_date < CURRENT_DATE
        ) AS overdue_loans,
        (
          SELECT COALESCE(SUM(p.amount), 0)
          FROM loan_payments p
          JOIN loans l ON p.loan_id = l.id
          WHERE l.user_id = $1
        ) AS total_interest_paid,
        (
          SELECT i.due_date
          FROM loan_installments i
          JOIN loans l ON i.loan_id = l.id
          WHERE l.user_id = $1 AND i.status = 'pending'
          ORDER BY i.due_date ASC
          LIMIT 1
        ) AS next_payment_date,
        (
          SELECT i.amount
          FROM loan_installments i
          JOIN loans l ON i.loan_id = l.id
          WHERE l.user_id = $1 AND i.status = 'pending'
          ORDER BY i.due_date ASC
          LIMIT 1
        ) AS next_payment_amount,
        (
          SELECT l.id
          FROM loans l
          WHERE l.user_id = $1 AND (l.status = 'approved' OR l.status = 'active' OR l.status = 'pending')
          ORDER BY l.created_at DESC
          LIMIT 1
        ) AS current_loan_id
      FROM loans
      WHERE user_id = $1
    `, [userId]);

    if (rows.length === 0) {
      return res.status(404).json({ message: 'Aucune statistique trouvée pour cet utilisateur.' });
    }

    const stats = rows[0];

    // Calcul du score de crédit avec ta fonction
    const creditScore = calculateCreditScore({
      active_loans: parseInt(stats.active_loans || 0),
      total_borrowed: parseFloat(stats.total_borrowed || 0),
      unpaid_installments: parseInt(stats.unpaid_installments || 0),
      overdue_loans: parseInt(stats.overdue_loans || 0),
      total_interest_paid: parseFloat(stats.total_interest_paid || 0),
    });

    res.json({
      active_loans: parseInt(stats.active_loans),
      total_borrowed: parseFloat(stats.total_borrowed),
      unpaid_installments: parseInt(stats.unpaid_installments),
      overdue_loans: parseInt(stats.overdue_loans),
      total_interest_paid: parseFloat(stats.total_interest_paid),
      next_payment_date: stats.next_payment_date,
      next_payment_amount: parseFloat(stats.next_payment_amount),
      current_loan_id: stats.current_loan_id,
      creditScore
    });
  } catch (error) {
    console.error('Erreur stats:', error);
    console.error('Erreur lors du chargement des statistiques:', error);
    res.status(500).json({ message: 'Erreur lors du chargement des statistiques' });
  }
};

exports.getLoanDistribution = async (req, res) => {
  try {
    const userId = req.user.id;
    const { rows } = await db.query(`
      SELECT 
        status,
        COUNT(*) AS count
      FROM loans
      WHERE user_id = $1
      GROUP BY status
    `, [userId]);

    // Convertir les résultats en un objet plus simple
    const distribution = {
      active: 0,
      completed: 0,
      overdue: 0
    };

    rows.forEach(row => {
      const status = row.status;
      if (status === 'approved') distribution.active = parseInt(row.count);
      else if (status === 'completed') distribution.completed = parseInt(row.count);
      else if (status === 'overdue') distribution.overdue = parseInt(row.count);
    });

    res.json(distribution);
  } catch (err) {
    console.error('Erreur dans getLoanDistribution:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de la répartition des prêts' });
  }
};

exports.getMonthlyPaymentStats = async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM p.created_at) AS year,
        EXTRACT(MONTH FROM p.created_at) AS month,
        SUM(p.amount) AS total
      FROM loan_payments p
      JOIN loans l ON p.loan_id = l.id
      WHERE l.user_id = $1
      GROUP BY year, month
      ORDER BY year, month
      LIMIT 12
    `, [userId]);

    const formatted = rows.map(r => ({
      year: r.year,
      month: r.month,
      total: parseFloat(r.total)
    }));

    res.json(formatted);
  } catch (err) {
    console.error('Erreur dans getMonthlyPaymentStats:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération de l’historique de paiements' });
  }
};

exports.getUserLoanOverview = async (req, res) => {
  try {
    const userId = req.user.id;

    const { rows } = await db.query(
      `SELECT * FROM user_loan_statistics WHERE user_id = $1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(404).json({ message: 'Aucune statistique trouvée pour cet utilisateur.' });
    }

    res.json(rows[0]);
  } catch (err) {
    console.error('Erreur dans getUserLoanOverview:', err);
    res.status(500).json({ error: 'Erreur lors de la récupération des statistiques utilisateur' });
  }
};

exports.disburseLoan = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Autorisation : seulement admin/loanOfficer
    if (!req.user.isAdmin && !req.user.isLoanOfficer) {
      throw new ApiError(403, 'Permission refusée');
    }

    const loanId = req.params.id;

    // Récupération du prêt
    const loan = await Loan.findById(loanId, client);
    if (!loan) {
      throw new ApiError(404, 'Prêt non trouvé');
    }

    if (loan.status !== 'approved') {
      throw new ApiError(400, 'Le prêt doit être approuvé avant d’être débloqué');
    }

    // ✅ Créditer le compte bancaire du client
    await client.query(`
      INSERT INTO transactions (account_id, type, amount, description)
      VALUES ($1, 'credit', $2, $3)
    `, [loan.account_id, loan.amount, `Déblocage du prêt #${loan.id}`]);

    // ✅ Mettre à jour le statut à "disbursed"
    await Loan.updateStatus(client, loan.id, 'disbursed');

    // ✅ Notifier le client
    await Notification.create(
      loan.user_id,
      'loan_disbursed',
      'Votre prêt a été débloqué avec succès',
      { loanId: loan.id }
    );

    await client.query('COMMIT');
    res.json({ success: true, message: 'Prêt débloqué et crédité avec succès' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur lors du déblocage du prêt:', err);
    next(err);
  } finally {
    client.release();
  }
};

// 📌 Récupération des prochaines échéances de remboursement
exports.getUpcomingInstallments = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT i.id, i.loan_id, i.amount, i.due_date, i.status
      FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      WHERE l.user_id = $1 AND i.status = 'pending'
      ORDER BY i.due_date ASC
      LIMIT 5
    `, [userId]);

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Erreur lors de la récupération des échéances à venir :', error);
    res.status(500).json({ error: { message: 'Erreur serveur' } });
  }
};

// ✅ Simulation de prêt
exports.simulateLoan = async (req, res) => {
  try {
    let { amount, term, rate } = req.body;

    // parsing + validation basique
    amount = parseFloat(amount);
    term = parseInt(term, 10);
    rate = parseFloat(rate);

    if (isNaN(amount) || isNaN(term) || isNaN(rate)) {
      return res.status(400).json({ error: 'amount, term et rate doivent être des valeurs numériques.' });
    }
    if (amount <= 0 || term <= 0 || rate < 0) {
      return res.status(400).json({ error: 'amount et term doivent être > 0 ; rate doit être >= 0.' });
    }

    const monthlyRate = rate / 100 / 12;
    let monthlyPayment;
    if (monthlyRate === 0) {
      // zero interest
      monthlyPayment = parseFloat((amount / term).toFixed(2));
    } else {
      // formule annuité classique
      const denominator = 1 - Math.pow(1 + monthlyRate, -term);
      if (denominator === 0) {
        return res.status(400).json({ error: 'Paramètres invalides provoquent une division par zéro.' });
      }
      monthlyPayment = parseFloat(((amount * monthlyRate) / denominator).toFixed(2));
    }

    const totalPayment = parseFloat((monthlyPayment * term).toFixed(2));
    const totalInterest = parseFloat((totalPayment - amount).toFixed(2));

    return res.json({
      amount,
      term,
      rate,
      monthlyPayment,
      totalInterest,
      totalPayment
    });
  } catch (err) {
    console.error('❌ Erreur simulateLoan:', err);
    return res.status(500).json({ error: 'Erreur serveur' });
  }
};

