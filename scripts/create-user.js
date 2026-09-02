require('dotenv').config();
const { pool } = require('../src/db');
const { generateToken, hashToken } = require('../src/token');

async function main() {
  const name = process.argv[2];

  if (!name) {
    console.error('Uso: npm run create-user -- "Nome Utente"');
    process.exit(1);
  }

  const token = generateToken();
  await pool.query('INSERT INTO users (name, token_hash) VALUES ($1, $2)', [name, hashToken(token)]);

  console.log(`Utente "${name}" creato.`);
  console.log('Token (mostrato una sola volta, salvalo in un posto sicuro):');
  console.log(token);

  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
