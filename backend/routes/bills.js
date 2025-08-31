const express = require('express');
const router = express.Router();
const billController = require('../controllers/bill');
const requireAuth = require('../middleware/auth');
const require2FA = require('../middleware/require2FA');


router.post('/', requireAuth, require2FA, billController.createAndPayBill);
router.get('/', requireAuth, billController.getAllBills);
router.get('/:id', requireAuth, billController.getBillById);
router.delete('/:id', requireAuth, billController.deleteBill);
router.post('/:id/retry', requireAuth, require2FA, billController.retryPayment);

module.exports = router;
