// require('dotenv').config();
// const express = require('express');
// const path = require('path');
// const cors = require('cors');
// const helmet = require('helmet');
// const db = require('./config/db');
// const seedAdmin = require('./seedAdmin');
// const { errorHandler } = require('./middleware/error');
// const { startScheduler } = require('./services/scheduler');

// // Routes
// const billRoutes = require('./routes/bills');
// const webhookRoutes = require('./routes/webhook');
// const purchaseRoutes = require('./routes/purchase');
// const twoFARoutes = require('./routes/2faRoutes');
// const documentsRoutes = require('./routes/documents');

// const app = express();

// // =======================
// // Middleware
// // =======================

// // Sécurité des headers HTTP
// app.use(helmet());

// // CORS
// app.use(cors({
//   origin: process.env.FRONTEND_URL || '*',
//   credentials: true
// }));

// // Parsing JSON et URL encoded
// app.use(express.json({ limit: '5mb' }));
// app.use(express.urlencoded({ extended: true }));

// // Logger simple
// app.use((req, res, next) => {
//   console.log(`${req.method} ${req.path}`);
//   next();
// });

// // =======================
// // Routes API
// // =======================
// app.use('/api', require('./routes/api'));
// app.use('/api/users', require('./routes/users'));
// app.use('/api/accounts', require('./routes/accounts'));
// app.use('/api/transactions', require('./routes/transactions'));
// app.use('/api/admin', require('./routes/admin'));
// app.use('/api/loans', require('./routes/loans'));
// app.use('/api/bills', billRoutes);
// app.use('/api/webhooks', webhookRoutes);
// app.use('/api', purchaseRoutes);
// app.use('/api/2fa', twoFARoutes);
// app.use('/api/documents', documentsRoutes);
// app.use('/api/contacts', require('./routes/contact'));

// // =======================
// // Angular / Frontend
// // =======================
// const angularDistPath = path.join(__dirname, 'public');
// app.use(express.static(angularDistPath));

// // Servir Angular pour toutes les routes sauf celles commençant par /api
// app.get(/^\/(?!api).*/, (req, res) => {
//   res.sendFile(path.join(angularDistPath, 'index.html'));
// });

// // =======================
// // Gestion des erreurs
// // =======================
// app.use(errorHandler);

// // =======================
// // Démarrage serveur
// // =======================
// async function startServer() {
//   try {
//     // Test connexion DB
//     await db.query('SELECT 1');

//     // Démarrer le scheduler
//     startScheduler();

//     // Seed admin si nécessaire
//     await seedAdmin();

//     const PORT = process.env.PORT || 3000;
//     app.listen(PORT, () => {
//       console.log(`✅ Serveur Render en production sur le port ${PORT}`);
//     });
//   } catch (err) {
//     console.error('❌ Erreur au démarrage:', err);
//     process.exit(1);
//   }
// }

// startServer();


const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { spawn } = require('child_process');
const db = require('./config/db');
const seedAdmin = require('./seedAdmin');
const { errorHandler } = require('./middleware/error');
const { startScheduler } = require('./services/scheduler');

// Charger dotenv uniquement si on est en dev/local
if (process.env.NODE_ENV !== 'production') {
  require('dotenv').config({ path: path.resolve(__dirname, '.env') });
  console.log('✅ Variables d’environnement chargées depuis .env (mode local)');
}

// Routes
const billRoutes = require('./routes/bills');
const webhookRoutes = require('./routes/webhook');
const purchaseRoutes = require('./routes/purchase');
const twoFARoutes = require('./routes/2faRoutes');
const documentsRoutes = require('./routes/documents');

const app = express();

// =======================
// Middleware
// =======================
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json({ limit: '5mb' }));
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
app.use('/api/contacts', require('./routes/contact'));

// =======================
// Angular / Frontend
// =======================
if (process.env.NODE_ENV === 'production') {
  // En prod → servir Angular buildé
  const angularDistPath = path.join(__dirname, 'public');
  app.use(express.static(angularDistPath));

  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(angularDistPath, 'index.html'));
  });
} else {
  // En dev → proxy vers ng serve
  const angularPort = 4200;
  console.log('🚀 Mode développement : démarrage Angular avec ng serve...');

  const ng = spawn('npx', ['ng', 'serve', '--host', '0.0.0.0', `--port=${angularPort}`], {
    stdio: 'inherit',
    shell: true
  });

  ng.on('close', code => {
    console.log(`❌ ng serve arrêté avec le code ${code}`);
  });
}

// =======================
// Gestion des erreurs
// =======================
app.use(errorHandler);

// =======================
// Démarrage serveur
// =======================
async function startServer() {
  try {
    await db.query('SELECT 1'); // Test DB
    startScheduler(); // Scheduler
    await seedAdmin(); // Admin par défaut

    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
      console.log(`✅ Serveur ${process.env.NODE_ENV || 'local'} lancé sur le port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Erreur au démarrage:', err);
    process.exit(1);
  }
}

startServer();
