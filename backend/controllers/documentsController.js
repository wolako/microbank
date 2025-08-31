const db = require('../config/db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4, validate: validateUUID } = require('uuid');

const UPLOAD_DIR = path.join(__dirname, '../uploads/documents');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// --------------------
// Ajouter un document
// --------------------
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier uploadé' });
    }

    if (!req.user || !validateUUID(req.user.id)) {
      return res.status(400).json({ message: 'ID utilisateur invalide' });
    }

    const { filename, originalname, mimetype, size } = req.file;

    const result = await db.query(
      `INSERT INTO documents (user_id, filename, original_name, mime_type, size)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user.id, filename, originalname, mimetype, size]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Erreur upload document:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// --------------------
// Récupérer les documents d’un utilisateur
// --------------------
exports.getDocuments = async (req, res) => {
  try {
    if (!req.user || !validateUUID(req.user.id)) {
      return res.status(400).json({ message: 'ID utilisateur invalide' });
    }

    const result = await db.query(
      `SELECT id, filename, original_name, mime_type, size, created_at
       FROM documents
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error('Erreur récupération documents:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// --------------------
// Supprimer un document
// --------------------
exports.deleteDocument = async (req, res) => {
  try {
    const docId = req.params.id;

    if (!validateUUID(docId)) {
      return res.status(400).json({ message: 'ID document invalide' });
    }
    if (!req.user || !validateUUID(req.user.id)) {
      return res.status(400).json({ message: 'ID utilisateur invalide' });
    }

    // Vérifier que le document existe et appartient à l'utilisateur
    const doc = await db.query(
      'SELECT filename FROM documents WHERE id = $1 AND user_id = $2',
      [docId, req.user.id]
    );

    if (!doc.rows.length) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    // Supprimer le fichier physique
    const filePath = path.join(UPLOAD_DIR, doc.rows[0].filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Supprimer l'entrée DB
    await db.query('DELETE FROM documents WHERE id = $1', [docId]);
    res.json({ message: 'Document supprimé avec succès' });
  } catch (err) {
    console.error('Erreur suppression document:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};

// --------------------
// Télécharger un document
// --------------------
exports.downloadDocument = async (req, res) => {
  try {
    const docId = req.params.id;

    if (!validateUUID(docId)) {
      return res.status(400).json({ message: 'ID document invalide' });
    }
    if (!req.user || !validateUUID(req.user.id)) {
      return res.status(400).json({ message: 'ID utilisateur invalide' });
    }

    const doc = await db.query(
      `SELECT filename, original_name, mime_type
       FROM documents
       WHERE id = $1 AND user_id = $2`,
      [docId, req.user.id]
    );

    if (!doc.rows.length) {
      return res.status(404).json({ message: 'Document introuvable' });
    }

    const filePath = path.join(UPLOAD_DIR, doc.rows[0].filename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Fichier introuvable' });
    }

    res.setHeader('Content-Disposition', `attachment; filename="${doc.rows[0].original_name}"`);
    res.setHeader('Content-Type', doc.rows[0].mime_type);
    res.sendFile(filePath);
  } catch (err) {
    console.error('Erreur téléchargement document:', err);
    res.status(500).json({ message: 'Erreur serveur' });
  }
};
