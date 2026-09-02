const express = require('express');
const { pool } = require('../db');

const router = express.Router();

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// Tutte le rotte qui sotto richiedono req.user (impostato da requireAuth in server.js)
// e filtrano SEMPRE per user_id, cosi' ogni utente vede solo le proprie spese.

router.post('/', asyncHandler(async (req, res) => {
  const { amount, description, category } = req.body || {};
  const parsedAmount = Number(amount);

  if (!amount || Number.isNaN(parsedAmount) || parsedAmount <= 0) {
    return res.status(400).json({ error: 'Il campo "amount" deve essere un numero positivo.' });
  }

  const { rows } = await pool.query(
    `INSERT INTO expenses (user_id, amount, description, category)
     VALUES ($1, $2, $3, $4)
     RETURNING id, amount, description, category, created_at`,
    [req.user.id, parsedAmount, description || '', category || 'generale']
  );

  res.status(201).json(rows[0]);
}));

router.get('/', asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  const { rows } = await pool.query(
    `SELECT id, amount, description, category, created_at
     FROM expenses
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [req.user.id, limit]
  );

  res.json(rows);
}));

router.get('/summary', asyncHandler(async (req, res) => {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS count
     FROM expenses
     WHERE user_id = $1
       AND date_trunc('month', created_at) = date_trunc('month', now())`,
    [req.user.id]
  );

  res.json({ month_total: Number(rows[0].total), month_count: Number(rows[0].count) });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const { rowCount } = await pool.query(
    'DELETE FROM expenses WHERE id = $1 AND user_id = $2',
    [req.params.id, req.user.id]
  );

  if (rowCount === 0) {
    return res.status(404).json({ error: 'Spesa non trovata.' });
  }

  res.status(204).end();
}));

module.exports = router;
