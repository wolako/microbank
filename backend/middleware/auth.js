const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');
const db = require('../config/db');
dotenv.config();

/**
 * CONSEIL OPTIONNEL (multi-sessions persistantes) :
 *  - Ajouter USE_SESSIONS_TABLE=true dans .env
 *  - Créer une table sessions (voir SQL en bas).
 *  - Émettre un JWT avec un jti unique à chaque login.
 */
const USE_SESSIONS_TABLE = process.env.USE_SESSIONS_TABLE === 'true';

module.exports = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token manquant ou invalide' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Vérifie le token (alg par défaut HS256)
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // decoded.sub: id user | decoded.jti: id de session (si fourni à l’émission)
    const userId = decoded.sub;
    if (!userId) {
      return res.status(401).json({ message: 'Token invalide (sub manquant)' });
    }

    // (Optionnel) Vérifier une session spécifique si activé
    if (USE_SESSIONS_TABLE && decoded.jti) {
      const s = await db.query(
        `SELECT id, user_id, revoked, expires_at
           FROM user_sessions
          WHERE id = $1 AND user_id = $2
          LIMIT 1`,
        [decoded.jti, userId]
      );
      if (!s.rows.length) {
        return res.status(401).json({ message: 'Session introuvable ou expirée' });
      }
      const session = s.rows[0];
      if (session.revoked === true) {
        return res.status(401).json({ message: 'Session révoquée' });
      }
      if (session.expires_at && new Date(session.expires_at) < new Date()) {
        return res.status(401).json({ message: 'Session expirée' });
      }
      // attache l’ID de session pour d’autres middlewares
      req.sessionId = session.id;
    }

    // Récupération de l’utilisateur
    const { rows } = await db.query(
      `SELECT id, email, role, main_account_id, phone, is_approved, two_factor_enabled
         FROM users
        WHERE id = $1`,
      [userId]
    );

    if (!rows.length) {
      return res.status(401).json({ message: 'Utilisateur non trouvé' });
    }

    const user = rows[0];

    // Si c’est un client non approuvé => 403 (forbidden)
    // Laisse passer les admins/agents même si not approved
    const isAdmin = ['admin', 'super_admin'].includes(user.role);
    if (user.role === 'user' && user.is_approved === false) {
      return res.status(403).json({ message: 'Votre compte client n\'a pas encore été approuvé.' });
    }

    const isLoanOfficer = ['loan_officer', 'admin', 'super_admin'].includes(user.role);

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      main_account_id: user.main_account_id,
      phone: user.phone,
      is_approved: user.is_approved,
      isAdmin,
      isLoanOfficer,
      twoFactorEnabled: !!user.two_factor_enabled,
      // IMPORTANT : ce flag vient du token courant (stateless par session)
      twoFactorValidated: !!decoded.twoFactorValidated, // ou decoded.tfv si tu préfères un nom court
      jti: decoded.jti || null,
    };

    return next();
  } catch (err) {
    console.error('❌ Erreur middleware auth:', err);
    // Token expiré ou invalide => 401
    return res.status(401).json({ message: 'Token invalide ou expiré' });
  }
};
