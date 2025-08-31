/**
 * Calcule un score de crédit basé sur les statistiques de prêts utilisateur
 * @param {Object} stats - Statistiques du prêt
 * @param {number} stats.active_loans - Nombre de prêts actifs
 * @param {number} stats.total_borrowed - Montant total emprunté
 * @param {number} stats.unpaid_installments - Nombre d'échéances impayées
 * @param {number} stats.overdue_loans - Nombre de prêts en retard
 * @param {number} stats.total_interest_paid - Montant total des intérêts payés
 * @returns {number} Score crédit entre 0 et 100
 */
function calculateCreditScore(stats) {
  let score = 100;

  if (stats.active_loans > 3) score -= 30;
  else if (stats.active_loans > 1) score -= 10;

  if (stats.total_borrowed > 10000) score -= 25;
  else if (stats.total_borrowed > 5000) score -= 10;

  if (stats.unpaid_installments > 0) score -= 40;

  if (stats.overdue_loans > 0) score -= 30;

  if (stats.total_interest_paid > 1000) score += 10;
  else if (stats.total_interest_paid > 500) score += 5;

  if (score > 100) score = 100;
  if (score < 0) score = 0;

  return Math.round(score);
}

module.exports = { calculateCreditScore };
