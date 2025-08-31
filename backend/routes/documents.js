const express = require('express');
const router = express.Router();
const documentsController = require('../controllers/documentsController');
const multer = require('multer');
const path = require('path');
const authMiddleware = require('../middleware/auth');

// Config Multer pour l’upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads/documents'));
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});
const upload = multer({ storage });

// Routes protégées
router.get('/', authMiddleware, documentsController.getDocuments);
router.post('/', authMiddleware, upload.single('document'), documentsController.uploadDocument);
router.delete('/:id', authMiddleware, documentsController.deleteDocument);
router.get('/:id/download', authMiddleware, documentsController.downloadDocument);

module.exports = router;
