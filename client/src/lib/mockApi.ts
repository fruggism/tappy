// Fase 1 — UI indipendente dalle fonti dati reali.
// Stessa interfaccia di realApi.ts, ma tutto vive in localStorage.
// In Fase 2 basterà cambiare l'import in api.ts per puntare al backend vero.
import type { Card, Category, Transaction, User } from "./types";

const STORAGE_KEY = "tappy_mock_db_v1";

interface Db {
  user: User;
  categories: Category[];
  cards: Card[];
  transactions: Transaction[];
}

function uid() {
  return crypto.randomUUID();
}

const DEFAULT_CATEGORIES: Omit<Category, "id" | "user_id">[] = [
  { name: "Spesa", color: "#39ff88", icon: "cart", is_default: 1, sort_order: 0, budget: null },
  { name: "Macchina", color: "#00e5ff", icon: "car", is_default: 1, sort_order: 1, budget: null },
  { name: "Leisure", color: "#ff2ecb", icon: "sparkles", is_default: 1, sort_order: 2, budget: null },
  { name: "Altro", color: "#a3a3ff", icon: "dots", is_default: 1, sort_order: 3, budget: null },
];

const MERCHANTS: Record<string, string[]> = {
  Spesa: ["Esselunga", "Carrefour", "Coop", "Panificio Rossi", "Macelleria Bianchi"],
  Macchina: ["Eni Station", "Autolavaggio", "Parcheggio Centro", "Q8", "Assicurazione"],
  Leisure: ["Bar Roma", "Cinema Odeon", "Spotify", "Ristorante Luna", "Netflix"],
  Altro: ["Farmacia", "Edicola", "Tabaccheria", "Amazon"],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function seed(): Db {
  const userId = uid();
  const user: User = {
    id: userId,
    code: "FRU-MOCK-" + userId.slice(0, 4).toUpperCase(),
    api_key: "mock-api-key",
    name: "Riccardo",
    theme: "system",
    monthly_budget: 800,
    created_at: new Date().toISOString(),
  };

  const categories: Category[] = DEFAULT_CATEGORIES.map((c) => ({
    ...c,
    id: uid(),
    user_id: userId,
  }));

  const cards: Card[] = [
    { id: uid(), user_id: userId, name: "Visa Nova" },
    { id: uid(), user_id: userId, name: "Amex Platinum" },
  ];

  const transactions: Transaction[] = [];
  const today = new Date();
  for (let i = 0; i < 45; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const nPerDay = Math.random() < 0.6 ? 1 : Math.random() < 0.85 ? 2 : 0;
    for (let j = 0; j < nPerDay; j++) {
      const cat = pick(categories);
      const merchant = pick(MERCHANTS[cat.name] ?? MERCHANTS.Altro);
      const amount = Math.round((5 + Math.random() * 90) * 100) / 100;
      const isSplit = Math.random() < 0.12;
      const myShare = isSplit ? Math.round((amount / (Math.random() < 0.5 ? 2 : 3)) * 100) / 100 : amount;
      transactions.push({
        id: uid(),
        user_id: userId,
        date: d.toISOString().slice(0, 10),
        time: `${String(8 + Math.floor(Math.random() * 13)).padStart(2, "0")}:${String(
          Math.floor(Math.random() * 60)
        ).padStart(2, "0")}`,
        amount,
        my_share: myShare,
        name: merchant,
        card_id: pick(cards).id,
        category_id: cat.id,
        source: Math.random() < 0.7 ? "applepay" : "manual",
        is_income: 0,
        note: null,
        created_at: d.toISOString(),
      });
    }
  }
  // un paio di entrate
  for (let i = 0; i < 2; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - (5 + i * 20));
    transactions.push({
      id: uid(),
      user_id: userId,
      date: d.toISOString().slice(0, 10),
      time: "10:00",
      amount: 50,
      my_share: 50,
      name: "Rimborso amico",
      card_id: null,
      category_id: categories[0].id,
      source: "manual",
      is_income: 1,
      note: null,
      created_at: d.toISOString(),
    });
  }

  return { user, categories, cards, transactions };
}

function load(): Db {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed: Db = JSON.parse(raw);
      // migrazione: le categorie salvate prima dell'introduzione del budget
      // per categoria non hanno il campo, lo aggiungiamo come "nessun limite".
      parsed.categories.forEach((c) => {
        if (c.budget === undefined) c.budget = null;
      });
      return parsed;
    } catch {
      // corrupted, reseed
    }
  }
  const db = seed();
  save(db);
  return db;
}

function save(db: Db) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
}

let db = load();

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 120));
}

export const mockApi = {
  me: () => delay(db.user),
  updateMe: (data: Partial<Pick<User, "theme" | "monthly_budget" | "name">>) => {
    db.user = { ...db.user, ...data };
    save(db);
    return delay(db.user);
  },

  categories: () => delay([...db.categories].sort((a, b) => a.sort_order - b.sort_order)),
  createCategory: (data: { name: string; color: string; icon?: string; budget?: number | null }) => {
    const maxOrder = Math.max(-1, ...db.categories.map((c) => c.sort_order));
    const cat: Category = {
      id: uid(),
      user_id: db.user.id,
      name: data.name,
      color: data.color,
      icon: data.icon ?? "circle",
      is_default: 0,
      sort_order: maxOrder + 1,
      budget: data.budget ?? null,
    };
    db.categories.push(cat);
    save(db);
    return delay(cat);
  },
  updateCategory: (id: string, data: Partial<Pick<Category, "name" | "color" | "icon" | "budget">>) => {
    const cat = db.categories.find((c) => c.id === id);
    if (!cat) throw new Error("not found");
    Object.assign(cat, data);
    save(db);
    return delay(cat);
  },
  deleteCategory: (id: string) => {
    const cat = db.categories.find((c) => c.id === id);
    if (!cat || cat.is_default) throw new Error("cannot delete default category");
    const fallback = db.categories.find((c) => c.name === "Altro")!;
    db.transactions.forEach((t) => {
      if (t.category_id === id) t.category_id = fallback.id;
    });
    db.categories = db.categories.filter((c) => c.id !== id);
    save(db);
    return delay(undefined);
  },

  cards: () => delay([...db.cards]),
  createCard: (name: string) => {
    const card: Card = { id: uid(), user_id: db.user.id, name };
    db.cards.push(card);
    save(db);
    return delay(card);
  },

  transactions: (params?: { from?: string; to?: string }) => {
    let list = [...db.transactions];
    if (params?.from) list = list.filter((t) => t.date >= params.from!);
    if (params?.to) list = list.filter((t) => t.date <= params.to!);
    list.sort((a, b) => (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? "")));
    return delay(list);
  },
  createTransaction: (data: Partial<Transaction> & { amount: number; name: string }) => {
    const altro = db.categories.find((c) => c.name === "Altro")!;
    const now = new Date();
    const tx: Transaction = {
      id: uid(),
      user_id: db.user.id,
      date: data.date ?? now.toISOString().slice(0, 10),
      time: data.time ?? now.toISOString().slice(11, 16),
      amount: data.amount,
      my_share: data.my_share ?? data.amount,
      name: data.name,
      card_id: data.card_id ?? null,
      category_id: data.category_id ?? altro.id,
      source: data.source ?? "manual",
      is_income: data.is_income ?? 0,
      note: data.note ?? null,
      created_at: now.toISOString(),
    };
    db.transactions.unshift(tx);
    save(db);
    return delay(tx);
  },
  updateTransaction: (id: string, data: Partial<Transaction>) => {
    const tx = db.transactions.find((t) => t.id === id);
    if (!tx) throw new Error("not found");
    Object.assign(tx, data);
    save(db);
    return delay(tx);
  },
  deleteTransaction: (id: string) => {
    db.transactions = db.transactions.filter((t) => t.id !== id);
    save(db);
    return delay(undefined);
  },

  resetMockData: () => {
    db = seed();
    save(db);
    return delay(undefined);
  },
};

export const API_BASE = "(mock locale — fase 1, nessun server)";
