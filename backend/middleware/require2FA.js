const db = require('../config/db');
const TWO_FA_EXPIRATION_MINUTES = 5; // Durée de validité du flag 2FA

module.exports = async (req, res, next) => {
  try {
    // 1️⃣ Vérifier que l'utilisateur est authentifié
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    // 2️⃣ Lire les infos 2FA depuis la base
    const result = await db.query(
      `SELECT two_factor_enabled, two_factor_validated_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Utilisateur introuvable' });
    }

    const { two_factor_enabled, two_factor_validated_at } = result.rows[0];

    // 3️⃣ Si 2FA pas activée → passer au middleware suivant
    if (!two_factor_enabled) {
      return next();
    }

    // 4️⃣ Si activée mais pas validée récemment
    if (!two_factor_validated_at) {
      return res.status(403).json({ message: '2FA obligatoire' });
    }

    const diffMinutes = (Date.now() - new Date(two_factor_validated_at)) / (1000 * 60);
    if (diffMinutes > TWO_FA_EXPIRATION_MINUTES) {
      return res.status(403).json({ message: 'Code 2FA expiré, veuillez revalider' });
    }

    // 5️⃣ 2FA validée et non expirée → passer au middleware suivant
    next();

  } catch (err) {
    console.error('Erreur middleware require2FA:', err);
    res.status(500).json({ message: 'Erreur serveur 2FA' });
  }
};
