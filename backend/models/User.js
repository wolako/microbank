const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { sendVerificationEmail } = require('../utils/mailer');

class User {
  // 🔒 Création d'un nouvel utilisateur
  static async create({
    firstName,
    lastName,
    email,
    phone,
    password,
    confirmPassword,
    username = null,
    role = 'user',
    isSystemCreated = false,
    email_verification_token = null
    }) {
    const errors = [];

    if (!firstName || firstName.length < 2) errors.push('Prénom invalide');
    if (!lastName || lastName.length < 2) errors.push('Nom invalide');
    if (username && username.length < 3) errors.push('Nom d’utilisateur trop court (min 3 caractères)');

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Email invalide');
    if (!/^(\+|00)?[0-9]{8,15}$/.test(phone)) {
      errors.push('Téléphone invalide');
    }

    if (!/^(?=.*[A-Z])(?=.*[0-9]).{8,}$/.test(password)) {
      errors.push('Mot de passe faible : 8 caractères, une majuscule, un chiffre');
    }

    if (errors.length > 0) throw new Error(errors.join(' | '));

    if (phone.startsWith('00')) phone = '+' + phone.slice(2);
    else if (!phone.startsWith('+')) phone = '+228' + phone;

    const hashedPassword = await this.hashPassword(password);
    const autoVerifiedRoles = ['admin', 'loan_officer', 'account_manager', 'support', 'auditor', 'compliance'];
    const is_verified = isSystemCreated || autoVerifiedRoles.includes(role);
    
    if (!email_verification_token) {
      email_verification_token = crypto.randomBytes(32).toString('hex');
    }
    console.log('🔑 Token généré:', email_verification_token);

    const client = await db.connect();

    try {
      await client.query('BEGIN');

      const userRes = await client.query(
        `INSERT INTO users (
          firstName, lastName, email, phone,
          password_hash, kyc_verified,
          is_verified, email_verification_token,
          username, role
        )
        VALUES ($1, $2, $3, $4, $5, false, $6, $7, $8, $9)
        RETURNING id, firstName, lastName, email, phone, created_at, username, role, is_verified, email_verification_token`,
        [
          firstName,
          lastName,
          email,
          phone,
          hashedPassword,
          is_verified,
          email_verification_token,
          username,
          role
        ]
      );

      const userId = userRes.rows[0].id;
      const accountNumber = this.generateAccountNumber();

      await client.query(
        `INSERT INTO accounts (user_id, accountNumber, balance, currency, status)
        VALUES ($1, $2, $3, $4, $5)`,
        [userId, accountNumber, 0.00, 'XOF', 'active']
      );

      await client.query('COMMIT');

      // if (!is_verified) {
      //   await sendVerificationEmail(email, email_verification_token);
      // }

      return {
        id: userId,
        firstName: userRes.rows[0].firstname,
        lastName: userRes.rows[0].lastname,
        email: userRes.rows[0].email,
        phone: userRes.rows[0].phone,
        username: userRes.rows[0].username,
        role: userRes.rows[0].role,
        accountNumber,
        is_verified: userRes.rows[0].is_verified,
        email_verification_token: userRes.rows[0].email_verification_token
      };
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        if (err.constraint === 'users_email_key') throw new Error('EMAIL_EXISTS: Email déjà utilisé');
        if (err.constraint === 'users_phone_key') throw new Error('PHONE_EXISTS: Téléphone déjà utilisé');
        if (err.constraint === 'users_username_key') throw new Error('USERNAME_EXISTS: Nom d’utilisateur déjà utilisé');
      }
      console.error('❌ Erreur création utilisateur:', err);
      throw err;
    } finally {
      client.release();
    }
  }

  static async findByLogin(login) {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE username = $1 OR email = $1 LIMIT 1`,
      [login]
    );
    return rows[0];
  }

  static async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT id, firstName, lastName, email, phone, password_hash, kyc_verified, created_at, is_verified
       FROM users WHERE email = $1`,
      [email]
    );
    return rows[0];
  }

  static async verifyPassword(candidatePassword, hashedPassword) {
    return bcrypt.compare(candidatePassword, hashedPassword);
  }

  // static async updatePassword(userId, newPassword) {
  //   const hashedPassword = await this.hashPassword(newPassword);
  //   await db.query(
  //     'UPDATE users SET password_hash = $1 WHERE id = $2',
  //     [hashedPassword, userId]
  //   );
  // }

  // static hashPassword(password) {
  //   return bcrypt.hash(password, 12);
  // }

  static generateAccountNumber() {
    const bankCode = 'MB';
    const branchCode = '001';
    const randomPart = Math.floor(100000 + Math.random() * 900000).toString().padStart(6, '0');
    return `${bankCode}${branchCode}${randomPart}`;
  }

  static generateAuthToken(user) {
    return jwt.sign(
      {
        sub: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        kyc: user.kyc_verified || false
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d', issuer: 'MicroBank API' }
    );
  }

  static async findByEmailOrPhone(value) {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE email = $1 OR phone = $1 LIMIT 1`,
      [value]
    );
    return rows[0];
  }

  static async findByResetToken(token) {
    const now = new Date();
    const result = await db.query(
      'SELECT * FROM users WHERE reset_password_token = $1 AND reset_password_expires > $2',
      [token, now]
    );
    return result.rows[0];
  }

  static async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }
  
  /**
 * Met à jour le mot de passe + optionnellement le timestamp password_updated_at
 * @param {number} userId
 * @param {string} newPassword
 * @param {{touchUpdatedAt?: boolean}} options
 */

  static async updatePassword(userId, newPassword, options = {}) {
    const { touchUpdatedAt = false } = options;
    const hashedPassword = await this.hashPassword(newPassword);

    if (touchUpdatedAt) {
      await db.query(
        'UPDATE users SET password_hash = $1, password_updated_at = NOW() WHERE id = $2',
        [hashedPassword, userId]
      );
    } else {
      await db.query(
        'UPDATE users SET password_hash = $1 WHERE id = $2',
        [hashedPassword, userId]
      );
    }
  }

  static async findById(id) {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * ✅ Crédite un compte utilisateur par son téléphone
   */
  static async creditUserBalanceByPhone(phone, amount, reference) {
    const { rows } = await db.query(`
      SELECT a.id as account_id, u.id as user_id, a.balance 
      FROM users u
      JOIN accounts a ON u.id = a.user_id
      WHERE u.phone = $1
    `, [phone]);

    if (rows.length === 0) throw new Error('Utilisateur introuvable');

    const { account_id, user_id, balance } = rows[0];
    const newBalance = parseFloat(balance) + parseFloat(amount);

    await db.query(`UPDATE accounts SET balance = $1 WHERE id = $2`, [newBalance, account_id]);

    await db.query(`
      INSERT INTO transactions (user_id, account_id, amount, type, reference, status, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      user_id,
      account_id,
      amount,
      'deposit_mobile',
      reference,
      'success',
      'mobile_money'
    ]);
  }

  /**
 * ✅ Crédite un compte utilisateur par son ID
 */
  static async creditUserBalance(userId, amount, reference = null, channel = 'stripe') {
    const { rows } = await db.query(`
      SELECT id AS account_id, balance 
      FROM accounts 
      WHERE user_id = $1
    `, [userId]);

    if (rows.length === 0) throw new Error('Compte utilisateur introuvable');

    const { account_id, balance } = rows[0];
    const newBalance = parseFloat(balance) + parseFloat(amount);

    // 💰 Mise à jour du solde
    await db.query(`
      UPDATE accounts SET balance = $1 WHERE id = $2
    `, [newBalance, account_id]);

    // 🧾 Enregistrement de la transaction
    await db.query(`
      INSERT INTO transactions (user_id, account_id, amount, type, reference, status, channel)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId,
      account_id,
      amount,
      'deposit_card',
      reference,
      'success',
      channel
    ]);
  }

  /**
 * ✅ Approuve un utilisateur manuellement (gestionnaire)
 */
  static async approve(userId) {
    const { rowCount } = await db.query(
      'UPDATE users SET is_approved = true WHERE id = $1',
      [userId]
    );
    if (rowCount === 0) throw new Error("Utilisateur non trouvé ou déjà approuvé");
  }

}

module.exports = User;
