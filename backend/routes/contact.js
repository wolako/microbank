const express = require('express');
const router = express.Router();
const db = require('../config/db');
const nodemailer = require('nodemailer');

// Nodemailer avec Gmail
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// POST /api/contacts
router.post('/', async (req, res) => {
  const { name, email, subject, message } = req.body;

  if (!name || !email || !subject || !message) {
    return res.status(400).json({ error: 'Tous les champs sont obligatoires.' });
  }

  try {
    // Enregistrement dans la table contacts
    const result = await db.query(
      `INSERT INTO contacts (name, email, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, created_at`,
      [name, email, subject, message]
    );

    // Notification admin
    await transporter.sendMail({
      from: `"MicroBank Contact" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER, // admin
      subject: `Nouveau message: ${subject}`,
      text: `Nom: ${name}\nEmail: ${email}\nSujet: ${subject}\nMessage: ${message}`,
    });

    // Confirmation client
    await transporter.sendMail({
      from: `"MicroBank" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Votre message a été reçu',
      text: `Bonjour ${name},\n\nMerci pour votre message. Nous reviendrons vers vous rapidement.\n\nCordialement,\nMicroBank`,
    });

    res.status(201).json({ message: 'Message envoyé avec succès', contactId: result.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

module.exports = router;
