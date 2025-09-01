require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/db');
const seedAdmin = require('./seedAdmin');
const { errorHandler } = require('./middleware/error');
const { startScheduler } = require('./services/scheduler');

// Routes
const billRoutes = require('./routes/bills');
const webhookRoutes = require('./routes/webhook');
const purchaseRoutes = require('./routes/purchase');
const twoFARoutes = require('./routes/2faRoutes');
const documentsRoutes = require('./routes/documents');

const app = express();

// Forcer UTF-8 pour toutes les réponses JSON
app.use((req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// =======================
// Middleware
// =======================

// Sécurité des headers HTTP
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));

// Parsing JSON et URL encoded
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true }));

// Logger simple
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// =======================
// Routes API
// =======================
app.use('/api', require('./routes/api'));
app.use('/api/users', require('./routes/users'));
app.use('/api/accounts', require('./routes/accounts'));
app.use('/api/transactions', require('./routes/transactions'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api/loans', require('./routes/loans'));
app.use('/api/bills', billRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api', purchaseRoutes);
app.use('/api/2fa', twoFARoutes);
app.use('/api/documents', documentsRoutes);

// =======================
// Angular / Frontend
// =======================
const angularDistPath = path.join(__dirname, 'public');
app.use(express.static(angularDistPath));

// Servir Angular pour toutes les routes sauf celles commençant par /api
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

// =======================
// Gestion des erreurs
// =======================
app.use(errorHandler);

// =======================
// Démarrage serveur
// =======================
async function startServer() {
  try {
    // Test connexion DB
    await db.query('SELECT 1');

    // Démarrer le scheduler
    startScheduler();

    // Seed admin si nécessaire
    await seedAdmin();

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Serveur Render en production sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erreur au démarrage:', err);
    process.exit(1);
  }
}

startServer();
