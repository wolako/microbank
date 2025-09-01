const Loan = require('../models/Loan');
const db = require('../config/db');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const mailer = require('../utils/mailer');
const NotificationService = require('../services/notification');


exports.getAllLoans = async (req, res) => {
  const client = await db.connect();
  try {
    const { status, minAmount, maxAmount, page = 1, pageSize = 10 } = req.query;
    const offset = (page - 1) * pageSize;
    const conditions = [], params = [];

    if (status) { 
      params.push(status); 
      conditions.push(`l.status = $${params.length}`); 
    }
    if (minAmount) { 
      params.push(minAmount); 
      conditions.push(`l.amount >= $${params.length}`); 
    }
    if (maxAmount) { 
      params.push(maxAmount); 
      conditions.push(`l.amount <= $${params.length}`); 
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Total sans pagination ni jointure
    const countRes = await client.query(`SELECT COUNT(*) FROM loans l ${where}`, params);
    const total = parseInt(countRes.rows[0].count, 10);

    // Pagination params pour CTE
    const pageParams = [pageSize, offset];

    const query = `
      WITH paged_loans AS (
        SELECT l.id
        FROM loans l
        ${where}
        ORDER BY l.created_at DESC
        LIMIT $1 OFFSET $2
      )
      SELECT l.*, u.firstName AS user_firstname, u.lastName AS user_lastname, a.accountNumber, p.name AS product_name
      FROM loans l
      JOIN paged_loans pl ON l.id = pl.id
      JOIN users u ON l.user_id = u.id
      JOIN accounts a ON l.account_id = a.id
      JOIN loan_products p ON l.product_id = p.id
      ORDER BY l.created_at DESC
    `;

    const rows = await client.query(query, pageParams).then(r => r.rows);

    res.json({ total, loans: rows });
  } catch (err) {
    console.error('Erreur dans getAllLoans:', err);
    res.status(500).send({ error: 'Erreur serveur' });
  } finally {
    client.release();
  }
};

exports.verifyUserKYC = async (req, res, next) => {
  try {
    const userId = req.params.id;
    await db.query(`UPDATE users SET kyc_verified = true WHERE id = $1`, [userId]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
};

exports.getAllUsers = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT id, email, firstname, lastname, phone, kyc_verified, role, is_approved
      FROM users
      WHERE id != '2093bb0f-f5ec-4792-bd3c-3823a21bf862' 
        AND email != 'admin@microfinance.test'
    `);

    // ⚡ Convertit kyc_verified et is_approved en booléens
    const users = rows.map(u => ({
      ...u,
      kyc_verified: !!u.kyc_verified,
      is_approved: !!u.is_approved
    }));

    res.json(users);
  } catch (err) {
    next(err);
  }
};


exports.getStats = async (req, res, next) => {
  try {
    const [users, loans, late] = await Promise.all([
      db.query(`SELECT COUNT(*) FROM users`),
      db.query(`SELECT COUNT(*) FROM loans`),
      db.query(`SELECT COUNT(*) FROM loan_installments WHERE status = 'late'`)
    ]);

    res.json({
      totalUsers: parseInt(users.rows[0].count),
      totalLoans: parseInt(loans.rows[0].count),
      latePayments: parseInt(late.rows[0].count)
    });
  } catch (err) {
    next(err);
  }
};

exports.getLoanProducts = async (req, res, next) => {
  try {
    const { rows } = await db.query('SELECT * FROM loan_products ORDER BY name');
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.getPendingLoans = async (req, res, next) => {
  try {
    const { rows } = await db.query(`
      SELECT l.*, u.firstname AS user_firstname, u.lastname AS user_lastname
      FROM loans l
      JOIN users u ON u.id = l.user_id
      WHERE l.status = 'pending'
      ORDER BY l.created_at DESC
    `);
    res.json(rows);
  } catch (err) {
    next(err);
  }
};

exports.approveLoan = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await db.query(`UPDATE loans SET status = 'approved' WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.rejectLoan = async (req, res, next) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await db.query(`UPDATE loans SET status = 'rejected' WHERE id = $1`, [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
};

exports.createAdmin = async (req, res) => {
  try {
    const { firstName, lastName, email, phone, password, role } = req.body;

    const allowedRoles = [
      'admin', 'loan_officer', 'account_manager',
      'support', 'auditor', 'compliance', 'user'
    ];

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({ message: "Rôle invalide" });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      phone,
      password,
      confirmPassword: password,
      role,
      isSystemCreated: true 
    });

    res.status(201).json({ message: 'Utilisateur créé', userId: user.id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Erreur lors de la création de l'utilisateur" });
  }
};

exports.updateUserRole = async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;

  const allowedRoles = ['user', 'admin', 'loan_officer', 'account_manager', 'support', 'auditor', 'compliance'];

  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Rôle invalide' });
  }

  // ⚠️ Empêcher de modifier son propre rôle
  if (userId === req.user.id) {
    return res.status(403).json({ error: "Vous ne pouvez pas modifier votre propre rôle" });
  }

  try {
    // 🔒 Vérifier si l'utilisateur ciblé est super_admin
    const check = await db.query(`SELECT role FROM users WHERE id = $1`, [userId]);
    if (check.rows[0]?.role === 'super_admin') {
      return res.status(403).json({ error: "Impossible de modifier le rôle d’un super administrateur" });
    }

    const { rows } = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, role',
      [role, userId]
    );
    res.json({ message: `Rôle mis à jour`, user: rows[0] });
  } catch (err) {
    console.error('Erreur updateUserRole:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.deleteUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const { rows } = await db.query(`SELECT role FROM users WHERE id = $1`, [userId]);

    if (!rows.length) {
      return res.status(404).json({ error: "Utilisateur non trouvé" });
    }

    const role = rows[0].role;

    if (role === 'super_admin') {
      return res.status(403).json({ error: "Impossible de supprimer un super administrateur" });
    }

    await db.query(`DELETE FROM users WHERE id = $1`, [userId]);
    res.json({ message: "Utilisateur supprimé avec succès" });
  } catch (err) {
    console.error('❌ Erreur suppression utilisateur :', err);
    res.status(500).json({ error: "Erreur lors de la suppression de l'utilisateur" });
  }
};

exports.approveUserAccount = async (req, res) => {
  const userId = req.params.id;

  try {
    // Récupérer l'utilisateur
    const { rows } = await db.query(
      `SELECT * FROM users WHERE id = $1`,
      [userId]
    );

    if (!rows.length) return res.status(404).json({ error: "Utilisateur introuvable" });

    let user = rows[0];

    // Mettre à jour seulement si ce n'est pas encore approuvé
    if (!user.is_approved) {
      const { rows: updatedRows } = await db.query(
        `UPDATE users SET is_approved = true WHERE id = $1 RETURNING *`,
        [userId]
      );
      user = updatedRows[0];

      // Envoi email seulement si nouvellement approuvé
      await mailer.sendGenericNotification(
        user.email,
        "Votre compte est maintenant actif",
        `<div style="max-width:600px;margin:0 auto;font-family:Arial,sans-serif;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;">
           <div style="background:#004080;color:white;padding:20px;text-align:center;">
             <h1 style="margin:0;font-size:24px;">microBank</h1>
           </div>
           <div style="padding:30px;">
             <p style="font-size:16px;">Bonjour ${user.firstname},</p>
             <p style="font-size:15px;line-height:1.6;">
               🎉 Votre compte a été validé par un gestionnaire.<br>
               Vous pouvez désormais accéder à tous nos services bancaires en ligne.
             </p>
             <div style="margin:30px 0;text-align:center;">
               <a href="http://localhost:4200/login"
                 style="background:#007bff;color:#fff;text-decoration:none;padding:12px 25px;font-size:16px;border-radius:5px;display:inline-block;">
                 Se connecter à mon compte
               </a>
             </div>
           </div>
         </div>`
      );
    }

    // Renvoi toujours de l'utilisateur mis à jour
    res.json({ user, message: "Compte validé avec succès." });
  } catch (err) {
    console.error("❌ Erreur approveUserAccount:", err);
    res.status(500).json({ error: "Erreur serveur lors de la validation du compte." });
  }
};


exports.getPendingUsers = async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT id, firstname, lastname, email, created_at
      FROM users
      WHERE is_approved = false
      ORDER BY created_at DESC
    `);

    res.json(rows);
  } catch (err) {
    console.error("❌ Erreur getPendingUsers:", err);
    res.status(500).json({ error: "Erreur serveur lors de la récupération des comptes en attente." });
  }
};

exports.activateLoan = async (req, res) => {
  const loanId = req.params.id;
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // 1. Récupérer les infos du prêt
    const loanRes = await client.query(`
      SELECT l.*, u.email, u.firstname, a.id AS account_id, a.balance
      FROM loans l
      JOIN users u ON u.id = l.user_id
      JOIN accounts a ON a.id = l.account_id
      WHERE l.id = $1
    `, [loanId]);

    if (loanRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: "Prêt non trouvé" });
    }

    const loan = loanRes.rows[0];
    const now = new Date();
    const disbursementDate = loan.disbursement_date || now;

    // 2. Mettre à jour le prêt : actif, date de décaissement et activation
    await client.query(`
      UPDATE loans 
      SET status = 'active',
          activated_at = $1,
          disbursement_date = COALESCE(disbursement_date, $1),
          start_date = COALESCE(start_date, $1),
          end_date = $2
      WHERE id = $3
    `, [
      now,
      new Date(disbursementDate.getFullYear(), disbursementDate.getMonth() + loan.term_months, disbursementDate.getDate()),
      loanId
    ]);

    // 3. Créditer le compte du client (décaissement)
    const newBalance = parseFloat(loan.balance) + parseFloat(loan.amount);
    await client.query(`
      UPDATE accounts
      SET balance = $1
      WHERE id = $2
    `, [newBalance, loan.account_id]);

    // 4. Enregistrer la transaction
    const transactionRes = await client.query(`
      INSERT INTO transactions (user_id, account_id, amount, type, status, description, reference, balance_after, created_at)
      VALUES ($1, $2, $3, 'loan_disbursement', 'completed', $4, $5, $6, $7)
      RETURNING id
    `, [
      loan.user_id,
      loan.account_id,
      loan.amount,
      `Décaissement du prêt de ${loan.amount} XOF`,
      `LOAN-${loanId}`,
      newBalance,
      now
    ]);
    const transactionId = transactionRes.rows[0].id;

    // 5. Calcul et génération des échéances
    const totalInterest = (loan.amount * loan.interest_rate / 100);
    const totalRepayable = loan.amount + totalInterest;
    const monthlyPayment = parseFloat((totalRepayable / loan.term_months).toFixed(2));
    await client.query(`UPDATE loans SET monthly_payment = $1 WHERE id = $2`, [monthlyPayment, loanId]);

    const installments = [];
    for (let i = 1; i <= loan.term_months; i++) {
      const dueDate = new Date(disbursementDate);
      dueDate.setMonth(dueDate.getMonth() + i);

      const principal = parseFloat((loan.amount / loan.term_months).toFixed(2));
      const interest = parseFloat((totalInterest / loan.term_months).toFixed(2));

      installments.push(client.query(`
        INSERT INTO loan_installments (loan_id, due_date, amount, principal_amount, interest_amount)
        VALUES ($1, $2, $3, $4, $5)
      `, [loanId, dueDate, principal + interest, principal, interest]));
    }

    await Promise.all(installments);

    // 6. Envoyer un email de confirmation
    await mailer.sendGenericNotification(
      loan.email,
      "🎉 Votre prêt a été activé !",
      `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; padding: 30px;">
        <h2 style="color: #004080;">Bonjour ${loan.firstname},</h2>
        <p>
          Félicitations ! Votre demande de prêt a été approuvée et activée avec succès.
        </p>
        <ul>
          <li><strong>Montant :</strong> ${loan.amount} XOF</li>
          <li><strong>Durée :</strong> ${loan.term_months} mois</li>
          <li><strong>Taux d’intérêt :</strong> ${loan.interest_rate}%</li>
          <li><strong>Échéance mensuelle :</strong> ${monthlyPayment} XOF</li>
        </ul>
        <p>Vous pouvez consulter les détails de votre prêt dans votre espace personnel.</p>
        <p style="margin-top: 40px;">Merci d’avoir choisi <strong>microBank</strong>.</p>
      </div>
      `
    );

    await client.query('COMMIT');
    res.json({ success: true, message: "Prêt activé avec succès." });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error("❌ Erreur activation prêt:", err);
    res.status(500).json({ error: "Erreur lors de l'activation du prêt." });
  } finally {
    client.release();
  }
};

