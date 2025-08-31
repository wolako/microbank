require('dotenv').config();
const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const db = require('./config/db');
const seedAdmin = require('./seedAdmin');
const { errorHandler } = require('./middleware/error');
const { startScheduler } = require('./services/scheduler');
const billRoutes = require('./routes/bills');
const webhookRoutes = require('./routes/webhook');
const purchaseRoutes = require('./routes/purchase');
const twoFARoutes = require('./routes/2faRoutes');
const documentsRoutes = require('./routes/documents');

const app = express();


// ✅ Sécurité des headers HTTP
app.use(helmet());

// ✅ CORS
app.use(cors({
  // origin: 'http://localhost:4200',
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

// ✅ Parsing
app.use(express.json({ limit: '50kb' }));
app.use(express.urlencoded({ extended: true }));

// ✅ Logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// ✅ Routes
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


// ✅ Fichiers Angular
// app.use(express.static(path.join(__dirname, 'dist', 'site-microfinance')));
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, 'dist', 'site-microfinance', 'index.html'));
// });

const angularDistPath = path.join(__dirname, '../dist/site-microfinance');
app.use(express.static(angularDistPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(angularDistPath, 'index.html'));
});

// ✅ Erreurs
app.use(errorHandler);

// ✅ Démarrage serveur
async function startServer() {
  try {
    await db.query('SELECT 1');
    startScheduler();
    await seedAdmin();

    const PORT = process.env.PORT || 3000;
    // app.listen(PORT, () => console.log(`✅ Serveur sur http://localhost:${PORT}`));
    app.listen(PORT, () => console.log(`✅ Serveur Render en production sur le port ${PORT}`));
  } catch (err) {
    console.error('❌ Erreur au démarrage:', err);
    process.exit(1);
  }
}

startServer();
