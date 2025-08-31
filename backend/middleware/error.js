class ApiError extends Error {
  constructor(statusCode, message, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

const errorHandler = (err, req, res, next) => {
  console.error(err.stack);

  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: {
        message: err.message,
        code: err.statusCode,
        details: err.details
      }
    });
  }

  // Erreurs de validation Joi
  if (err.name === 'ValidationError') {
    return res.status(422).json({
      error: {
        message: 'Erreur de validation',
        details: err.details
      }
    });
  }

  // Erreur JWT
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      error: {
        message: 'Token invalide'
      }
    });
  }

  res.status(500).json({
    error: {
      message: 'Erreur serveur'
    }
  });
};

module.exports = {
  ApiError,
  errorHandler
};