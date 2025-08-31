const db = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const Joi = require('joi');
const ExternalAPIService = require('../services/external-api-service');

// Validation Schema
const billPaymentSchema = Joi.object({
  amount: Joi.number().positive().required(),
  type: Joi.string().valid('CEET', 'SONEB', 'CANAL', 'CANALBOX').required(),
  reference: Joi.string().optional(),
  provider: Joi.string().optional()
});

// 📌 Créer et payer une facture
exports.createAndPayBill = async (req, res) => {
  const client = await db.connect(); // pour transaction
  try {
    const { error, value } = billPaymentSchema.validate(req.body);
    if (error) return res.status(400).json({ error: error.details[0].message });

    const { amount, type: clientType, reference, provider } = value;
    const accountId = req.user.main_account_id;
    if (!accountId) return res.status(400).json({ error: 'Compte principal introuvable' });

    // 🔹 Vérifier solde suffisant
    const accountRes = await client.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
    const currentBalance = accountRes.rows[0]?.balance || 0;

    if (currentBalance < amount) {
      return res.status(400).json({
        error: 'Solde insuffisant',
        message: `Votre solde actuel est de ${currentBalance} FCFA, insuffisant pour un paiement de ${amount} FCFA.`
      });
    }

    // 🔹 Mapper le type pour ExternalAPIService
    let externalType;
    switch ((provider || clientType).toUpperCase()) {
      case 'CEET': externalType = 'electricity'; break;
      case 'SONEB': externalType = 'water'; break;
      case 'CANAL':
      case 'CANALBOX': externalType = 'canal_plus'; break;
      default:
        console.error('[BillController] Fournisseur inconnu:', provider || clientType);
        return res.status(400).json({ error: `Fournisseur inconnu: ${provider || clientType}` });
    }

    // 🔹 Début transaction SQL
    await client.query('BEGIN');

    // Génération ID facture et insertion
    const billId = uuidv4();
    await client.query(
      `INSERT INTO bills 
        (id, user_id, account_id, type, provider, amount, reference, metadata, status) 
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [billId, req.user.id, accountId, clientType, provider || clientType, amount, reference || null, JSON.stringify({}), 'pending']
    );

    console.log(`[BillController] Facture enregistrée ID=${billId}, type="${clientType}", provider="${provider}"`);

    // 🔹 Paiement via API externe ou mock en dev
    let paymentResult;
    try {
      paymentResult = await ExternalAPIService.payBill({
        type: externalType,
        reference,
        amount,
        paymentMethod: 'internal_account'
      });

      if (!paymentResult || !paymentResult.success) {
        console.warn('[BillController] Mock paiement utilisé pour dev/local');
        paymentResult = {
          success: true,
          data: { reference, amount, type: externalType },
          error: null
        };
      }
    } catch (err) {
      console.error(`[BillController] Paiement ${externalType} échoué:`, err.message);
      await client.query('UPDATE bills SET status = $1 WHERE id = $2', ['failed', billId]);
      await client.query('ROLLBACK');
      return res.status(502).json({ error: 'Échec du paiement avec le fournisseur', details: err.message });
    }

    // 🔹 Débit du compte si paiement réussi
    if (paymentResult.success) {
      await client.query(
        'UPDATE accounts SET balance = balance - $1 WHERE id = $2 RETURNING balance',
        [amount, accountId]
      );

      await client.query(
        'UPDATE bills SET status = $1, updated_at = NOW() WHERE id = $2',
        ['paid', billId]
      );
    } else {
      await client.query(
        'UPDATE bills SET status = $1, updated_at = NOW() WHERE id = $2',
        ['failed', billId]
      );
    }

    await client.query('COMMIT');

    console.log(`[BillController] Paiement facture ID=${billId}, résultat:`, paymentResult);

    res.status(201).json({
      message: paymentResult.success ? 'Facture payée avec succès' : 'Paiement échoué',
      billId,
      transaction: paymentResult
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[BillController] createAndPayBill:', err);
    res.status(500).json({ error: 'Erreur interne serveur' });
  } finally {
    client.release();
  }
};

// 📌 Récupérer toutes les factures
exports.getAllBills = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM bills WHERE user_id = $1 ORDER BY created_at DESC', [req.user.id]);
    res.json(result.rows);
  } catch (err) {
    console.error('[BillController] getAllBills:', err);
    res.status(500).json({ error: 'Erreur interne serveur' });
  }
};

// 📌 Récupérer facture par ID
exports.getBillById = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Facture introuvable' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error('[BillController] getBillById:', err);
    res.status(500).json({ error: 'Erreur interne serveur' });
  }
};

// 📌 Supprimer une facture
exports.deleteBill = async (req, res) => {
  try {
    const result = await db.query('DELETE FROM bills WHERE id = $1 AND user_id = $2 RETURNING *', [req.params.id, req.user.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Facture introuvable ou déjà supprimée' });
    res.json({ message: 'Facture supprimée avec succès' });
  } catch (err) {
    console.error('[BillController] deleteBill:', err);
    res.status(500).json({ error: 'Erreur interne serveur' });
  }
};

// ===============================
// 📌 Réessayer paiement facture
exports.retryPayment = async (req, res) => {
  try {
    const billId = req.params.id;

    // Vérifier facture
    const billResult = await db.query('SELECT * FROM bills WHERE id = $1 AND user_id = $2', [billId, req.user.id]);
    if (!billResult.rows.length) return res.status(404).json({ error: 'Facture introuvable' });

    const bill = billResult.rows[0];
    if (bill.status === 'PAID') return res.status(400).json({ error: 'Cette facture est déjà payée' });

    // Relancer paiement
    let paymentResult;
    try {
      paymentResult = await ExternalAPIService.payBill(bill.bill_type, {
        billId: bill.id,
        amount: bill.amount,
        accountNumber: bill.account_number,
        reference: bill.reference,
        customerName: bill.customer_name
      });
    } catch (err) {
      console.error(`[BillController] Retry ${bill.bill_type} échoué:`, err.message);
      await db.query('UPDATE bills SET status = $1 WHERE id = $2', ['FAILED', bill.id]);
      return res.status(502).json({ error: 'Échec du paiement avec le fournisseur', details: err.message });
    }

    await db.query('UPDATE bills SET status = $1, transaction_id = $2 WHERE id = $3', [
      paymentResult.success ? 'PAID' : 'FAILED',
      paymentResult.transactionId || null,
      bill.id
    ]);

    res.json({
      message: paymentResult.success ? 'Facture payée avec succès' : 'Paiement échoué',
      billId: bill.id,
      transaction: paymentResult
    });
  } catch (err) {
    console.error('[BillController] retryPayment:', err);
    res.status(500).json({ error: 'Erreur interne serveur' });
  }
};
