import Database from "better-sqlite3";
import path from "path";
import { randomUUID } from "crypto";

const dbPath = path.join(__dirname, "..", "tappy.db");
export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  api_key TEXT UNIQUE NOT NULL,
  theme TEXT NOT NULL DEFAULT 'system',
  monthly_budget REAL NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  color TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'circle',
  is_default INTEGER NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  date TEXT NOT NULL,
  time TEXT,
  amount REAL NOT NULL,
  my_share REAL NOT NULL,
  name TEXT NOT NULL,
  card_id TEXT REFERENCES cards(id),
  category_id TEXT NOT NULL REFERENCES categories(id),
  source TEXT NOT NULL DEFAULT 'manual',
  is_income INTEGER NOT NULL DEFAULT 0,
  note TEXT,
  created_at TEXT NOT NULL
);
`);

export function seedUser(name: string) {
  const existing = db.prepare("SELECT * FROM users WHERE name = ?").get(name) as any;
  if (existing) return existing;

  const id = randomUUID();
  const apiKey = randomUUID().replace(/-/g, "");
  db.prepare(
    "INSERT INTO users (id, name, api_key, theme, monthly_budget, created_at) VALUES (?,?,?,?,?,?)"
  ).run(id, name, apiKey, "system", 800, new Date().toISOString());

  const defaults = [
    { name: "Spesa", color: "#39ff88", icon: "cart" },
    { name: "Macchina", color: "#00e5ff", icon: "car" },
    { name: "Leisure", color: "#ff2ecb", icon: "sparkles" },
    { name: "Altro", color: "#a3a3ff", icon: "dots" },
  ];
  defaults.forEach((c, i) => {
    db.prepare(
      "INSERT INTO categories (id, user_id, name, color, icon, is_default, sort_order) VALUES (?,?,?,?,?,1,?)"
    ).run(randomUUID(), id, c.name, c.color, c.icon, i);
  });

  db.prepare("INSERT INTO cards (id, user_id, name) VALUES (?,?,?)").run(
    randomUUID(),
    id,
    "Carta principale"
  );

  return db.prepare("SELECT * FROM users WHERE id = ?").get(id);
}
