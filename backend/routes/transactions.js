const express = require('express');
const router = express.Router();
const checkApproval = require('../middleware/checkApproval');
const requireAuth = require('../middleware/auth');
const require2FA = require('../middleware/require2FA');
const transactionController = require('../controllers/transactions');
const paymentController = require('../controllers/payment');
const { validate } = require('../middleware/validation');
const {
  transactionSchema,
  retraitMobileMoneySchema,
  retraitGuichetSchema,
  retraitCarteSchema,
  depotCarteSchema,
  depotMobileMoneySchema,
  billPaymentSchema
} = require('../validation/transactionSchemas');

// ==========================
// Dépôts
// ==========================

// Dépôt générique (manuel, wire, etc.)
router.post(
  '/deposit',
  requireAuth,
  require2FA,
  checkApproval,
  validate(transactionSchema),
  transactionController.createTransaction
);

// Dépôt Mobile Money via PayGate
router.post(
  '/mobile-money',
  requireAuth,
  require2FA,
  validate(depotMobileMoneySchema),
  transactionController.mobileMoneyDeposit
);

// Dépôt par carte "manuel"
router.post(
  '/card',
  requireAuth,
  require2FA,
  validate(depotCarteSchema),
  transactionController.cardDeposit
);

// Dépôt carte via Stripe
router.post(
  '/deposit/stripe',
  requireAuth,
  require2FA,
  transactionController.stripeCardDeposit
);

// ==========================
// Retraits
// ==========================

// Retrait Mobile Money
router.post(
  '/retrait/mobile-money',
  requireAuth,
  require2FA,
  validate(retraitMobileMoneySchema),
  transactionController.createTransaction
);

// Retrait par carte
router.post(
  '/retrait/carte',
  requireAuth,
  require2FA,
  validate(retraitCarteSchema),
  transactionController.createTransaction
);

// Retrait guichet automatique
router.post(
  '/retrait/guichet',
  requireAuth,
  require2FA,
  validate(retraitGuichetSchema),
  transactionController.createTransaction
);

// ==========================
// Paiements factures
// ==========================
router.post(
  '/payments/bill',
  requireAuth,
  require2FA,
  validate(billPaymentSchema),
  paymentController.payBill
);

// ==========================
// Transaction générique
// ==========================
router.post(
  '/',
  requireAuth,
  require2FA,
  validate(transactionSchema),
  transactionController.createTransaction
);

// ==========================
// Retrait / demande de retrait
// ==========================
router.post(
  '/withdraw/request',
  requireAuth,
  require2FA,
  transactionController.requestWithdrawal
);

// ==========================
// Transactions en lecture
// ==========================

// Transactions récentes
router.get(
  '/recent',
  requireAuth,
  transactionController.getRecentTransactions
);

// Solde du compte
router.get(
  '/balance',
  requireAuth,
  checkApproval,
  transactionController.getAccountBalance
);

// Historique complet
router.get(
  '/',
  requireAuth,
  checkApproval,
  transactionController.getAllTransactions
);

// Détails d’une transaction
router.get(
  '/:id',
  requireAuth,
  transactionController.getTransactionById
);

// Réception virement externe (webhook interne)
router.post(
  '/external-incoming',
  requireAuth,
  require2FA,
  transactionController.receiveExternalWire
);

// Retrait ATM : génération du code
router.post(
  '/atm-withdrawal',
  requireAuth,
  require2FA,
  transactionController.createATMWithdrawal
);

// Retrait ATM : validation du code
router.post(
  '/atm-verify',
  requireAuth,
  require2FA,
  transactionController.validateATMCode
);

module.exports = router;
