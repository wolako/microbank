const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const requireRole = require('../middleware/role');
const adminController = require('../controllers/admin');

// ✅ Liste des utilisateurs
router.get(
  '/users',
  requireAuth,
  requireRole(['admin', 'account_manager', 'support']),
  adminController.getAllUsers
);

// ✅ Vérification du KYC
router.post(
  '/users/:id/verify-kyc',
  requireAuth,
  requireRole(['admin', 'support']),
  adminController.verifyUserKYC
);

// ✅ Statistiques générales
router.get(
  '/stats',
  requireAuth,
  requireRole(['admin', 'account_manager']),
  adminController.getStats
);

// ✅ Liste des produits de prêt
router.get(
  '/loan-products',
  requireAuth,
  requireRole(['admin', 'account_manager']),
  adminController.getLoanProducts
);

// ✅ Prêts en attente
router.get(
  '/loans/pending',
  requireAuth,
  requireRole(['admin', 'loan_officer']),
  adminController.getPendingLoans
);

// ✅ Approbation / Rejet des prêts
router.post(
  '/loans/:id/approve',
  requireAuth,
  requireRole(['admin', 'loan_officer']),
  adminController.approveLoan
);

router.post(
  '/loans/:id/reject',
  requireAuth,
  requireRole(['admin', 'loan_officer']),
  adminController.rejectLoan
);

// ✅ Création d’un compte admin
router.post(
  '/create',
  requireAuth,
  requireRole(['admin']),
  adminController.createAdmin
);

// ✅ Mise à jour du rôle d’un utilisateur
router.put(
  '/users/:userId/role',
  requireAuth,
  requireRole(['admin', 'support']),
  adminController.updateUserRole
);

// ✅ Suppression d’un utilisateur
router.delete(
  '/users/:userId',
  requireAuth,
  requireRole(['admin', 'support']),
  adminController.deleteUser
);

// ✅ Récupération de tous les prêts (lecture)
router.get(
  '/loans',
  requireAuth,
  requireRole(['admin', 'account_manager']),
  adminController.getAllLoans
);

// ✅ Validation d’un compte utilisateur par un gestionnaire
router.post(
  '/users/:id/approve',
  requireAuth,
  requireRole(['admin', 'account_manager']),
  adminController.approveUserAccount
);

// ✅ Activation d’un prêt
router.post(
  '/loans/:id/activate',
  requireAuth,
  requireRole(['admin', 'account_manager']),
  adminController.activateLoan
);

// Liste des comptes clients non encore validés
router.get(
  '/users/pending',
  requireAuth,
  requireRole(['admin', 'account_manager']),
  adminController.getPendingUsers
);


module.exports = router;
