require('dotenv').config();
const PaymentService = require('./services/payment');

console.log('Worker de paiement démarré...');

// Gestion des erreurs non catchées
process.on('unhandledRejection', (err) => {
  console.error('Erreur non gérée:', err);
  process.exit(1);
});