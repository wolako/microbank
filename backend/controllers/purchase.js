// controllers/purchaseController.js
const { makePurchase } = require('../services/purchase-service');
const { makePurchaseSchema } = require('../validation/purchaseSchemas');

exports.makePurchase = async (req, res) => {
  const { error, value } = makePurchaseSchema.validate(req.body);
  if (error) {
    return res.status(400).json({ error: error.details[0].message });
  }

  try {
    const purchase = await makePurchase(value);
    return res.status(201).json({ message: 'Achat effectué avec succès', purchase });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ error: err.message || 'Erreur serveur lors de l’achat' });
  }
};
