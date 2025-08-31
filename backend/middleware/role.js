module.exports = function requireRole(roles = []) {
  return (req, res, next) => {
    console.log('🛂 [requireRole] Rôle utilisateur:', req.user?.role, '| Rôles autorisés:', roles);

    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        message: 'Accès refusé : rôle insuffisant'
      });
    }
    next();
  };
};
