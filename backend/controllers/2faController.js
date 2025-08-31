const jwt = require('jsonwebtoken');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');
const db = require('../config/db');

// Générer un secret 2FA et l'enregistrer temporairement
exports.generate2FA = async (req, res) => {
  const userId = req.user.id;

  try {
    const secret = speakeasy.generateSecret({ name: `microbank (${req.user.email})` });

    await db.query(
      `UPDATE users 
       SET two_factor_temp_secret = $1 
       WHERE id = $2`,
      [secret.base32, userId]
    );

    const qrDataUrl = await qrcode.toDataURL(secret.otpauth_url);

    res.json({ qr: qrDataUrl, base32: secret.base32 });
  } catch (err) {
    console.error('Erreur generate2FA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Vérifier le code et activer le 2FA
exports.verify2FA = async (req, res) => {
  const userId = req.user.id;
  const { token } = req.body;

  try {
    const result = await db.query(
      `SELECT two_factor_temp_secret 
       FROM users 
       WHERE id = $1`,
      [userId]
    );

    const tempSecret = result.rows[0]?.two_factor_temp_secret;
    if (!tempSecret) return res.status(400).json({ error: 'Secret 2FA non trouvé' });

    const verified = speakeasy.totp.verify({
      secret: tempSecret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) return res.status(400).json({ error: 'Code invalide' });

    // Activer 2FA et initialiser la date de validation
    await db.query(
      `UPDATE users 
       SET two_factor_secret = $1, 
           two_factor_enabled = TRUE, 
           two_factor_temp_secret = NULL,
           two_factor_validated_at = NOW()
       WHERE id = $2`,
      [tempSecret, userId]
    );

    res.json({ success: true, message: '2FA activé' });
  } catch (err) {
    console.error('Erreur verify2FA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Désactiver 2FA
exports.disable2FA = async (req, res) => {
  const userId = req.user.id;
  try {
    await db.query(
      `UPDATE users 
       SET two_factor_enabled = FALSE, 
           two_factor_secret = NULL, 
           two_factor_temp_secret = NULL,
           two_factor_validated_at = NULL
       WHERE id = $1`,
      [userId]
    );
    res.json({ success: true, message: '2FA désactivé' });
  } catch (err) {
    console.error('Erreur disable2FA:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Vérifier 2FA lors du login (si activé)
exports.validate2FAToken = async (req, res) => {
  const { userId, token } = req.body;

  try {
    const result = await db.query(
      `SELECT id, email, role, two_factor_secret 
       FROM users 
       WHERE id = $1 AND two_factor_enabled = TRUE`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: '2FA non activé' });
    }

    const user = result.rows[0];

    const verified = speakeasy.totp.verify({
      secret: user.two_factor_secret,
      encoding: 'base32',
      token,
      window: 1
    });

    if (!verified) {
      return res.status(400).json({ error: 'Code invalide' });
    }

    // Mettre à jour la date de validation pour expiration
    await db.query(
      `UPDATE users
       SET two_factor_validated_at = NOW()
       WHERE id = $1`,
      [userId]
    );

    // Générer un JWT final après 2FA validé
    const newToken = jwt.sign(
      { sub: user.id, email: user.email, role: user.role, twoFactorValidated: true },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ 
      success: true, 
      token: newToken,
      user: { id: user.id, email: user.email, role: user.role }
    });

  } catch (err) {
    console.error('Erreur validate2FAToken:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};
