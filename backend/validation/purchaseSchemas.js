// validation/purchaseSchemas.js
const Joi = require('joi');

const makePurchaseSchema = Joi.object({
  userId: Joi.string().uuid().required(),
  accountId: Joi.string().uuid().required(),
  amount: Joi.number().positive().required(),
  merchantName: Joi.string().max(100).required(),
  productName: Joi.string().max(100).required(),
  description: Joi.string().max(255).optional()
});

module.exports = {
  makePurchaseSchema
};
