const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const Bull = require('bull');
const NotificationService = require('./notification');
const SMSService = require('./sms');

const paymentQueue = new Bull('payment-queue', {
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  }
});

class PaymentService {
  static async processLoanPayment(paymentData) {
    const client = await db.connect();
    try {
      console.log(`[PaymentService] START payment - loanId=${paymentData.loanId}, amount=${paymentData.amount}`);

      await client.query('BEGIN');
      console.log(`[PaymentService] SQL Transaction BEGIN`);

      // 1. Récupération du prêt
      const { rows: loans } = await client.query(
        `SELECT id, account_id, amount, paid_amount, next_payment_date, created_at
         FROM loans WHERE id = $1 FOR UPDATE`,
        [paymentData.loanId]
      );
      if (loans.length === 0) throw new Error('Prêt introuvable');
      const loan = loans[0];
      console.log(`[PaymentService] Loan fetched`, loan);

      // 2. Vérification du solde du compte
      const { rows: accounts } = await client.query(
        `SELECT balance FROM accounts WHERE id = $1 FOR UPDATE`,
        [loan.account_id]
      );
      if (accounts.length === 0) throw new Error('Compte bancaire introuvable');
      const currentBalance = parseFloat(accounts[0].balance);
      console.log(`[PaymentService] Account balance=${currentBalance}`);

      if (currentBalance < paymentData.amount) {
        throw new Error('Solde insuffisant pour effectuer le paiement');
      }

      // 3. Débit du compte
      await client.query(
        `UPDATE accounts SET balance = balance - $1 WHERE id = $2`,
        [paymentData.amount, loan.account_id]
      );
      console.log(`[PaymentService] Account debited: ${paymentData.amount}`);

      const paymentId = uuidv4();
      const transactionId = uuidv4();

      // 4. Création de la transaction
      await client.query(
        `INSERT INTO transactions (
          id, user_id, account_id, amount, type, status, description, reference, metadata
        ) VALUES ($1,$2,$3,$4,'loan_payment','completed',$5,$6,$7)`,
        [
          transactionId,
          paymentData.userId,
          loan.account_id,
          paymentData.amount,
          `Paiement du prêt ${paymentData.loanId}`,
          paymentData.reference,
          JSON.stringify({ isRecurring: paymentData.isRecurring })
        ]
      );
      console.log(`[PaymentService] Transaction created: transactionId=${transactionId}, paymentId=${paymentId}`);

      // 5. Enregistrement du paiement
      await client.query(
        `INSERT INTO loan_payments (
          id, loan_id, transaction_id, amount, payment_method, reference, is_recurring
        ) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [
          paymentId,
          paymentData.loanId,
          transactionId,
          paymentData.amount,
          paymentData.method,
          paymentData.reference,
          paymentData.isRecurring || false
        ]
      );
      console.log(`[PaymentService] Loan payment recorded`);

      // 6. Mise à jour du prêt
      const newPaidAmount = (loan.paid_amount || 0) + paymentData.amount;
      await client.query(
        `UPDATE loans
         SET paid_amount = $1,
             next_payment_date = CASE WHEN $2 THEN COALESCE(next_payment_date, created_at) + INTERVAL '1 month' ELSE next_payment_date END
         WHERE id = $3`,
        [newPaidAmount, paymentData.isRecurring, paymentData.loanId]
      );
      console.log(`[PaymentService] Loan updated: paid_amount=${newPaidAmount}`);

      await client.query('COMMIT');
      console.log(`[PaymentService] SQL Transaction COMMIT`);

      // 7. Notifications
      try {
        console.log(`[PaymentService] Sending notification...`);
        await NotificationService.create(
          paymentData.userId,
          'payment_received',
          `Paiement de ${paymentData.amount} XOF reçu`,
          { loanId: paymentData.loanId }
        );
        console.log(`[PaymentService] Notification sent`);
      } catch (notifyErr) {
        console.error(`[PaymentService] Notification ERROR:`, notifyErr);
        // On continue quand même pour ne pas bloquer le paiement
      }

      try {
        console.log(`[PaymentService] Sending SMS...`);
        await SMSService.sendPaymentConfirmation(
          paymentData.phone,
          paymentData.amount,
          paymentData.loanId
        );
        console.log(`[PaymentService] SMS sent`);
      } catch (smsErr) {
        console.error(`[PaymentService] SMS ERROR:`, smsErr);
        // On continue quand même pour ne pas bloquer le paiement
      }

      console.log(`[PaymentService] Payment SUCCESS - loanId=${paymentData.loanId}`);
      return {
        success: true,
        transactionId,
        paymentId,
        newPaidAmount
      };

    } catch (err) {
      console.error(`[PaymentService] PAYMENT ERROR:`, err);
      await client.query('ROLLBACK');
      console.log(`[PaymentService] SQL Transaction ROLLBACK`);
      throw err;
    } finally {
      client.release();
      console.log(`[PaymentService] DB client released`);
    }
  }

  static async scheduleRecurringPayment(loanData) {
    await paymentQueue.add(
      {
        loanId: loanData.id,
        userId: loanData.user_id,
        amount: loanData.monthly_payment,
        phone: loanData.user_phone,
        isRecurring: true
      },
      {
        jobId: `recurring-${loanData.id}-${Date.now()}`,
        repeat: {
          cron: '0 9 1 * *',
          startDate: new Date(loanData.next_payment_date),
          endDate: new Date(loanData.end_date)
        },
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 }
      }
    );
  }

  static processRecurringPayments() {
    paymentQueue.process(async (job) => {
      const { loanId, amount, userId, phone } = job.data;
      try {
        console.log(`[PaymentService] Paiement automatique pour prêt ${loanId}`);
        return await this.processLoanPayment({
          loanId,
          amount,
          userId,
          phone,
          method: 'auto_debit',
          reference: `AUTO-${Date.now()}`,
          isRecurring: true
        });
      } catch (err) {
        console.error(`[PaymentService] Échec du paiement récurrent :`, err);
        throw err;
      }
    });

    paymentQueue.on('completed', (job) => {
      console.log(`[PaymentService] Paiement automatique terminé : jobId=${job.id}`);
    });

    paymentQueue.on('failed', (job, err) => {
      console.error(`[PaymentService] Échec du job ${job.id}:`, err.message);
      this.handleFailedPayment(job.data);
    });
  }

  static async handleFailedPayment(paymentData) {
    await db.query(
      `INSERT INTO transaction_attempts (
        loan_id, amount, attempt_date, status
      ) VALUES ($1, $2, $3, 'failed')`,
      [paymentData.loanId, paymentData.amount, new Date()]
    );

    await NotificationService.create(
      paymentData.userId,
      'payment_failed',
      'Échec du paiement automatique',
      { loanId: paymentData.loanId }
    );

    await SMSService.sendSMS(
      paymentData.phone,
      `ECHEC paiement ${paymentData.amount}XOF. Merci de régulariser.`
    );

    await db.query(
      `UPDATE loans SET status = 'overdue' 
       WHERE id = $1 AND status = 'active'`,
      [paymentData.loanId]
    );
  }
}

// Démarrer le traitement au lancement
PaymentService.processRecurringPayments();

module.exports = PaymentService;
