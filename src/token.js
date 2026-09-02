const crypto = require('crypto');

// Alfabeto senza caratteri ambigui (niente 0/O, 1/I/L) per codici facili da leggere e digitare.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function generateCode() {
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  }
  return code;
}

// Normalizza il codice inserito dall'utente (spazi, minuscole, trattini) prima di verificarlo.
function normalizeCode(code) {
  return String(code || '').trim().toUpperCase().replace(/[\s-]/g, '');
}

function hashCode(code) {
  return crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');
}

module.exports = { generateCode, normalizeCode, hashCode };
