const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const transactionCtrl = require('../controllers/transactions');
const webhooks = require('../controllers/webhooks');
const reports = require('../controllers/reports');
const authRoutes = require('./auth');
const purchaseRoutes = require('./purchase');
const loanRoutes = require('./loans');

// Auth routes (correctement importées)
router.use('/auth', authRoutes);

// Routes des prêts
router.use('/loans', loanRoutes);

// Transactions
router.get('/transactions/recent', auth, transactionCtrl.getRecentTransactions);
router.post('/transactions', auth, transactionCtrl.createTransaction);
router.get('/transactions/balance', auth, transactionCtrl.getAccountBalance);

// Webhooks
router.post('/webhooks/payment', webhooks.paymentCallback);

// Reporting
router.get('/reports/financial', auth, reports.getFinancialReport);

router.use('/payments', loanRoutes);
//Purchase
router.use(purchaseRoutes);

module.exports = router;
