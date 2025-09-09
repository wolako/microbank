const db = require('../config/db');
const SMSService = require('./sms');
const Mailer = require('../utils/mailer');
const User = require('../models/User');

class NotificationService {
  /**
   * Crée une notification et envoie par email/SMS si activé.
   * @param {number} userId - ID de l'utilisateur concerné
   * @param {string} type - Type de notification
   * @param {string} message - Contenu du message
   * @param {object} metadata - Données supplémentaires
   * @param {boolean} notifyAdmins - Si vrai, les admins sont notifiés aussi
   */
  static async create(userId, type, message, metadata = {}, notifyAdmins = false) {
    // 1. Enregistrer la notification en base
    const { rows } = await db.query(
      `INSERT INTO notifications (
        user_id, type, title, message, metadata
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [userId, type, this.getTitle(type), message, metadata]
    );

    // 2. Récupérer l'utilisateur
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
        await Mailer.sendGenericNotification(
          user.email,
          this.getTitle(type),
          message
        );
      } catch (err) {
        console.error('❌ Erreur envoi email:', err.message);
      }
    }

    // 5. Notifier les admins si demandé
    if (notifyAdmins) {
      await this.notifyAdmins(type, message, metadata);
    }

    return rows[0];
  }

  /**
   * Notifie tous les admins
   */
  static async notifyAdmins(type, message, metadata = {}) {
    try {
      const { rows: admins } = await db.query(
        `SELECT id, email, phone, email_notifications_enabled, sms_notifications_enabled
         FROM users WHERE role = 'admin'`
      );

      if (!admins.length) {
        console.warn('⚠️ Aucun admin trouvé pour notifier.');
        return;
      }

      for (const admin of admins) {
        // Enregistrer une notification admin en base
        await db.query(
          `INSERT INTO notifications (user_id, type, title, message, metadata)
           VALUES ($1, $2, $3, $4, $5)`,
          [admin.id, type, this.getTitle(type), message, metadata]
        );

        // Envoi SMS si activé
        if (admin.sms_notifications_enabled && admin.phone) {
          try {
            console.log(`👮‍♂️📲 Envoi SMS admin ${admin.phone}: ${message}`);
            await SMSService.sendSMS(admin.phone, message);
          } catch (err) {
            console.error('❌ Erreur SMS admin:', err.message);
          }
        }

        // Envoi email si activé
        if (admin.email_notifications_enabled && admin.email) {
          try {
            console.log(`👮‍♂️📧 Envoi email admin ${admin.email}: ${message}`);
            await Mailer.sendGenericNotification(
              admin.email,
              `[ADMIN] ${this.getTitle(type)}`,
              message
            );
          } catch (err) {
            console.error('❌ Erreur email admin:', err.message);
          }
        }
      }
    } catch (err) {
      console.error('❌ Erreur lors de la notification des admins:', err.message);
    }
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
      'bill_payment_failed': 'Échec de paiement de facture',
      'user_registered': 'Nouvel utilisateur inscrit',
      'loan_requested': 'Nouvelle demande de prêt'
    };
    return titles[type] || 'Notification';
  }
}

module.exports = NotificationService;
