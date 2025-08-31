const bcrypt = require('bcrypt');
const db = require('./config/db');
const { v4: uuidv4 } = require('uuid');

async function seedAdmin() {
  try {
    const adminUsername = 'admin';
    const password = 'AdminSecure123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const adminId = uuidv4();

    const { rows } = await db.query('SELECT * FROM users WHERE username = $1', [adminUsername]);

    if (rows.length === 0) {
      await db.query(`
        INSERT INTO users (id, username, email, firstName, lastName, password_hash, role, is_verified, phone)
        VALUES ($1, $2, $3, 'Super', 'Admin', $4, 'admin', true)
      `, [adminId, adminUsername, 'admin@example.com', hashedPassword, 90000000]);

      await db.query(`
        INSERT INTO accounts (id, user_id, accountNumber)
        VALUES ($1, $2, $3)
      `, [uuidv4(), adminId, 'ADM00000001']);

      console.log(`✅ Admin créé avec identifiant : ${adminUsername}`);
    } else {
      console.log('ℹ️ Admin déjà existant');
    }
  } catch (err) {
    console.error('❌ Erreur création admin :', err);
  }
}

module.exports = seedAdmin;
