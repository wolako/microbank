const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const usersController = require('../controllers/usersController');
const speakeasy = require('speakeasy');
const QRCode = require('qrcode');

// ----------------- Profil -----------------
router.put('/profile', requireAuth, usersController.updateProfile);

// ----------------- Notifications -----------------
router.put('/notifications', requireAuth, usersController.updateNotificationPreferences);

// ----------------- Changer mot de passe -----------------
router.post('/change-password', requireAuth, usersController.changePassword);

// ----------------- Setup 2FA -----------------
router.get('/2fa/setup', requireAuth, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({
      name: `DowoBank (${req.user.email})`,
    });

    // Stocker temporairement le secret 2FA
    await require('../config/db').query(
      `UPDATE users SET two_factor_temp_secret = $1 WHERE id = $2`,
      [secret.base32, req.user.id]
    );

    const qrDataUrl = await QRCode.toDataURL(secret.otpauth_url);
    res.json({ qrDataUrl, secret: secret.base32 });
  } catch (err) {
    console.error('Erreur setup 2FA:', err);
    res.status(500).json({ error: 'Erreur lors de la configuration 2FA' });
  }
});

// ----------------- Vérification 2FA -----------------
router.post('/2fa/verify', requireAuth, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: 'Code requis' });

  try {
    const { rows } = await require('../config/db').query(
      `SELECT two_factor_temp_secret FROM users WHERE id = $1`,
      [req.user.id]
    );

    if (!rows.length || !rows[0].two_factor_temp_secret)
      return res.status(400).json({ success: false, message: 'Pas de secret 2FA temporaire' });

    const verified = speakeasy.totp.verify({
      secret: rows[0].two_factor_temp_secret,
      encoding: 'base32',
      token
    });

    if (!verified) return res.json({ success: false });

    // Activer 2FA définitivement
    await require('../config/db').query(
      `UPDATE users 
       SET two_factor_enabled = TRUE, 
           two_factor_secret = $1, 
           two_factor_temp_secret = NULL 
       WHERE id = $2`,
      [rows[0].two_factor_temp_secret, req.user.id]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Erreur vérification 2FA:', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

// ----------------- Désactivation 2FA -----------------
router.put('/2fa/disable', requireAuth, async (req, res) => {
  try {
    await require('../config/db').query(
      `UPDATE users SET two_factor_enabled = FALSE, two_factor_secret = NULL WHERE id = $1`,
      [req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur désactivation 2FA:', err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;
