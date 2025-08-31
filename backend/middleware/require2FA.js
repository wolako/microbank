const db = require('../config/db');

const TWO_FA_EXPIRATION_MINUTES = 5; // Durée de validité du flag 2FA

module.exports = async (req, res, next) => {
  try {
    // 1️⃣ Vérifier que l'utilisateur est authentifié
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: 'Utilisateur non authentifié' });
    }

    // 2️⃣ Si l'utilisateur n'a pas activé 2FA, passer au middleware suivant
    if (!req.user.two_factor_enabled) {
      return next();
    }

    // 3️⃣ Vérifier que la 2FA a été validée récemment
    const result = await db.query(
      `SELECT two_factor_validated_at
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    const validatedAt = result.rows[0]?.two_factor_validated_at;
    if (!validatedAt) {
      return res.status(403).json({ message: '2FA obligatoire' });
    }

    const now = new Date();
    const validatedDate = new Date(validatedAt);
    const diffMinutes = (now - validatedDate) / (1000 * 60);

    if (diffMinutes > TWO_FA_EXPIRATION_MINUTES) {
      return res.status(403).json({ message: 'Code 2FA expiré, veuillez revalider' });
    }

    // 4️⃣ 2FA validée et non expirée → passer au middleware suivant
    next();

  } catch (err) {
    console.error('Erreur middleware require2FA:', err);
    res.status(500).json({ message: 'Erreur serveur 2FA' });
  }
};
