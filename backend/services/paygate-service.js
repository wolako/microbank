// const axios = require('axios');
// const { v4: uuidv4 } = require('uuid');
// const crypto = require('crypto');

// const PAYGATE_API_URL = 'https://paygateglobal.com/api/v1/pay';
// const PAYGATE_KEY = process.env.PAYGATE_KEY;
// // Génère un identifiant unique pour la transaction
// function generateReference() {
//   return uuidv4();
// }

// // Vérifie la signature du callback PayGate
// function verifyCallbackSignature({ identifier, amount, checksum }) {
//   const expected = crypto.createHash('md5')
//     .update(`${identifier}${amount}${PAYGATE_KEY}`)
//     .digest('hex');
//   return expected === checksum;
// }

// // Demande un paiement Mobile Money
// async function requestPayment({ amount, phone, provider }) {
//   const reference = generateReference();
//   const payload = {
//     auth_token: PAYGATE_KEY,
//     phone_number: phone,
//     amount,
//     description: `Dépôt via ${provider}`,
//     identifier: reference,
//     network: provider.toUpperCase() // FLOOZ ou TMONEY
//   };

//   try {
//     const response = await axios.post(PAYGATE_API_URL, payload, {
//       headers: { 'Content-Type': 'application/json' }
//     });

//     return {
//       success: response.data.status === 0, // 0 = succès selon PayGate
//       reference,
//       data: response.data
//     };
//   } catch (err) {
//     console.error('Erreur PayGate:', err.response?.data || err.message);
//     return {
//       success: false,
//       error: err.response?.data || 'Erreur inconnue'
//     };
//   }
// }

// module.exports = {
//   requestPayment,
//   verifyCallbackSignature
// };


const { v4: uuidv4 } = require('uuid');

// Demande un paiement Mobile Money (simulation pour dev)
async function requestPayment({ amount, phone, provider }) {
  if (process.env.NODE_ENV === 'development') {
    // Simulation de transaction réussie
    const fakeReference = `dev-${uuidv4()}`;
    return {
      success: true,
      reference: fakeReference,
      data: {
        status: 0,
        tx_reference: fakeReference,
        message: 'Transaction simulée en mode développement',
        phone_number: phone,
        amount,
        provider
      }
    };
  }

  // Ici, tu peux mettre le code réel pour la prod avec axios
  throw new Error('Mode production non implémenté dans ce service dev');
}

// Vérifie la signature du callback PayGate (non utilisé en dev)
function verifyCallbackSignature({ identifier, amount, checksum }) {
  return true; // toujours vrai en dev
}

module.exports = {
  requestPayment,
  verifyCallbackSignature
};
