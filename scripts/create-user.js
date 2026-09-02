require('dotenv').config();
const { pool } = require('../src/db');
const { generateCode, hashCode } = require('../src/token');

async function main() {
  const name = process.argv[2];

  if (!name) {
    console.error('Uso: npm run create-user -- "Nome Utente"');
    process.exit(1);
  }

  const code = generateCode();
  await pool.query('INSERT INTO users (name, code_hash) VALUES ($1, $2)', [name, hashCode(code)]);

  console.log(`Utente "${name}" creato.`);
  console.log('Codice frupass (mostrato una sola volta, consegnalo all\'utente):');
  console.log(code);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
