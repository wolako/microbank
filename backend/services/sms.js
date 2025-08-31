const twilio = require('twilio');
const logger = require('../utils/logger');

class SMSService {
  constructor() {
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
  }

  async sendSMS(to, message) {
    try {
      const response = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: `+${to}`
      });
      logger.info(`SMS envoyé à ${to}: ${response.sid}`);
      return response;
    } catch (error) {
      logger.error(`Erreur d'envoi SMS: ${error.message}`);
      throw error;
    }
  }

  async sendPaymentConfirmation(userPhone, amount, loanId) {
    const message = `Paiement de ${amount} pour le prêt ${loanId} confirmé.`;
    return this.sendSMS(userPhone, message);
  }
}

module.exports = new SMSService();
