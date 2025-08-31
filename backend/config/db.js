const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  connectionTimeoutMillis: 5000,
  idleTimeoutMillis: 30000,
  max: 20,
  ssl: false,
});

let poolEnded = false;

pool.on('connect', () => console.log('🔌 Connexion DB établie'));
pool.on('error', (err) => console.error('❌ Erreur du pool PostgreSQL:', err));

module.exports = {
  query: (text, params) => pool.query(text, params),

  connect: async () => {
    const client = await pool.connect();
    console.log('✅ Client PostgreSQL obtenu');
    return client;
  },

  end: async () => {
    if (!poolEnded) {
      poolEnded = true;
      console.log('🧯 Fermeture du pool PostgreSQL...');
      try {
        await pool.end();
        console.log('✅ Pool PostgreSQL fermé.');
      } catch (err) {
        console.error('⚠️ Erreur lors de pool.end():', err);
        // On ne rethrow pas, pour éviter un unhandled rejection
      }
    } else {
      console.log('ℹ️ pool.end() déjà appelé, on ignore.');
    }
  }
};
