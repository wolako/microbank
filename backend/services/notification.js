const db = require('../config/db');
const SMSService = require('./sms');
const Mailer = require('../utils/mailer');
const User = require('../models/User');

class NotificationService {
  static async create(userId, type, message, metadata = {}) {
    // 1. Enregistrer la notification en base
    const { rows } = await db.query(
      `INSERT INTO notifications (
        user_id, type, title, message, metadata
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, type, this.getTitle(type), message, metadata]
    );

    // 2. Récupérer l'utilisateur avec ses préférences
    const { rows: userRows } = await db.query(
      `SELECT email, phone, email_notifications_enabled, sms_notifications_enabled
       FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    );

    if (!userRows.length) {
      console.warn(`👤 Utilisateur ${userId} introuvable pour notification.`);
      return rows[0];
    }

    const user = userRows[0];

    // 3. Envoi du SMS si activé
    if (user.sms_notifications_enabled && user.phone) {
      try {
        console.log(`📲 Envoi SMS à ${user.phone}: ${message}`);
        await SMSService.sendSMS(user.phone, message);
      } catch (err) {
        console.error('❌ Erreur envoi SMS:', err.message);
      }
    }

    // 4. Envoi de l'email si activé
    if (user.email_notifications_enabled && user.email) {
      try {
        console.log(`📧 Envoi email à ${user.email}: ${message}`);
        await Mailer.sendGenericNotification(user.email, this.getTitle(type), message);
      } catch (err) {
        console.error('❌ Erreur envoi email:', err.message);
      }
    }

    return rows[0];
  }

  static getTitle(type) {
    const titles = {
      'payment_received': 'Paiement reçu',
      'payment_failed': 'Paiement échoué',
      'loan_due': 'Échéance de prêt',
      'deposit': 'Dépôt effectué',
      'withdrawal': 'Retrait effectué',
      'transfer': 'Transfert effectué',
      'wire': 'Virement bancaire',
      'bill_created': 'Nouvelle facture générée',
      'bill_paid': 'Facture payée',
      'bill_payment_failed': 'Échec de paiement de facture'
    };
    return titles[type] || 'Notification';
  }

}

module.exports = NotificationService;
