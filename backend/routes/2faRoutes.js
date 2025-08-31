const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const twoFAController = require('../controllers/2faController');

// Activation / désactivation 2FA → protégées par auth
router.get('/setup', auth, twoFAController.generate2FA);
router.post('/verify', auth, twoFAController.verify2FA);
router.put('/disable', auth, twoFAController.disable2FA);

// Validation du code 2FA pendant le login → publique
router.post('/validate', twoFAController.validate2FAToken);

module.exports = router;
