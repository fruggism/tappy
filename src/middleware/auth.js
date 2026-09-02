const { pool } = require('../db');
const { hashCode } = require('../token');

async function requireAuth(req, res, next) {
  try {
    const header = req.get('Authorization') || '';
    const match = header.match(/^Bearer\s+(.+)$/i);
    const code = match ? match[1].trim() : req.query.code;

    if (!code) {
      return res.status(401).json({ error: 'Codice frupass mancante. Usa "Authorization: Bearer <codice>".' });
    }

    const { rows } = await pool.query('SELECT id, name FROM users WHERE code_hash = $1', [hashCode(code)]);
    const user = rows[0];

    if (!user) {
      return res.status(401).json({ error: 'Codice frupass non valido.' });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = { requireAuth };
