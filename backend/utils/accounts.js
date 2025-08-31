function generateRIB() {
  // Génère un RIB numérique aléatoire de 12 à 15 chiffres
  const length = Math.floor(Math.random() * 4) + 12; // entre 12 et 15
  let rib = '';
  for (let i = 0; i < length; i++) {
    rib += Math.floor(Math.random() * 10);
  }
  return rib;
}

function generateIBAN(rib) {
  // Format simple d'IBAN pour test : TG + clé + MF + RIB
  return `TG76MF${rib}`;
}

module.exports = { generateRIB, generateIBAN };
