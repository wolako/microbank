const Joi = require('@hapi/joi');

exports.validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });

    if (error) {
      return res.status(400).json({
        message: 'Erreur de validation',
        details: error.details.map(detail => detail.message)
      });
    }

    next();
  };
};
