const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const transport = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 📧 Email de confirmation d'email
exports.sendVerificationEmail = async (email, token) => {
  // Double protection d'encodage
  const encodedToken = encodeURIComponent(encodeURIComponent(token));
  const url = `${process.env.FRONTEND_URL}/auth/confirm-email?token=${encodedToken}`;
  
  console.log('📩 Lien de confirmation:', url); // À vérifier absolument

  await transport.sendMail({
    from: `"microBank" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Confirmez votre email - Action Requise',
    html: `
      <div style="font-family: Arial, sans-serif;">
        <h2>Confirmation d'email requise</h2>
        <p>Cliquez sur ce bouton pour confirmer :</p>
        <a href="${url}" 
           style="background: #0066cc; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
          Confirmer mon email
        </a>
        <p style="margin-top: 20px;">
          <small>Si le bouton ne fonctionne pas, copiez ce lien :<br>
          <code style="word-break: break-all;">${url}</code></small>
        </p>
      </div>
    `
  });
};

// 📧 Email de notification simple
exports.sendGenericNotification = async (email, subject, message) => {
  await transport.sendMail({
    from: '"microBank Notifications" <no-reply@microbank.com>',
    to: email,
    subject,
    html: `
      <p>${message}</p>
      <p>Merci d'utiliser microBank.</p>
    `
  });
};

// 📧 Envoi des infos du compte avec le RIB/IBAN
exports.sendAccountInfo = async ({ email, firstName, lastName, accountNumber }) => {
  await transport.sendMail({
    from: '"microBank" <no-reply@microbank.com>',
    to: email,
    subject: '🎉 Bienvenue ! Voici vos informations bancaires',
    html: `
      <h2>Bonjour ${firstName} ${lastName},</h2>
      <p>Bienvenue dans notre institution bancaire.</p>
      <p>Votre compte a été créé avec succès.</p>
      <h4>📄 Informations de compte :</h4>
      <ul>
        <li><strong>Nom :</strong> ${firstName} ${lastName}</li>
        <li><strong>Email :</strong> ${email}</li>
        <li><strong>Numéro de compte (RIB) :</strong> <code>${accountNumber}</code></li>
      </ul>
      <p>Conservez ces informations précieusement.</p>
      <p>Merci de votre confiance.</p>
    `
  });
};


exports.sendAccountInfoWithPDF = async ({ email, firstName, lastName, rib, iban }) => {
  // Génère le PDF en mémoire
  const doc = new PDFDocument();
  const bufferStream = new PassThrough();
  let buffers = [];

  doc.on('data', buffers.push.bind(buffers));
  doc.on('end', async () => {
    const pdfBuffer = Buffer.concat(buffers);

    await transport.sendMail({
      from: '"microBank" <no-reply@microbank.com>',
      to: email,
      subject: 'Bienvenue chez microBank - Vos informations de compte',
      html: `
        <p>Bonjour ${firstName} ${lastName},</p>
        <p>Votre compte bancaire a été créé avec succès.</p>
        <p>Vous trouverez ci-joint un document PDF contenant vos informations.</p>
        <p><strong>RIB :</strong> ${rib}</p>
        <p><strong>IBAN :</strong> ${iban}</p>
      `,
      attachments: [{
        filename: 'informations_compte.pdf',
        content: pdfBuffer
      }]
    });
  });

  // Contenu du PDF
  doc.fontSize(16).text('microBank - Informations de compte', { underline: true });
  doc.moveDown();
  doc.fontSize(12).text(`Nom complet : ${firstName} ${lastName}`);
  doc.text(`Email : ${email}`);
  doc.text(`RIB : ${rib}`);
  doc.text(`IBAN : ${iban}`);
  doc.end();
};

exports.sendPasswordResetEmail = async (email, resetUrl) => {
  const subject = 'Réinitialisation de votre mot de passe';
  const html = `
    <p>Bonjour,</p>
    <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
    <p><a href="${resetUrl}">Cliquez ici pour réinitialiser</a> (valable 1 heure)</p>
    <p>Si vous n'avez pas fait cette demande, ignorez simplement ce message.</p>
  `;

  return await transport.sendMail({
    from: '"microBank" <no-reply@microbank.com>',
    to: email,
    subject,
    html
  });

};
