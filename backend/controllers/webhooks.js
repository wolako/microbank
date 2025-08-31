// controllers/webhook.js
const crypto = require('crypto');
const db = require('../config/db');
const Loan = require('../models/loan');
const User = require('../models/User');
const Bill = require('../models/Bills');
const smsService = require('../services/sms');
const notificationService = require('../services/notification');
const PaygateService = require('../services/paygate-service');

// ---------------------------
// Webhook Loan / Paiement direct
// ---------------------------
exports.paymentCallback = async (req, res) => {
  const signature = req.headers['x-payment-signature'];
  const payload = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) return res.status(401).send('Signature invalide');

  try {
    const { loan_id, amount, status } = req.body;
    if (!loan_id || !amount || !status) return res.status(400).send('Données manquantes');

    if (status === 'completed') {
      await Loan.processPayment(loan_id, amount);

      const loan = await Loan.findById(loan_id);
      const user = await User.findById(loan.user_id);

      await notificationService.sendPaymentConfirmation(loan_id);
      await smsService.sendPaymentConfirmation(user.phone, amount, loan_id);
    }

    res.status(200).send('Webhook reçu');
  } catch (err) {
    console.error('❌ Erreur Payment Webhook:', err);
    res.status(500).send('Erreur de traitement');
  }
};

// ---------------------------
// Webhook PayGate (Mobile Money)
// ---------------------------
exports.paygateCallback = async (req, res) => {
  const { identifier, status, phone, amount, metadata, checksum } = req.body;

  if (!identifier || !status || !phone || !amount || !checksum) {
    return res.status(400).send('Données manquantes');
  }

  const valid = PaygateService.verifyCallbackSignature({ reference: identifier, amount, checksum });
  if (!valid) return res.status(401).send('Signature invalide');

  try {
    const { rows } = await db.query(
      'SELECT * FROM transactions WHERE id=$1 AND status=$2 LIMIT 1',
      [identifier, 'pending']
    );
    if (!rows.length) return res.status(404).send('Transaction introuvable ou déjà traitée');

    const tx = rows[0];

    if (status === 'SUCCESS') {
      const { rows: accountRows } = await db.query(
        'SELECT balance FROM accounts WHERE id=$1 LIMIT 1',
        [tx.account_id]
      );
      if (!accountRows.length) throw new Error('Compte introuvable');

      const newBalance = parseFloat(accountRows[0].balance) + parseFloat(amount);

      await db.query('UPDATE accounts SET balance=$1 WHERE id=$2', [newBalance, tx.account_id]);
      await db.query('UPDATE transactions SET status=$1, balance_after=$2 WHERE id=$3', ['completed', newBalance, identifier]);

      await notificationService.create(tx.user_id, 'deposit', `Dépôt Mobile Money de ${amount} XOF confirmé.`, { amount, phone });
      await smsService.sendDepositConfirmation(phone, amount);
    } else {
      await db.query('UPDATE transactions SET status=$1 WHERE id=$2', ['failed', identifier]);
      console.log(`Transaction PayGate ${identifier} échouée`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error('❌ Erreur PayGate Webhook:', err);
    res.status(500).send('Erreur interne');
  }
};

// ---------------------------
// Webhook Stripe
// ---------------------------
exports.stripeWebhook = async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('⚠️ Webhook Stripe signature invalide:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const amount = parseFloat(session.metadata.amount);

    try {
      const { rows } = await db.query('SELECT id, balance FROM accounts WHERE user_id=$1 LIMIT 1', [userId]);
      if (!rows.length) throw new Error('Compte utilisateur introuvable');

      const account = rows[0];
      const newBalance = parseFloat(account.balance) + amount;

      await db.query('UPDATE accounts SET balance=$1 WHERE id=$2', [newBalance, account.id]);
      await db.query(
        `INSERT INTO transactions (id, user_id, account_id, amount, type, channel, description, status, balance_after, metadata, created_at)
         VALUES ($1,$2,$3,$4,'deposit_card','stripe','Dépôt via Stripe','completed',$5,$6,NOW())`,
        [session.id, userId, account.id, amount, newBalance, JSON.stringify({ sessionId: session.id })]
      );

      await notificationService.create(userId, 'deposit', `Dépôt via Stripe de ${amount} XOF confirmé.`, { amount });
    } catch (err) {
      console.error('❌ Stripe webhook processing error:', err);
      return res.status(500).send('Erreur interne Stripe');
    }
  }

  res.json({ received: true });
};

// ---------------------------
// Webhook Bill Payment unifié
// ---------------------------
exports.billPaymentCallback = async (req, res) => {
  const signature = req.headers['x-payment-signature'];
  const payload = JSON.stringify(req.body);

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(payload)
    .digest('hex');

  if (signature !== expectedSignature) return res.status(401).send('Signature invalide');

  try {
    const { bill_id, amount, status } = req.body;
    if (!bill_id || !amount || !status) return res.status(400).send('Données manquantes');

    // --- 1. Récupérer la facture
    const bill = await Bill.findById(bill_id);
    if (!bill) return res.status(404).send('Facture introuvable');

    if (status === 'completed' && bill.status !== 'paid') {
      // --- 2. Mettre à jour solde et transaction via PaymentService
      await PaymentService.confirmBillPayment({
        billId: bill_id,
        userId: bill.user_id,
        amount,
        billReference: bill.bill_reference,
        billType: bill.bill_type
      });

      // --- 3. Notifications
      const user = await User.findById(bill.user_id);
      await notificationService.sendBillPaymentConfirmation(bill_id);
      await smsService.sendBillPaymentConfirmation(user.phone, amount, bill.bill_type);
    }

    res.status(200).send('Webhook reçu');
  } catch (err) {
    console.error('❌ Erreur Bill Payment Webhook:', err);
    res.status(500).send('Erreur interne');
  }
};

