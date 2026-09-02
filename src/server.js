require('dotenv').config();
const path = require('path');
const express = require('express');

const { requireAuth } = require('./middleware/auth');
const expensesRouter = require('./routes/expenses');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.get('/api/me', requireAuth, (req, res) => {
  res.json({ id: req.user.id, name: req.user.name });
});

app.use('/api/expenses', requireAuth, expensesRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Errore interno del server.' });
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Tappy in ascolto sulla porta ${port}`));
