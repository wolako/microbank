// routes/webhook.js
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhooks');

// Loan / Paiement direct
router.post('/payment-callback', webhookController.paymentCallback);

// PayGate Mobile Money
router.post('/paygate/callback', webhookController.paygateCallback);

// Stripe
router.post('/stripe/callback', webhookController.stripeWebhook);

// Bill Payment
router.post('/bill-payment', webhookController.billPaymentCallback);

module.exports = router;
