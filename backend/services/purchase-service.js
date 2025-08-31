const Purchase = require('../models/Purchase');
const Transaction = require('../models/Transaction');
const Accounts = require('../models/Accounts');

async function makePurchase(data) {
  const { userId, accountId, amount, merchantName, productName, description } = data;

  // Vérifier le solde
  const balance = await Transaction.getBalance(userId);
  if (balance < amount) {
    const error = new Error('Solde insuffisant');
    error.status = 400;
    throw error;
  }

  const balanceAfter = balance - amount;

  // Créer l'achat
  const purchase = await Purchase.create({
    userId,
    accountId,
    amount,
    merchantName,
    productName,
    description,
    status: 'completed'
  });

  // Créer la transaction correspondante
  await Transaction.create({
    userId,
    accountId,
    amount: -amount,
    type: 'purchase',
    channel: 'online',
    description: `Achat: ${productName} chez ${merchantName}`,
    status: 'completed',
    balanceAfter
  });

  // Mettre à jour le solde du compte
  await Accounts.updateBalance(accountId, balanceAfter);

  return purchase;
}

module.exports = {
  makePurchase
};
