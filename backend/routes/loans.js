const express = require('express');
const router = express.Router();
const checkApproval = require('../middleware/checkApproval');
const requireAuth = require('../middleware/auth');
const require2FA = require('../middleware/require2FA');
const requireRole = require('../middleware/role');
const loanController = require('../controllers/loans');

// =======================
// 🧾 Produits de prêt
// =======================

// Simulation
router.post('/simulate', loanController.simulateLoan);

// ✅ Récupérer tous les produits
router.get('/products', loanController.getLoanProducts);

// ✅ Récupérer un seul produit (⚠️ cette route doit précéder /:id)
router.get('/products/:id', loanController.getLoanProductById);


// =======================
// 📊 Statistiques & vues
// =======================

// ✅ Statistiques générales utilisateur (score, emprunts, etc.)
router.get('/statistics', requireAuth, requireRole(['user', 'admin', 'loanOfficer']), loanController.getLoanStatistics);

// ✅ Vue utilisateur globale
router.get('/overview', requireAuth, loanController.getUserLoanOverview);

// ✅ Statistiques des paiements
router.get('/payments/stats', requireAuth, loanController.getPaymentStats);

// ✅ Statistiques mensuelles des paiements
router.get('/payments/monthly', requireAuth, loanController.getMonthlyPaymentStats);

// ✅ Répartition des statuts de prêts
router.get('/distribution', requireAuth, loanController.getLoanDistribution);


// =======================
// 💰 Demande & gestion des prêts
// =======================

// ✅ Créer une demande de prêt
router.post('/request', requireAuth, require2FA, checkApproval, loanController.createLoan);

// ✅ Obtenir tous les prêts de l'utilisateur
router.get('/', requireAuth, checkApproval, loanController.getUserLoans);

// ✅ Détails d’un prêt
router.get('/:id', requireAuth, loanController.getLoanDetails);

// ✅ Obtenir le calendrier des paiements
router.get('/:id/schedule', requireAuth, loanController.getLoanSchedule);

// ✅ Annuler un prêt en attente
router.post('/:id/cancel', requireAuth, loanController.cancelLoan);

// ✅ Approbation d’un prêt (admin ou agent crédit)
router.post('/:id/approve', requireAuth, requireRole(['admin', 'loanOfficer']), loanController.approveLoan);

// ✅ Déblocage du prêt
router.patch('/:id/disburse', requireAuth, loanController.disburseLoan);


// =======================
// 💳 Paiements de prêt
// =======================

// ✅ Rembourser un prêt
router.post('/:loanId/repay', requireAuth, require2FA, loanController.repayLoan);

// ✅ Prochaines échéances de remboursement
router.get('/installments/upcoming', requireAuth, loanController.getUpcomingInstallments);


module.exports = router;
