const axios = require('axios');

class ExternalAPIService {

  /**
   * Dispatcher du paiement en fonction du fournisseur
   * @param {string} type - 'electricity' | 'water' | 'canal_plus'
   * @param {string} reference - Numéro client / compte
   * @param {number} amount - Montant à payer
   * @param {string} paymentMethod - Méthode de paiement
   */
  static async payBill({ type, reference, amount, paymentMethod }) {
    try {
      // 🔹 Mode dev : mock
      if (process.env.NODE_ENV === 'development') {
        console.log(`[Mock PAY] type=${type}, reference=${reference}, amount=${amount}, paymentMethod=${paymentMethod}`);
        return { success: true, data: { reference, amount, type }, error: null };
      }

      // 🔹 Mode prod : appel réel
      switch (type) {
        case 'electricity': return await this.payCEET({ reference, amount, paymentMethod });
        case 'water':       return await this.paySONEB({ reference, amount, paymentMethod });
        case 'canal_plus':  return await this.payCanalPlus({ reference, amount, paymentMethod });
        default:
          return { success: false, error: `Fournisseur inconnu : ${type}` };
      }
    } catch (err) {
      console.error('❌ ExternalAPIService.payBill error:', err.message);
      return { success: false, error: err.message };
    }
  }

  // ===========================
  // 🔌 CEET - Électricité
  // ===========================
  static async payCEET({ reference, amount, paymentMethod }) {
    try {
      const url = process.env.CEET_API_URL;
      const token = process.env.CEET_API_KEY;

      const res = await axios.post(url, {
        clientNumber: reference,
        amount,
        token,
        paymentMethod
      }, { timeout: 10000 });

      return { 
        success: res.data.success === true, 
        data: res.data, 
        error: res.data.error || null 
      };
    } catch (err) {
      console.error('❌ CEET payment error:', err.response?.data || err.message);
      return { success: false, error: err.response?.data || err.message };
    }
  }

  // ===========================
  // 💧 SONEB - Eau
  // ===========================
  static async paySONEB({ reference, amount, paymentMethod }) {
    try {
      const url = process.env.SONEB_API_URL;
      const token = process.env.SONEB_API_KEY;

      const res = await axios.post(url, {
        customerId: reference,
        amount,
        token,
        paymentMethod
      }, { timeout: 10000 });

      return { 
        success: res.data.success === true, 
        data: res.data, 
        error: res.data.error || null 
      };
    } catch (err) {
      console.error('❌ SONEB payment error:', err.response?.data || err.message);
      return { success: false, error: err.response?.data || err.message };
    }
  }

  // ===========================
  // 📺 Canal+ / CanalBox
  // ===========================
  static async payCanalPlus({ reference, amount, paymentMethod }) {
    try {
      const url = process.env.CANAL_API_URL;
      const token = process.env.CANAL_API_KEY;

      const res = await axios.post(url, {
        accountNumber: reference,
        amount,
        token,
        paymentMethod
      }, { timeout: 10000 });

      return { 
        success: res.data.success === true, 
        data: res.data, 
        error: res.data.error || null 
      };
    } catch (err) {
      console.error('❌ Canal+ payment error:', err.response?.data || err.message);
      return { success: false, error: err.response?.data || err.message };
    }
  }

}

module.exports = ExternalAPIService;
