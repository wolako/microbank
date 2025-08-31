module.exports = (req, res, next) => {
  if (!req.user?.is_approved) {
    return res.status(403).json({
      message: "Votre compte est en attente de validation par un gestionnaire. Veuillez patienter.",
    });
  }
  next();
};
