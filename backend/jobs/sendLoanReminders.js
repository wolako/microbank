const db = require('../config/db');
const Notification = require('../models/notification');
const SMSService = require('../services/sms');
const Mailer = require('../utils/mailer');

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildMessage(type, amount, dueDate) {
  if (type === 'upcoming') {
    return `📌 Rappel : votre échéance de prêt de ${amount} FCFA est prévue pour le ${dueDate}.`;
  }
  if (type === 'late') {
    return `⏰ Attention : vous avez un retard de paiement pour votre prêt (${amount} FCFA) dû le ${dueDate}. Merci de régulariser au plus vite.`;
  }
  return '';
}

async function sendReminderToUser(user, type, loanId, installmentId, amount, dueDate) {
  const message = buildMessage(type, amount, dueDate);

  // 🔔 Notification interne
  await Notification.create(user.id, 'loan_due', message, {
    loanId,
    installmentId,
    dueDate,
    amount
  });

  // 📲 SMS
  if (user.sms_notifications_enabled && user.phone) {
    try {
      await SMSService.sendSMS(user.phone, message);
    } catch (err) {
      console.error('Erreur SMS:', err.message);
    }
  }

  // 📧 Email
  if (user.email_notifications_enabled && user.email) {
    try {
      await Mailer.sendGenericNotification(user.email, 'Rappel de prêt', message);
    } catch (err) {
      console.error('Erreur email:', err.message);
    }
  }
}

async function sendLoanReminders() {
  const client = await db.connect();
  try {
    const today = new Date();

    // Dates cibles
    const offsets = [-3, -1, 0, 1, 3, 7];
    for (const offset of offsets) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + offset);
      const dateStr = formatDate(targetDate);

      const type = offset < 0 || offset === 0 ? 'upcoming' : 'late';

      const { rows } = await client.query(`
        SELECT 
          li.id AS installment_id,
          li.due_date,
          li.amount,
          li.loan_id,
          u.id AS user_id,
          u.phone,
          u.email,
          u.email_notifications_enabled,
          u.sms_notifications_enabled
        FROM loan_installments li
        JOIN loans l ON li.loan_id = l.id
        JOIN users u ON l.user_id = u.id
        WHERE li.status = 'pending'
        AND li.due_date = $1
      `, [dateStr]);

      for (const row of rows) {
        await sendReminderToUser(
          {
            id: row.user_id,
            phone: row.phone,
            email: row.email,
            email_notifications_enabled: row.email_notifications_enabled,
            sms_notifications_enabled: row.sms_notifications_enabled
          },
          type,
          row.loan_id,
          row.installment_id,
          row.amount,
          formatDate(row.due_date)
        );
      }

      if (rows.length) {
        console.log(`📨 Rappels ${type} envoyés pour le ${dateStr} : ${rows.length}`);
      }
    }
  } catch (err) {
    console.error('❌ Erreur lors de l’envoi des rappels:', err);
  } finally {
    client.release();
  }
}

sendLoanReminders();
