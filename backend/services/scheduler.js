const cron = require('node-cron');
const db = require('../config/db');
const Notification = require('../models/notification');
const SMSService = require('./sms');

async function checkLoanDueDates() {
  try {
    console.log('Vérification des échéances de prêt...');
    
    // Marquer les échéances passées comme en retard
    await markOverdueInstallments();

    const dueLoans = await db.query(
      `SELECT l.id, u.phone, u.firstName, u.id as user_id
       FROM loans l
       JOIN users u ON l.user_id = u.id
       WHERE l.status = 'active'
       AND l.next_payment_date <= CURRENT_DATE + INTERVAL '3 days'`
    );

    console.log(`${dueLoans.rowCount} prêts à échéance trouvés`);

    for (const loan of dueLoans.rows) {
      try {
        // Envoyer notification
        await Notification.create(
          loan.user_id,
          'loan_due',
          'Votre prochain paiement est dû dans 3 jours',
          { loanId: loan.id }
        );

        // Envoyer SMS
        await SMSService.sendSMS(
          loan.phone,
          `Cher ${loan.firstName}, votre paiement de prêt est dû dans 3 jours.`
        );

        console.log(`Notifications envoyées pour le prêt ${loan.id}`);
      } catch (err) {
        console.error(`Erreur lors du traitement du prêt ${loan.id}:`, err);
      }
    }
  } catch (err) {
    console.error('Erreur lors de la vérification des prêts:', err);
  }
}

async function markOverdueInstallments() {
  try {
    const res = await db.query(`
      UPDATE loan_installments
      SET status = 'overdue'
      WHERE due_date < CURRENT_DATE
      AND status = 'pending'
      RETURNING id, loan_id
    `);

    console.log(`${res.rowCount} échéances marquées comme en retard`);
  } catch (err) {
    console.error("Erreur lors du marquage des échéances en retard:", err);
  }
}

async function updateNextPaymentDates() {
  try {
    const res = await db.query(`
      UPDATE loans l
      SET next_payment_date = (
        SELECT MIN(i.due_date)
        FROM loan_installments i
        WHERE i.loan_id = l.id AND i.status = 'pending'
      )
      WHERE l.status = 'active'
    `);
    console.log('✅ Dates des prochains paiements mises à jour');
  } catch (err) {
    console.error('❌ Erreur lors de la mise à jour des next_payment_date:', err);
  }
}

async function processAutomaticLoanPayments() {
  try {
    const installments = await db.query(`
      SELECT 
        i.id AS installment_id,
        i.loan_id,
        i.amount,
        i.due_date,
        u.id AS user_id,
        u.phone,
        u.firstName,
        a.id AS account_id,
        a.balance
      FROM loan_installments i
      JOIN loans l ON i.loan_id = l.id
      JOIN users u ON l.user_id = u.id
      JOIN accounts a ON l.account_id = a.id
      WHERE i.status = 'pending' AND i.due_date = CURRENT_DATE
    `);

    console.log(`💰 Traitement de ${installments.rowCount} échéances dues aujourd’hui`);

    for (const item of installments.rows) {
      const {
        installment_id,
        loan_id,
        amount,
        user_id,
        account_id,
        balance,
        phone,
        firstName
      } = item;

      if (balance >= amount) {
        const client = await db.connect();
        try {
          await client.query('BEGIN');

          // 1. Déduire le montant
          const newBalance = balance - amount;
          await client.query(`
            UPDATE accounts SET balance = $1 WHERE id = $2
          `, [newBalance, account_id]);

          // 2. Marquer l’échéance comme payée
          await client.query(`
            UPDATE loan_installments
            SET status = 'paid', paid_date = CURRENT_TIMESTAMP
            WHERE id = $1
          `, [installment_id]);

          // 3. Créer la transaction
          const tx = await client.query(`
            INSERT INTO transactions (
              user_id, account_id, amount, type, status, description, balance_after
            ) VALUES ($1, $2, $3, 'loan_payment', 'completed', $4, $5)
            RETURNING id
          `, [user_id, account_id, amount, 'Paiement échéance automatique', newBalance]);

          // 4. Créer le lien de paiement
          await client.query(`
            INSERT INTO loan_payments (
              loan_id, installment_id, transaction_id, amount, payment_method
            ) VALUES ($1, $2, $3, $4, 'automatic')
          `, [loan_id, installment_id, tx.rows[0].id, amount]);

          await client.query('COMMIT');

          // ✅ Notification
          await Notification.create(
            user_id,
            'loan_due',
            `✅ Votre échéance de prêt a été prélevée automatiquement`,
            { amount, loan_id }
          );

          // ✅ SMS
          await SMSService.sendSMS(
            phone,
            `Cher ${firstName}, votre échéance de prêt de ${amount} XOF a été prélevée automatiquement aujourd’hui.`
          );

          console.log(`✅ Paiement automatique effectué pour ${installment_id}`);
        } catch (err) {
          await client.query('ROLLBACK');
          console.error(`❌ Erreur lors du paiement automatique ${installment_id}:`, err);
        } finally {
          client.release();
        }
      } else {
        console.warn(`⚠️ Solde insuffisant pour l’échéance ${installment_id} - solde: ${balance}`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur globale du paiement automatique:', err);
  }
}

// Fonction pour démarrer le scheduler
function startScheduler() {
  cron.schedule('0 0 * * *', async () => {
    try {
      console.log('🚀 Démarrage du scheduler...');

      await markOverdueInstallments();
      await checkLoanDueDates();
      await processAutomaticLoanPayments();
      await updateNextPaymentDates();

      console.log('✅ Scheduler terminé avec succès');
    } catch (err) {
      console.error('❌ Erreur dans le scheduler principal:', err);
    }
  });

  console.log('🕒 Scheduler actif - exécution quotidienne à minuit');
}

module.exports = { startScheduler };