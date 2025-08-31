// Générateur simple de RIB (non officiel, mais unique et stable)
function generateLegacyRIB(userId) {
  const prefix = 'TG53';
  const padded = String(userId).padStart(10, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `${prefix}MFB${padded}${random}`;
}

module.exports = { generateLegacyRIB };
