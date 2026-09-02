import express from "express";
import cors from "cors";
import { randomUUID } from "crypto";
import { db, seedUser } from "./db";

const app = express();
app.use(cors());
app.use(express.json());

const defaultUser = seedUser("Me") as any;

function getUserByApiKey(key: string | undefined) {
  if (!key) return null;
  return db.prepare("SELECT * FROM users WHERE api_key = ?").get(key) as any;
}

// Resolve the acting user: header x-api-key, else the single default user (single-tenant local app)
function resolveUser(req: express.Request): any {
  const key = req.header("x-api-key");
  if (key) {
    const u = getUserByApiKey(key);
    if (u) return u;
  }
  return db.prepare("SELECT * FROM users WHERE id = ?").get(defaultUser.id);
}

// ---------- users / settings ----------
app.get("/api/me", (req, res) => {
  const user = resolveUser(req);
  res.json(user);
});

app.patch("/api/me", (req, res) => {
  const user = resolveUser(req);
  const { theme, monthly_budget, name } = req.body;
  db.prepare(
    "UPDATE users SET theme = COALESCE(?, theme), monthly_budget = COALESCE(?, monthly_budget), name = COALESCE(?, name) WHERE id = ?"
  ).run(theme ?? null, monthly_budget ?? null, name ?? null, user.id);
  res.json(db.prepare("SELECT * FROM users WHERE id = ?").get(user.id));
});

// ---------- categories ----------
app.get("/api/categories", (req, res) => {
  const user = resolveUser(req);
  res.json(
    db
      .prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY sort_order")
      .all(user.id)
  );
});

app.post("/api/categories", (req, res) => {
  const user = resolveUser(req);
  const { name, color, icon, budget } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const id = randomUUID();
  const maxOrder = (
    db
      .prepare("SELECT MAX(sort_order) as m FROM categories WHERE user_id = ?")
      .get(user.id) as any
  ).m ?? -1;
  db.prepare(
    "INSERT INTO categories (id, user_id, name, color, icon, is_default, sort_order, budget) VALUES (?,?,?,?,?,0,?,?)"
  ).run(id, user.id, name, color || "#39ff88", icon || "circle", maxOrder + 1, budget ?? null);
  res.status(201).json(db.prepare("SELECT * FROM categories WHERE id = ?").get(id));
});

app.patch("/api/categories/:id", (req, res) => {
  const user = resolveUser(req);
  const cat = db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
    .get(req.params.id, user.id) as any;
  if (!cat) return res.status(404).json({ error: "not found" });
  if (cat.is_default && cat.name === "Altro" && req.body.name)
    return res.status(400).json({ error: "cannot rename Altro" });
  const { name, color, icon, budget } = req.body;
  db.prepare(
    `UPDATE categories SET
      name = COALESCE(?, name),
      color = COALESCE(?, color),
      icon = COALESCE(?, icon),
      budget = CASE WHEN ? THEN ? ELSE budget END
     WHERE id = ?`
  ).run(
    name ?? null,
    color ?? null,
    icon ?? null,
    Object.prototype.hasOwnProperty.call(req.body, "budget") ? 1 : 0,
    budget ?? null,
    cat.id
  );
  res.json(db.prepare("SELECT * FROM categories WHERE id = ?").get(cat.id));
});

app.delete("/api/categories/:id", (req, res) => {
  const user = resolveUser(req);
  const cat = db
    .prepare("SELECT * FROM categories WHERE id = ? AND user_id = ?")
    .get(req.params.id, user.id) as any;
  if (!cat) return res.status(404).json({ error: "not found" });
  if (cat.is_default) return res.status(400).json({ error: "cannot delete default category" });
  const fallback = db
    .prepare("SELECT id FROM categories WHERE user_id = ? AND name = 'Altro'")
    .get(user.id) as any;
  db.prepare("UPDATE transactions SET category_id = ? WHERE category_id = ?").run(
    fallback.id,
    cat.id
  );
  db.prepare("DELETE FROM categories WHERE id = ?").run(cat.id);
  res.status(204).end();
});

// ---------- cards ----------
app.get("/api/cards", (req, res) => {
  const user = resolveUser(req);
  res.json(db.prepare("SELECT * FROM cards WHERE user_id = ?").all(user.id));
});

app.post("/api/cards", (req, res) => {
  const user = resolveUser(req);
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const id = randomUUID();
  db.prepare("INSERT INTO cards (id, user_id, name) VALUES (?,?,?)").run(id, user.id, name);
  res.status(201).json(db.prepare("SELECT * FROM cards WHERE id = ?").get(id));
});

// ---------- transactions ----------
app.get("/api/transactions", (req, res) => {
  const user = resolveUser(req);
  const { from, to } = req.query as { from?: string; to?: string };
  let sql = "SELECT * FROM transactions WHERE user_id = ?";
  const params: any[] = [user.id];
  if (from) {
    sql += " AND date >= ?";
    params.push(from);
  }
  if (to) {
    sql += " AND date <= ?";
    params.push(to);
  }
  sql += " ORDER BY date DESC, time DESC, created_at DESC";
  res.json(db.prepare(sql).all(...params));
});

function findOrCreateCategory(userId: string, name: string) {
  const existing = db
    .prepare("SELECT * FROM categories WHERE user_id = ? AND lower(name) = lower(?)")
    .get(userId, name) as any;
  if (existing) return existing;
  return db
    .prepare("SELECT * FROM categories WHERE user_id = ? AND name = 'Altro'")
    .get(userId) as any;
}

app.post("/api/transactions", (req, res) => {
  const user = resolveUser(req);
  const {
    amount,
    my_share,
    name,
    date,
    time,
    card_id,
    category_id,
    is_income,
    note,
    source,
  } = req.body;

  if (amount === undefined || !name) {
    return res.status(400).json({ error: "amount and name required" });
  }

  const id = randomUUID();
  const finalDate = date || new Date().toISOString().slice(0, 10);
  const finalTime = time || new Date().toISOString().slice(11, 16);
  const finalCategory =
    category_id ||
    (db.prepare("SELECT id FROM categories WHERE user_id = ? AND name = 'Altro'").get(
      user.id
    ) as any).id;

  db.prepare(
    `INSERT INTO transactions
      (id, user_id, date, time, amount, my_share, name, card_id, category_id, source, is_income, note, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(
    id,
    user.id,
    finalDate,
    finalTime,
    amount,
    my_share ?? amount,
    name,
    card_id ?? null,
    finalCategory,
    source || "manual",
    is_income ? 1 : 0,
    note ?? null,
    new Date().toISOString()
  );

  res.status(201).json(db.prepare("SELECT * FROM transactions WHERE id = ?").get(id));
});

app.patch("/api/transactions/:id", (req, res) => {
  const user = resolveUser(req);
  const tx = db
    .prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?")
    .get(req.params.id, user.id) as any;
  if (!tx) return res.status(404).json({ error: "not found" });
  const { amount, my_share, name, date, time, card_id, category_id, note, is_income } = req.body;
  db.prepare(
    `UPDATE transactions SET
      amount = COALESCE(?, amount),
      my_share = COALESCE(?, my_share),
      name = COALESCE(?, name),
      date = COALESCE(?, date),
      time = COALESCE(?, time),
      card_id = COALESCE(?, card_id),
      category_id = COALESCE(?, category_id),
      note = COALESCE(?, note),
      is_income = COALESCE(?, is_income)
     WHERE id = ?`
  ).run(
    amount ?? null,
    my_share ?? null,
    name ?? null,
    date ?? null,
    time ?? null,
    card_id ?? null,
    category_id ?? null,
    note ?? null,
    is_income === undefined ? null : is_income ? 1 : 0,
    tx.id
  );
  res.json(db.prepare("SELECT * FROM transactions WHERE id = ?").get(tx.id));
});

app.delete("/api/transactions/:id", (req, res) => {
  const user = resolveUser(req);
  const tx = db
    .prepare("SELECT * FROM transactions WHERE id = ? AND user_id = ?")
    .get(req.params.id, user.id) as any;
  if (!tx) return res.status(404).json({ error: "not found" });
  db.prepare("DELETE FROM transactions WHERE id = ?").run(tx.id);
  res.status(204).end();
});

// ---------- Apple Pay Shortcut webhook ----------
// The iOS Shortcut POSTs here with header x-api-key: <user api key>
// Body: { amount, name, card, category, date?, time? }
app.post("/api/webhook/applepay", (req, res) => {
  const user = getUserByApiKey(req.header("x-api-key"));
  if (!user) return res.status(401).json({ error: "invalid api key" });

  const { amount, name, card, category, date, time, note } = req.body;
  if (amount === undefined || !name) {
    return res.status(400).json({ error: "amount and name required" });
  }

  let cardRow = card
    ? (db
        .prepare("SELECT * FROM cards WHERE user_id = ? AND lower(name) = lower(?)")
        .get(user.id, card) as any)
    : null;
  if (card && !cardRow) {
    const cardId = randomUUID();
    db.prepare("INSERT INTO cards (id, user_id, name) VALUES (?,?,?)").run(cardId, user.id, card);
    cardRow = { id: cardId };
  }

  const categoryRow = category
    ? findOrCreateCategory(user.id, category)
    : (db.prepare("SELECT id FROM categories WHERE user_id = ? AND name = 'Altro'").get(
        user.id
      ) as any);

  const id = randomUUID();
  const now = new Date();
  db.prepare(
    `INSERT INTO transactions
      (id, user_id, date, time, amount, my_share, name, card_id, category_id, source, is_income, note, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,'applepay',0,?,?)`
  ).run(
    id,
    user.id,
    date || now.toISOString().slice(0, 10),
    time || now.toISOString().slice(11, 16),
    amount,
    amount,
    name,
    cardRow?.id ?? null,
    categoryRow.id,
    note ?? null,
    now.toISOString()
  );

  res.status(201).json(db.prepare("SELECT * FROM transactions WHERE id = ?").get(id));
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`tappy server listening on :${PORT}`);
  console.log(`Default user api key: ${defaultUser.api_key}`);
});
