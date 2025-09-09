console.log('📥 Fichier auth.js chargé');  // tout en haut du fichier

const express = require('express');
const router = express.Router();
const { validate } = require('../middleware/validation');
const authSchemas = require('../validation/authSchemas');
const requireAuth = require('../middleware/auth');
const require2FA = require('../middleware/require2FA');
const authController = require('../controllers/authController');


// Inscription
router.post('/register', validate(authSchemas.register), authController.register);

// Connexion users
router.post('/login', validate(authSchemas.login), (req, res, next) => {
  req.body.allowedRoles = ['user']; // uniquement les utilisateurs normaux
  next();
}, authController.login);

// connexion admin
router.post('/admin/login', validate(authSchemas.login), (req, res, next) => {
  req.body.allowedRoles = ['admin', 'account_manager', 'loan_officer', 'support'];
  next();
}, authController.login);


// Réinitialisation mot de passe
router.post('/forgot-password', authController.forgotPassword);
router.post('/reset-password', authController.resetPassword);

// Déconnexion
router.post('/logout', authController.logout);

// Vérification KYC
router.post('/verify-kyc', requireAuth, authController.verifyKYC);

// Verification Email
router.get('/check-email', authController.checkEmail);

// Confirmation Email
console.log('✅ Route get /confirm-email enregistrée');
console.log('🔎 confirmEmail:', authController.confirmEmail);

router.get('/confirm-email', authController.confirmEmail);

// renvoie confirmation
router.post('/resend-confirmation', authController.resendConfirmation);

router.get('/profile', requireAuth, authController.getProfile);

router.get('/check-session', requireAuth, (req, res) => {
  res.json(req.user);
});


module.exports = router;
