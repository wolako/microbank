const express = require('express');
const router = express.Router();
const purchaseController = require('../controllers/purchase');
const requireAuth = require('../middleware/auth');
const require2FA = require('../middleware/require2FA');


router.post('/purchase', requireAuth, require2FA, purchaseController.makePurchase);

module.exports = router;
