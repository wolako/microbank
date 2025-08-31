exports.calculateInstallment = (amount, interestRate, termMonths) => {
  const monthlyRate = interestRate / 100 / 12;
  const installment =
    (amount * monthlyRate * Math.pow(1 + monthlyRate, termMonths)) /
    (Math.pow(1 + monthlyRate, termMonths) - 1);
  return parseFloat(installment.toFixed(2));
};
