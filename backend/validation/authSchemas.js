// const Joi = require('@hapi/joi');
const Joi = require('joi');

const passwordSchema = Joi.string()
  .min(8)
  .pattern(new RegExp('^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])'))
  .required()
  .messages({
    'string.pattern.base': 'Le mot de passe doit contenir au moins une minuscule, une majuscule et un chiffre',
    'string.min': 'Le mot de passe doit contenir au moins 8 caractères'
  });

const phonePattern = /^(\+|00)?[0-9]{8,15}$/;

module.exports = {
  register: Joi.object({
    firstName: Joi.string()
      .required()
      .pattern(/^[a-zA-ZÀ-ÿ -]+$/)
      .messages({
        'string.pattern.base': 'Le prénom ne doit contenir que des lettres',
        'any.required': 'Le prénom est obligatoire'
      }),
    lastName: Joi.string()
      .required()
      .pattern(/^[a-zA-ZÀ-ÿ -]+$/)
      .messages({
        'string.pattern.base': 'Le nom ne doit contenir que des lettres',
        'any.required': 'Le nom est obligatoire'
      }),
    email: Joi.string()
      .email()
      .required()
      .messages({
        'string.email': 'Email invalide',
        'any.required': 'Email obligatoire'
      }),
    phone: Joi.string()
      .pattern(phonePattern)
      .required()
      .messages({
        'string.pattern.base': 'Numéro de téléphone invalide. Format accepté : +228XXXXXXXX, 00228XXXXXXXX ou 09XXXXXXXX',
        'any.required': 'Téléphone obligatoire'
      }),
    password: passwordSchema,
    confirmPassword: Joi.string()
      .valid(Joi.ref('password'))
      .required()
      .messages({
        'any.only': 'Les mots de passe ne correspondent pas',
        'any.required': 'Confirmation du mot de passe obligatoire'
      })
  }).with('password', 'confirmPassword'),

  login: Joi.object({
    email: Joi.string().email().messages({
      'string.email': 'Email invalide'
    }),
    login: Joi.string()
      .pattern(/^[a-zA-Z0-9@._-]+$/)
      .min(3)
      .messages({
        'string.pattern.base': 'Le login doit être alphanumérique ou une adresse email',
        'string.min': 'Le login doit contenir au moins 3 caractères'
      }),
    password: Joi.string().required().messages({
      'any.required': 'Mot de passe requis'
    })
  }).xor('email', 'login')
    .messages({
      'object.missing': 'Vous devez fournir soit un email soit un login.'
    })
};
