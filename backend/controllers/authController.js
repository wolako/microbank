const User = require('../models/User');
const bcrypt = require('bcrypt');
const smsService = require('../services/sms');
const db = require('../config/db');
const jwt = require('jsonwebtoken');
const mailer = require('../utils/mailer');
const crypto = require('crypto');
const { generateRIB, generateIBAN } = require('../utils/accounts');

// ✅ Inscription
exports.register = async (req, res) => {
  const client = await db.connect();

  try {
    const { firstName, lastName, email, phone, password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ success: false, error: 'Les mots de passe ne correspondent pas' });
    }

    await client.query('BEGIN');

    // Hash du mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // Génération token de vérification email
    const emailVerificationToken = crypto.randomBytes(32).toString('hex');

    // Création utilisateur
    const { rows: userRows } = await client.query(
      `INSERT INTO users (firstname, lastname, email, phone, password_hash, role, email_verification_token, is_approved)
       VALUES ($1, $2, $3, $4, $5, 'user', $6, false)
       RETURNING id, firstname, lastname, email, phone, role, is_verified`,
      [firstName, lastName, email, phone, passwordHash, emailVerificationToken]
    );
    const user = userRows[0];

    // Création compte principal lié à cet utilisateur
    const rib = generateRIB();
    const iban = generateIBAN(rib);
    const { rows: accountRows } = await client.query(
      `INSERT INTO accounts (user_id, accountnumber, iban, balance, currency, status, created_at, updated_at)
       VALUES ($1, $2, $3, 0, 'XOF', 'active', NOW(), NOW())
       RETURNING id`,
      [user.id, rib, iban]
    );
    const account = accountRows[0];

    // Mise à jour main_account_id dans users
    await client.query(
      `UPDATE users SET main_account_id = $1 WHERE id = $2`,
      [account.id, user.id]
    );

    // Commit de la transaction
    await client.query('COMMIT');

    // Envoi mails / sms (hors transaction)
    await mailer.sendVerificationEmail(email, emailVerificationToken);
    await mailer.sendAccountInfoWithPDF({ email, firstName, lastName, rib, iban });
    await mailer.sendGenericNotification(email, "Compte en attente de validation", `
      <p>Bonjour ${firstName},</p>
      <p>Merci pour votre inscription.</p>
      <p>Votre compte est en attente de validation par un gestionnaire. Vous serez notifié dès qu’il sera actif.</p>
      <p>Temps estimé : 24 heures ouvrées.</p>
      <p>L'équipe MicroBank</p>
    `);
    smsService.sendSMS(phone, `Bienvenue ${firstName}, votre compte sera validé sous 24h par un gestionnaire.`)
      .catch(err => console.error('Erreur SMS:', err));

    res.status(201).json({
      success: true,
      message: "Inscription réussie. Votre compte sera validé dans un bref délai par un gestionnaire.",
      token: emailVerificationToken,
      user: {
        id: user.id,
        firstName: user.firstname,
        lastName: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role || 'user',
        is_verified: user.is_verified
      }
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Erreur inscription:', err);

    // Gestion spécifique des erreurs d'unicité par exemple
    if (err.code === '23505') { // violation contrainte unique Postgres
      if (err.detail && err.detail.includes('email')) {
        return res.status(400).json({ success: false, error: 'Email déjà utilisé' });
      }
      if (err.detail && err.detail.includes('phone')) {
        return res.status(400).json({ success: false, error: 'Téléphone déjà utilisé' });
      }
    }

    res.status(500).json({ success: false, error: 'Erreur interne' });
  } finally {
    client.release();
  }
};

// ✅ Connexion
exports.login = async (req, res) => {
  try {
    const { login, password, allowedRoles } = req.body; // allowedRoles : tableau ['user'] ou ['admin', 'account_manager']

    const user = await User.findByLogin(login);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    // 🔒 Vérification email
    if (!user.is_verified) {
      return res.status(403).json({ 
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Veuillez confirmer votre adresse email avant de vous connecter.' 
      });
    }

    // 🔒 Vérification validation du compte (sauf pour certains rôles)
    if (!user.is_approved && !['admin', 'loan_officer', 'account_manager', 'support', 'auditor', 'compliance'].includes(user.role)) {
      return res.status(403).json({ 
        error: 'ACCOUNT_NOT_APPROVED',
        message: 'Votre compte est en attente de validation par un gestionnaire.' 
      });
    }

    // 🔒 Vérification du rôle autorisé pour cette route
    if (allowedRoles && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ 
        error: 'ROLE_NOT_ALLOWED',
        message: "Vous n'êtes pas autorisé à vous connecter via cette page."
      });
    }

    // 2FA
    if (user.two_factor_enabled) {
      return res.json({
        twoFactorRequired: true,
        user: { id: user.id, email: user.email }
      });
    }

    // ✅ Connexion réussie
    const token = jwt.sign({ sub: user.id, email: user.email, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: '2h'
    });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.firstname,
        lastName: user.lastname,
        email: user.email,
        phone: user.phone,
        role: user.role,
        is_verified: user.is_verified,
        kycVerified: user.kyc_verified,
        joinDate: user.created_at,
        lastLogin: user.last_login ?? null
      }
    });

  } catch (err) {
    console.error('Erreur login:', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

// Déconnexion (logout)
exports.logout = (req, res) => {
  // Pour JWT, la déconnexion est souvent gérée côté client en supprimant le token.
  // Ici on peut simplement répondre OK.
  res.json({ message: 'Déconnexion réussie' });
};

// ✅ Profil
exports.getProfile = async (req, res) => {
  console.log("👉 Middleware req.user:", req.user);
  console.log("👉 getProfile - req.user.id:", req.user?.id);

  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ message: 'Non authentifié' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });

  res.json({
    id: user.id,
    firstName: user.firstname,
    lastName: user.lastname,
    email: user.email,
    phone: user.phone,
    role: user.role,
    accountNumber: user.accountNumber,
    is_verified: user.is_verified,
    is_approved: user.is_approved,
    kycVerified: user.kyc_verified,
    joinDate: user.created_at,
    two_factor_enabled: user.two_factor_enabled,
    email_notifications_enabled: user.email_notifications_enabled,
    sms_notifications_enabled: user.sms_notifications_enabled
  });
};

// ✅ Vérifier si email existe
exports.checkEmail = async (req, res) => {
  const email = req.query.email;
  if (!email) return res.status(400).json({ message: 'Email requis' });

  const user = await User.findByEmail(email);
  res.json({ exists: !!user });
};

// ✅ Confirmer email
exports.confirmEmail = async (req, res) => {
  const token = req.query.token;
  
  if (!token) {
    return res.status(400).json({ 
      success: false,
      message: 'Token manquant' 
    });
  }

  // console.log('🔑 Token reçu:', token);
  // console.log('🔑 Longueur du token:', token.length);

  try {
    // Solution robuste avec TRIM et comparaison exacte
    const { rows } = await db.query(
      `SELECT id FROM users 
       WHERE TRIM(email_verification_token) = $1
       LIMIT 1`,
      [token.trim()]
    );

    if (rows.length === 0) {
      // Debug avancé - Trouver des correspondances partielles
      const similarTokens = await db.query(
        `SELECT id, email, email_verification_token 
         FROM users 
         WHERE email_verification_token LIKE '%' || $1 || '%'`,
        [token.substring(0, 10)]
      );
      console.log('🔍 Tokens similaires:', similarTokens.rows);

      return res.status(400).json({ 
        success: false,
        message: 'Lien invalide ou expiré' 
      });
    }

    const userId = rows[0].id;

    // Mise à jour atomique
    await db.query(
      `UPDATE users 
       SET is_verified = true,
           email_verification_token = NULL
       WHERE id = $1`,
      [userId]
    );

    res.json({ 
      success: true,
      message: 'Email confirmé avec succès' 
    });

  } catch (err) {
    console.error('Erreur confirmation email:', err);
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur' 
    });
  }
};

// ✅ Renvoi confirmation
exports.resendConfirmation = async (req, res) => {
  const userId = req.user?.sub;
  if (!userId) return res.status(401).json({ message: 'Non authentifié' });

  const user = await User.findById(userId);
  if (!user) return res.status(404).json({ message: 'Utilisateur non trouvé' });
  if (user.is_verified) return res.status(400).json({ message: 'Email déjà confirmé' });

  const newToken = crypto.randomBytes(32).toString('hex');
  await db.query(`UPDATE users SET email_verification_token = $1 WHERE id = $2`, [newToken, user.id]);
  await mailer.sendVerificationEmail(user.email, newToken);

  res.json({ message: 'Email de confirmation renvoyé' });
};

// ✅ Vérification KYC
exports.verifyKYC = async (req, res) => {
  try {
    await User.verifyKYC(req.user.sub);
    res.json({ success: true, message: 'KYC vérifié avec succès' });
  } catch (err) {
    console.error('Erreur KYC:', err);
    res.status(500).json({ success: false, error: 'Échec de la vérification KYC' });
  }
};

// ✅ Réinitialisation mot de passe (étape 1)
exports.forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: 'Email requis' });

  try {
    console.log('📩 Requête forgot-password reçue pour :', email);

    const user = await User.findByEmail(email);
    console.log('👤 Utilisateur trouvé ?', user);

    if (!user) {
      console.warn('🔎 Aucun utilisateur avec cet email');
      return res.json({ message: 'Si cet email est valide, un lien a été envoyé.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiration = new Date(Date.now() + 60 * 60 * 1000);
    console.log('🔐 Token généré:', token);

    await db.query(`
      UPDATE users
      SET reset_password_token = $1, reset_password_expires = $2
      WHERE id = $3
    `, [token, expiration, user.id]);
    console.log('📦 Token stocké en base de données');

    const resetUrl = `http://localhost:4200/reset-password?token=${token}`;
    console.log('🔗 Lien reset :', resetUrl);

    await mailer.sendPasswordResetEmail(user.email, resetUrl);
    console.log('✉️ Email envoyé');

    res.json({ message: 'Si cet email est valide, un lien a été envoyé.' });

  } catch (err) {
    console.error('❌ Erreur dans forgotPassword:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// ✅ Étape 2 - Réinitialiser le mot de passe avec le token
exports.resetPassword = async (req, res) => {
  const { token, newPassword } = req.body;

  if (!token || !newPassword) {
    return res.status(400).json({ error: 'Token ou mot de passe manquant' });
  }

  try {
    const user = await User.findByResetToken(token);

    if (!user) {
      return res.status(400).json({ error: 'Token invalide ou expiré' });
    }

    const userId = user.id;

    const oldHash = user.password_hash;
    console.log('🔑 Ancien hash :', oldHash);

    await User.updatePassword(userId, newPassword);

    const updatedUser = await User.findById(userId);
    console.log('🔐 Nouveau hash :', updatedUser.password_hash);

    // Nettoyage du token et date d’expiration
    await db.query(
      'UPDATE users SET reset_password_token = NULL, reset_password_expires = NULL WHERE id = $1',
      [userId]
    );

    res.json({ message: 'Mot de passe réinitialisé avec succès' });
  } catch (err) {
    console.error('Erreur lors de la réinitialisation du mot de passe :', err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: 'Non authentifié' });
    }

    // Données envoyées depuis le frontend
    const { firstName, lastName, email, phone } = req.body;

    // Vérifier si l'utilisateur existe
    const { rows: existing } = await db.query(
      'SELECT id, email FROM users WHERE id = $1',
      [userId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ message: 'Utilisateur non trouvé' });
    }

    // Vérifier unicité de l'email
    if (email && email !== existing[0].email) {
      const { rows: dup } = await db.query(
        'SELECT id FROM users WHERE email = $1 AND id != $2',
        [email, userId]
      );
      if (dup.length > 0) {
        return res
          .status(400)
          .json({ message: 'Cet email est déjà utilisé par un autre compte.' });
      }
    }

    // Mise à jour avec les noms exacts des colonnes en minuscules
    const { rows } = await db.query(
      `UPDATE users SET
         firstname  = COALESCE($1, firstname),
         lastname   = COALESCE($2, lastname),
         email      = COALESCE($3, email),
         phone      = COALESCE($4, phone),
         updated_at = NOW()
       WHERE id = $5
       RETURNING id, firstname, lastname, email, phone,
                 username, role, is_verified,
                 two_factor_enabled,
                 email_notifications_enabled,
                 sms_notifications_enabled,
                 created_at, updated_at`,
      [firstName, lastName, email, phone, userId]
    );

    if (rows.length === 0) {
      return res.status(500).json({ message: 'Échec de la mise à jour du profil' });
    }

    const u = rows[0];
    res.json({
      message: 'Profil mis à jour avec succès',
      user: {
        id: u.id,
        firstName: u.firstname,
        lastName: u.lastname,
        email: u.email,
        phone: u.phone,
        username: u.username,
        role: u.role,
        is_verified: u.is_verified,
        two_factor_enabled: u.two_factor_enabled,
        email_notifications_enabled: u.email_notifications_enabled,
        sms_notifications_enabled: u.sms_notifications_enabled,
        created_at: u.created_at,
        updated_at: u.updated_at
      }
    });
  } catch (err) {
    console.error('❌ updateProfile error:', err);
    res.status(500).json({ message: 'Erreur serveur', error: err.message });
  }
};
