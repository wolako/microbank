const db = require('../config/db');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const NotificationService = require('../services/notification');
const mailer = require('../utils/mailer');

exports.payBill = async (req, res) => {
  const { amount, billType, billReference, paymentMethod, metadata } = req.body;
  const userId = req.user.id;

  if (!amount || !billType || !billReference || !paymentMethod) {
    return res.status(400).json({ error: 'Champs requis manquants' });
  }

  try {
    // Récupérer compte utilisateur
    const { rows: accounts } = await db.query(
      'SELECT id, balance FROM accounts WHERE user_id = $1 LIMIT 1',
      [userId]
    );

    if (accounts.length === 0) {
      return res.status(404).json({ error: 'Compte utilisateur introuvable' });
    }

    const account = accounts[0];
    const currentBalance = parseFloat(account.balance);

    if (currentBalance < amount) {
      return res.status(400).json({ error: 'Solde insuffisant' });
    }

    // Appeler API fournisseur (exemple simulé)
    const response = await axios.post('https://api.fournisseur-de-paiement.com/pay', {
      amount,
      reference: billReference,
      provider: metadata?.provider || billType,
      paymentMethod,
      metadata
    });

    if (response.data.status !== 'success') {
      return res.status(400).json({ error: 'Paiement refusé par le fournisseur' });
    }

    // Générer un UUID pour la facture
    const billId = uuidv4();

    // Insérer facture dans la table bills avec status 'paid'
    const insertBillQuery = `
      INSERT INTO bills (id, user_id, account_id, type, provider, amount, reference, status, metadata, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'paid', $8, NOW(), NOW())
      RETURNING *
    `;

    const { rows: billRows } = await db.query(insertBillQuery, [
      billId,
      userId,
      account.id,
      billType,
      metadata?.provider || billType,
      amount,
      billReference,
      metadata || {}
    ]);

    // Mettre à jour le solde du compte
    const newBalance = currentBalance - amount;
    await db.query('UPDATE accounts SET balance = $1, updated_at = NOW() WHERE id = $2', [newBalance, account.id]);

    // Enregistrer une transaction liée à ce paiement (optionnel mais recommandé)
    await db.query(
      `INSERT INTO transactions (user_id, account_id, amount, type, status, description, reference, balance_after, created_at)
       VALUES ($1, $2, $3, 'bill_payment', 'completed', $4, $5, $6, NOW())`,
      [userId, account.id, amount, `Paiement facture ${billType}`, billReference, newBalance]
    );

    // Notifications (in-app + email)
    await NotificationService.create(
      userId,
      'bill_payment',
      `Votre paiement de ${amount} XOF pour la facture ${billType} a été effectué avec succès.`,
      { billId }
    );

    await mailer.send({
      to: req.user.email,
      subject: `Paiement facture ${billType} confirmé`,
      html: `<p>Bonjour,</p><p>Votre paiement de <strong>${amount} XOF</strong> pour la facture <strong>${billType}</strong> (réf: ${billReference}) a été effectué avec succès.</p><p>Merci pour votre confiance.</p>`
    });

    return res.status(201).json({ message: 'Paiement effectué avec succès', bill: billRows[0], newBalance });
  } catch (error) {
    console.error('Erreur lors du paiement de la facture:', error);
    return res.status(500).json({ error: 'Erreur interne lors du paiement de la facture' });
  }
};
