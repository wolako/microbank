// services/billPayment.js
const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const ExternalAPIService = require('./external-api-service');
const NotificationService = require('./notification');
const SMSService = require('./sms');

class BillPaymentService {

  /**
   * Payer une facture (débit compte + paiement fournisseur)
   */
  static async pay({ userId, accountId, amount, billId, billReference, paymentMethod, metadata, phone, email }) {
    const client = await db.connect();

    try {
      await client.query('BEGIN');

      // --- Vérifier solde et bloquer ligne
      const { rows: accounts } = await client.query(
        `SELECT balance FROM accounts WHERE id=$1 FOR UPDATE`,
        [accountId]
      );
      if (!accounts.length) throw new Error('Compte introuvable');

      const currentBalance = parseFloat(accounts[0].balance);
      if (currentBalance < amount) throw new Error('Solde insuffisant');

      const newBalance = currentBalance - amount;

      // --- Débit du compte
      await client.query(
        `UPDATE accounts SET balance=$1, updated_at=NOW() WHERE id=$2`,
        [newBalance, accountId]
      );

      // --- Détecter automatiquement le fournisseur
      let providerType = (metadata?.provider || metadata?.type || '').toLowerCase();
      if (['ceet', 'electricity'].includes(providerType)) {
        providerType = 'CEET';
      } else if (['soneb', 'water'].includes(providerType)) {
        providerType = 'SONEB';
      } else if (['canal', 'canal_plus', 'canalbox'].includes(providerType)) {
        providerType = 'CANAL';
      } else {
        providerType = 'UNKNOWN';
      }

      // --- Paiement simulé en dev
      let apiResponse;
      if (process.env.NODE_ENV !== 'production') {
        console.log(`[DEV] Paiement simulé pour ${providerType} ref=${billReference}, montant=${amount}`);
        apiResponse = { success: true, data: { transactionId: 'TEST-' + Date.now() } };
      } else {
        // --- Paiement réel via API fournisseur
        apiResponse = await ExternalAPIService.payBill({
          type: providerType,
          reference: billReference,
          amount,
          paymentMethod
        });
      }

      if (!apiResponse.success) {
        await client.query('ROLLBACK');
        throw new Error('Paiement refusé par le fournisseur : ' + (apiResponse.error || 'inconnu'));
      }

      // --- Marquer facture payée / créer ou update
      await client.query(
        `INSERT INTO bills (id, user_id, account_id, type, provider, amount, reference, status, metadata, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'paid',$8,NOW(),NOW())
         ON CONFLICT (id) DO UPDATE SET status='paid', updated_at=NOW()`,
        [billId, userId, accountId, providerType, providerType, amount, billReference, metadata || {}]
      );

      // --- Créer transaction
      const transactionId = uuidv4();
      await client.query(
        `INSERT INTO transactions
          (id, user_id, account_id, type, amount, description, reference, balance_before, balance_after, status, created_at)
         VALUES ($1,$2,$3,'bill_payment',$4,$5,$6,$7,$8,'completed',NOW())`,
        [transactionId, userId, accountId, amount, `Paiement facture ${billReference} (${providerType})`, billReference, currentBalance, newBalance]
      );

      await client.query('COMMIT');

      // --- Notifications
      await NotificationService.create(
        userId,
        'bill_payment',
        `Paiement de ${amount} XOF pour la facture ${billReference} effectué via ${providerType}`,
        { billId }
      );

      if (phone) await SMSService.sendPaymentConfirmation(phone, amount, billReference);

      if (email) {
        await NotificationService.sendEmail(
          email,
          `Paiement facture ${billReference} confirmé`,
          `<p>Votre paiement de <strong>${amount} XOF</strong> pour la facture <strong>${billReference}</strong> a été effectué via <strong>${providerType}</strong>.</p>`
        );
      }

      return {
        bill: {
          id: billId,
          status: 'paid',
          amount,
          reference: billReference,
          provider: providerType
        },
        newBalance
      };

    } catch (err) {
      await client.query('ROLLBACK');
      console.error('❌ BillPaymentService error:', err.message);
      throw err;
    } finally {
      client.release();
    }
  }

}

module.exports = BillPaymentService;
