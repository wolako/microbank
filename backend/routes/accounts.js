const express = require('express');
const router = express.Router();
const requireAuth = require('../middleware/auth');
const require2FA = require('../middleware/require2FA');
const db = require('../config/db');
const bcrypt = require('bcrypt');

// GET /api/accounts/me
router.get('/me', requireAuth, require2FA, async (req, res) => {
  try {
    const { rows } = await db.query(`
      SELECT a.accountnumber, a.balance, u.firstName, u.lastName, u.email, u.password_hash
      FROM accounts a
      JOIN users u ON u.id = a.user_id
      WHERE a.user_id = $1
    `, [req.user.id]);

    if (!rows.length) return res.status(404).json({ message: 'Compte non trouvé' });

    const account = rows[0];
    delete account.password_hash; // Ne pas renvoyer le hash
    res.json(account);
  } catch (err) {
    console.error('❌ Erreur récupération compte :', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
});

// POST /api/accounts/verify-password
router.post('/verify-password', requireAuth, require2FA, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ success: false, message: 'Mot de passe requis' });

    const { rows } = await db.query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
    if (!rows.length) return res.status(404).json({ success: false, message: 'Utilisateur introuvable' });

    const user = rows[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.json({ success: false });

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Erreur vérification mot de passe :', err);
    res.status(500).json({ success: false, message: 'Erreur serveur' });
  }
});

module.exports = router;
