const db = require('../config/db');
const bcrypt = require('bcrypt');

// ----------------- Mise à jour profil -----------------
exports.updateProfile = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Non authentifié' });

  const { firstName, lastName, email, phone } = req.body;

  if (!firstName || !lastName || !email) {
    return res.status(400).json({ message: 'Prénom, nom et email requis' });
  }

  try {
    const result = await db.query(
      `UPDATE users SET 
        firstname = $1, 
        lastname = $2, 
        email = $3, 
        phone = $4
      WHERE id = $5
      RETURNING id, firstname, lastname, email, phone`,
      [
        firstName,
        lastName,
        email,
        phone || null,
        userId
      ]
    );

    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    console.error('Erreur updateProfile:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};


// ----------------- Changer mot de passe -----------------
function isStrongPassword(pwd) {
  return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.()[\]{}_\-+~^,:;!#'"|\\/<>])[A-Za-z\d@$!%*?&.()[\]{}_\-+~^,:;!#'"|\\/<>]{8,}$/.test(pwd);
}

exports.changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ message: 'Veuillez fournir l’ancien et le nouveau mot de passe.' });
    }

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) return res.status(404).json({ message: 'Utilisateur non trouvé.' });

    const user = result.rows[0];
    const isMatch = await bcrypt.compare(oldPassword, user.password_hash);
    if (!isMatch) return res.status(401).json({ message: 'Ancien mot de passe incorrect.' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const resultUpdate = await db.query(
      'UPDATE users SET password_hash = $1, password_updated_at = NOW() WHERE id = $2 RETURNING password_updated_at',
      [hashedPassword, userId]
    );

    res.json({
      message: 'Mot de passe mis à jour avec succès.',
      passwordUpdatedAt: resultUpdate.rows[0].password_updated_at
    });
  } catch (err) {
    console.error('Erreur changePassword:', err);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
};

// ----------------- Notifications -----------------
exports.updateNotificationPreferences = async (req, res) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Non authentifié' });

  const { email_notifications_enabled, sms_notifications_enabled } = req.body;
  if (typeof email_notifications_enabled !== 'boolean' || typeof sms_notifications_enabled !== 'boolean') {
    return res.status(400).json({ message: 'Valeurs de notification invalides' });
  }

  try {
    await db.query(
      `UPDATE users SET 
        email_notifications_enabled = $1, 
        sms_notifications_enabled = $2 
       WHERE id = $3`,
      [email_notifications_enabled, sms_notifications_enabled, userId]
    );

    res.json({
      success: true,
      message: 'Préférences de notification mises à jour',
      email_notifications_enabled,
      sms_notifications_enabled
    });
  } catch (err) {
    console.error('Erreur updateNotificationPreferences:', err.message);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
