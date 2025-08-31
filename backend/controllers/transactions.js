const Transaction = require('../models/Transaction');
const User = require('../models/User');
const db = require('../config/db');
const bcrypt = require('bcrypt');
const NotificationService = require('../services/notification');
const mailer = require('../utils/mailer');
const PaygateService = require('../services/paygate-service');
const StripeService = require('../services/stripe-service');
const { v4: uuidv4 } = require('uuid');
const ExternalApiService = require('../services/external-api-service');
const BillPaymentService = require('../services/billPayment'); // <-- Service mis à jour
const Bill = require('../models/Bills');

// Mapping type frontend → type SQL
const typeMap = {
  deposit_mobile: 'deposit',
  deposit_card: 'deposit',
  deposit_manual: 'deposit',
  deposit_wire: 'deposit',
  withdrawal_mobile: 'withdrawal',
  withdrawal_card: 'withdrawal',
  withdrawal_atm: 'withdrawal',
  transfer: 'transfer',
  bill_payment: 'bill_payment',
  purchase: 'purchase'
};

// Fonction générique de transaction atomique pour dépôts, retraits, achats
async function performTransactionWithBalanceUpdate({ account, type, amount, description, metadata }) {
  if (!account) throw new Error('Compte introuvable');
  if (amount <= 0) throw new Error('Le montant doit être supérieur à zéro');

  const debitTypes = ['withdrawal', 'purchase'];
  const creditTypes = ['deposit'];
  const transferTypes = ['transfer'];

  let newBalance = account.balance;

  if (debitTypes.includes(type)) {
    if (amount > account.balance) throw new Error('Solde insuffisant');
    newBalance = account.balance - amount;
  } else if (creditTypes.includes(type)) {
    newBalance = account.balance + amount;
  } else if (transferTypes.includes(type)) {
    newBalance = account.balance; // ajustement ailleurs
  } else {
    newBalance = account.balance;
  }

  const transaction = await Transaction.create({
    account: account._id,
    type,
    amount,
    description,
    metadata,
    balanceBefore: account.balance,
    balanceAfter: newBalance,
    status: 'completed',
  });

  account.balance = newBalance;
  await account.save();

  return transaction;
}

// ======================
// Solde du compte
// ======================
exports.getAccountBalance = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT balance FROM accounts WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Compte introuvable' });
    res.json({ balance: parseFloat(rows[0].balance) });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Transactions
// ======================
exports.getRecentTransactions = async (req, res) => {
  try {
    const transactions = await Transaction.findByUser(req.user.id, 5);
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Récupérer une transaction précise
 */
exports.getTransactionById = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rows.length) return res.status(404).json({ message: 'Transaction introuvable' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

/**
 * Récupérer toutes les transactions d’un utilisateur
 */
exports.getAllTransactions = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ======================
// Création transaction hors paiement facture
// ======================
exports.createTransaction = async (req, res) => {
  const client = await db.connect();
  try {
    let { accountId, amount, type, channel, description, reference, metadata } = req.body;

    // Récupérer le compte principal si accountId absent
    let currentBalance;
    if (!accountId) {
      const accountRes = await client.query(
        'SELECT id, balance FROM accounts WHERE user_id = $1 LIMIT 1',
        [req.user.id]
      );
      if (!accountRes.rows.length) return res.status(400).json({ message: 'Compte principal introuvable' });
      accountId = accountRes.rows[0].id;
      currentBalance = parseFloat(accountRes.rows[0].balance);
    } else {
      const accountRes = await client.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
      if (!accountRes.rows.length) return res.status(400).json({ message: 'Compte introuvable' });
      currentBalance = parseFloat(accountRes.rows[0].balance);
    }

    // Vérification solde pour types débit
    const debitTypes = ['withdrawal', 'purchase', 'bill_payment', 'transfer'];
    if (debitTypes.includes(type) && amount > currentBalance) {
      return res.status(400).json({ message: `Solde insuffisant. Votre solde est ${currentBalance} FCFA` });
    }

    // Calcul nouveau solde
    let newBalance = currentBalance;
    if (debitTypes.includes(type)) newBalance -= amount;
    else if (type.startsWith('deposit')) newBalance += amount;

    // Création transaction
    const transactionId = uuidv4();
    await client.query(
      `INSERT INTO transactions
       (id, user_id, account_id, type, amount, description, reference, metadata, status, balance_after)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'completed',$9)`,
      [transactionId, req.user.id, accountId, type, amount, description || null, reference || null, JSON.stringify(metadata || {}), newBalance]
    );

    // Mise à jour du solde du compte
    await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, accountId]);

    res.status(201).json({ message: 'Transaction réussie', transactionId, newBalance });

  } catch (err) {
    console.error('[TransactionController] createTransaction:', err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// ======================
// Paiement facture (multi-fournisseurs, dev/sandbox intégré)
// ======================
exports.payBill = async (req, res) => {
  try {
    const { accountId, amount, billId, billReference, paymentMethod, metadata, phone, email } = req.body;

    // -- Détection automatique du fournisseur pour dev/test
    let providerType = (metadata?.type || metadata?.provider || '').toLowerCase();
    if (!['electricity', 'water', 'canal_plus'].includes(providerType)) {
      providerType = 'electricity'; // default pour dev
    }
    metadata = { ...metadata, provider: providerType };

    const result = await BillPaymentService.pay({
      userId: req.user.id,
      accountId,
      amount,
      billId,
      billReference,
      paymentMethod,
      metadata,
      phone,
      email
    });

    res.status(201).json({
      message: `Paiement effectué avec succès via ${providerType}`,
      bill: result.bill,
      newBalance: result.newBalance
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// -----------------------------
// Création retrait ATM
// -----------------------------
exports.createATMWithdrawal = async (req, res) => {
  const client = await db.connect();
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ message: 'Montant invalide' });

    // Récupérer le compte principal
    const accountRes = await client.query(
      'SELECT id, balance FROM accounts WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    if (!accountRes.rows.length) return res.status(400).json({ message: 'Compte introuvable' });

    const accountId = accountRes.rows[0].id;
    const currentBalance = parseFloat(accountRes.rows[0].balance);

    if (amount > currentBalance) return res.status(400).json({ message: `Solde insuffisant. Votre solde est ${currentBalance} FCFA` });

    const transactionId = uuidv4();

    // Créer d'abord la transaction "pending"
    await client.query(
      `INSERT INTO transactions
        (id, user_id, account_id, type, amount, status, balance_after)
       VALUES ($1,$2,$3,'withdrawal',$4,'pending',$5)`,
      [transactionId, req.user.id, accountId, amount, currentBalance]
    );

    // Générer code temporaire 6 chiffres
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    // Créer l’enregistrement ATM withdrawal
    const atmWithdrawalId = uuidv4();
    await client.query(
      `INSERT INTO atm_withdrawals
        (id, transaction_id, user_id, account_id, code_hash, amount, expires_at, status, attempt_count, max_attempts)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'pending',0,3)`,
      [atmWithdrawalId, transactionId, req.user.id, accountId, codeHash, amount, expiresAt]
    );

    // Envoyer notification
    await NotificationService.create(
      req.user.id,
      'withdrawal',
      `💳 Votre code de retrait ATM est ${code}. Il expire à ${expiresAt.toLocaleTimeString()}.`,
      { transactionId, amount, expiresAt }
    );

    res.status(201).json({ 
      message: 'Code de retrait ATM généré et envoyé', 
      transactionId,
      atmWithdrawalId // <-- ID correct pour validation
    });

  } catch (err) {
    console.error('❌ createATMWithdrawal error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// -----------------------------
// Validation du code ATM
// -----------------------------
exports.validateATMCode = async (req, res) => {
  const client = await db.connect();
  try {
    const { atmWithdrawalId, code } = req.body;
    if (!atmWithdrawalId || !code) return res.status(400).json({ message: 'ID et code obligatoires' });

    // Récupérer l’enregistrement ATM withdrawal
    const { rows } = await client.query(
      'SELECT * FROM atm_withdrawals WHERE id = $1 AND status = $2',
      [atmWithdrawalId, 'pending']
    );
    if (!rows.length) return res.status(404).json({ message: 'Transaction introuvable ou déjà utilisée' });

    const atmTx = rows[0];

    // Vérifier expiration
    if (new Date() > new Date(atmTx.expires_at)) {
      await client.query('UPDATE atm_withdrawals SET status = $1 WHERE id = $2', ['expired', atmWithdrawalId]);
      await client.query('UPDATE transactions SET status = $1 WHERE id = $2', ['failed', atmTx.transaction_id]);
      return res.status(400).json({ message: 'Code ATM expiré' });
    }

    // Limiter les tentatives
    if (atmTx.attempt_count >= atmTx.max_attempts) {
      await client.query('UPDATE atm_withdrawals SET status = $1 WHERE id = $2', ['failed', atmWithdrawalId]);
      await client.query('UPDATE transactions SET status = $1 WHERE id = $2', ['failed', atmTx.transaction_id]);
      return res.status(403).json({ message: 'Nombre maximal de tentatives atteint' });
    }

    // Vérifier code
    const isValid = await bcrypt.compare(code, atmTx.code_hash);

    // Journaliser tentative
    await client.query(
      `INSERT INTO atm_withdrawal_attempts
        (atm_withdrawal_id, attempted_code, is_valid)
       VALUES ($1,$2,$3)`,
      [atmWithdrawalId, code, isValid]
    );

    if (!isValid) {
      await client.query(
        'UPDATE atm_withdrawals SET attempt_count = attempt_count + 1 WHERE id = $1',
        [atmWithdrawalId]
      );
      return res.status(400).json({ message: 'Code ATM invalide' });
    }

    // Débiter compte
    const accountRes = await client.query('SELECT balance FROM accounts WHERE id = $1', [atmTx.account_id]);
    if (!accountRes.rows.length) return res.status(404).json({ message: 'Compte introuvable' });

    const currentBalance = parseFloat(accountRes.rows[0].balance);
    if (atmTx.amount > currentBalance) return res.status(400).json({ message: 'Solde insuffisant' });

    const newBalance = currentBalance - parseFloat(atmTx.amount);

    // Mettre à jour compte, ATM et transaction
    await client.query('UPDATE accounts SET balance = $1 WHERE id = $2', [newBalance, atmTx.account_id]);
    await client.query(
      'UPDATE atm_withdrawals SET status = $1, used_at = NOW() WHERE id = $2',
      ['completed', atmWithdrawalId]
    );
    await client.query(
      'UPDATE transactions SET status = $1, balance_after = $2 WHERE id = $3',
      ['completed', newBalance, atmTx.transaction_id]
    );

    res.json({ message: 'Retrait ATM effectué avec succès', newBalance });

  } catch (err) {
    console.error('❌ validateATMCode error:', err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
};

// ======================
// Alias pour routes classiques
// ======================
exports.mobileMoneyDeposit = async (req, res) => exports.createTransaction(req, res);
exports.cardDeposit = async (req, res) => exports.createTransaction(req, res);
exports.stripeCardDeposit = async (req, res) => exports.createTransaction(req, res);
exports.requestWithdrawal = async (req, res) => exports.createTransaction(req, res);
exports.receiveExternalWire = async (req, res) => res.status(200).json({ message: 'Virement externe reçu' });