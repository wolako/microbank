const Joi = require('@hapi/joi');

const phonePattern = /^(\+|00)?[0-9]{8,15}$/;

const metadataCommon = {
  phone: Joi.string().pattern(phonePattern).optional().messages({
    'string.pattern.base': 'Numéro de téléphone invalide'
  }),
  provider: Joi.string().optional(),
  paymentMethod: Joi.string().valid('carte', 'mobile_money', 'especes', 'autre').optional()
};

// 🟢 Transaction générale (valide tout)
const transactionSchema = Joi.object({
  type: Joi.string().valid(
  'deposit_mobile', 'deposit_card', 'deposit_manual', 'deposit_wire',
  'withdrawal_mobile', 'withdrawal_card', 'withdrawal_atm',
  'transfer', 'bill_payment', 'purchase'
).required(),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  recipient: Joi.string().optional(),
  description: Joi.string().allow('').optional(),
  metadata: Joi.object(metadataCommon).optional()
});

// 🟡 Retrait Mobile Money
const retraitMobileMoneySchema = Joi.object({
  type: Joi.string().valid('retrait').required(),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  description: Joi.string().allow('').optional(),
  metadata: Joi.object({
    phone: Joi.string().pattern(phonePattern).required().messages({
      'string.pattern.base': 'Numéro de téléphone invalide'
    }),
    provider: Joi.string().required(),
    paymentMethod: Joi.string().valid('mobile_money').required()
  }).required()
});

// 🔵 Retrait guichet (espèces)
const retraitGuichetSchema = Joi.object({
  type: Joi.string().valid('retrait').required(),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  description: Joi.string().allow('').optional(),
  metadata: Joi.object({
    paymentMethod: Joi.string().valid('especes').required()
  }).required()
});

// 🟠 Retrait par carte
const retraitCarteSchema = Joi.object({
  type: Joi.string().valid('retrait').required(),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  description: Joi.string().allow('').optional(),
  metadata: Joi.object({
    paymentMethod: Joi.string().valid('carte').required(),
    cardNumber: Joi.string().creditCard().required().messages({
      'string.creditCard': 'Numéro de carte invalide',
      'any.required': 'Numéro de carte requis'
    }),
    cardHolderName: Joi.string().required().messages({
      'any.required': 'Nom du titulaire de la carte requis'
    }),
    expiryDate: Joi.string().pattern(/^(0[1-9]|1[0-2])\/?([0-9]{2})$/).required().messages({
      'string.pattern.base': "Date d'expiration invalide, format MM/AA",
      'any.required': "Date d'expiration requise"
    }),
    cvv: Joi.string().pattern(/^[0-9]{3,4}$/).required().messages({
      'string.pattern.base': 'CVV invalide',
      'any.required': 'CVV requis'
    })
  }).required()
});

// 🟣 Dépôt par carte
const depotCarteSchema = Joi.object({
  type: Joi.string().valid('depot').required(),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  description: Joi.string().allow('').optional(),
  metadata: Joi.object({
    paymentMethod: Joi.string().valid('carte').required()
  }).required()
});

// 🔴 Dépôt Mobile Money
const depotMobileMoneySchema = Joi.object({
  type: Joi.string().valid('depot').required(),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  description: Joi.string().allow('').optional(),
  metadata: Joi.object({
    phone: Joi.string().pattern(phonePattern).required().messages({
      'string.pattern.base': 'Numéro de téléphone invalide'
    }),
    provider: Joi.string().required(),
    paymentMethod: Joi.string().valid('mobile_money').required()
  }).required()
});

// 🔵 Paiement de facture
const billPaymentSchema = Joi.object({
  billType: Joi.string()
    .valid('water', 'electricity', 'canal_plus', 'canalbox')
    .required()
    .messages({
      'any.required': 'Le type de facture est obligatoire',
      'any.only': 'Type de facture invalide'
    }),
  reference: Joi.string().required().messages({
    'any.required': 'La référence de la facture est obligatoire'
  }),
  amount: Joi.number().positive().required().messages({
    'number.positive': 'Le montant doit être un nombre positif',
    'any.required': 'Le montant est obligatoire'
  }),
  paymentMethod: Joi.string()
    .valid('account', 'mobile_money', 'carte')
    .required()
    .messages({
      'any.required': 'Le mode de paiement est obligatoire',
      'any.only': 'Mode de paiement invalide'
    }),
  metadata: Joi.object().optional()
});


module.exports = {
  transactionSchema,
  retraitMobileMoneySchema,
  retraitGuichetSchema,
  retraitCarteSchema,
  depotCarteSchema,
  depotMobileMoneySchema,
  billPaymentSchema
};
