// Layer di accesso dati: parla con Airtable al posto di una query SQL.
// Le 4 tabelle (Users, Categories, Cards, Transactions) rispecchiano lo
// stesso modello dati del vecchio server Express+SQLite (vedi GUIDE.md).
//
// tappy fa parte dell'ecosistema Fru Pass: ogni utente è identificato dal suo
// codice Fru Pass (formato FRU-XXXX-XXXX, non un id interno Airtable), ed è
// questo stesso codice a comparire come UserId nelle righe di
// Categories/Cards/Transactions, così da restare leggibile e portabile anche
// fuori da Airtable.
//
// ATTENZIONE: questa base Airtable è **nostra** e contiene solo i dati di
// tappy. La verifica del codice non avviene qui: passa sempre dall'endpoint
// condiviso dell'ecosistema (vedi lib/frupass.js). Qui il codice arriva già
// verificato.
const crypto = require("crypto");
const Airtable = require("airtable");
const { canonicalCode } = require("./frupass");

function getBase() {
  const apiKey = process.env.AIRTABLE_API_KEY;
  const baseId = process.env.AIRTABLE_BASE_ID;
  if (!apiKey || !baseId) {
    throw new Error("AIRTABLE_API_KEY e AIRTABLE_BASE_ID devono essere impostate");
  }
  return new Airtable({ apiKey }).base(baseId);
}

let _base;
function base() {
  if (!_base) _base = getBase();
  return _base;
}

const table = (name) => base()(name);

// Airtable non permette apostrofi non escapati dentro filterByFormula.
function esc(value) {
  return String(value).replace(/'/g, "\\'");
}

function userFromRecord(r) {
  return {
    id: r.id, // record id Airtable, usato solo per l'update della riga stessa
    code: r.get("FrupasCode"), // identità Fru Pass: è questa a legare le altre tabelle
    api_key: r.get("ApiKey") || null, // segreto interno di tappy, solo per il webhook Apple Pay
    name: r.get("Name"),
    theme: r.get("Theme") || "system",
    monthly_budget: r.get("MonthlyBudget") || 0,
    created_at: r.get("CreatedAt") || null,
  };
}

function categoryFromRecord(r) {
  return {
    id: r.id,
    user_id: r.get("UserId"),
    name: r.get("Name"),
    color: r.get("Color"),
    icon: r.get("Icon") || "circle",
    is_default: r.get("IsDefault") ? 1 : 0,
    sort_order: r.get("SortOrder") || 0,
    budget: r.get("Budget") ?? null,
  };
}

function cardFromRecord(r) {
  return { id: r.id, user_id: r.get("UserId"), name: r.get("Name") };
}

function transactionFromRecord(r) {
  return {
    id: r.id,
    user_id: r.get("UserId"),
    date: r.get("Date"),
    time: r.get("Time") || null,
    amount: r.get("Amount"),
    my_share: r.get("MyShare"),
    name: r.get("Name"),
    card_id: r.get("CardId") || null,
    category_id: r.get("CategoryId"),
    source: r.get("Source") || "manual",
    is_income: r.get("IsIncome") ? 1 : 0,
    note: r.get("Note") || null,
    created_at: r.get("CreatedAt") || null,
  };
}

async function getUserByFrupasCode(code) {
  const normalized = canonicalCode(code);
  if (!normalized) return null;
  const records = await table("Users")
    .select({ filterByFormula: `{FrupasCode} = '${esc(normalized)}'`, maxRecords: 1 })
    .firstPage();
  return records[0] ? userFromRecord(records[0]) : null;
}

// L'api key è il segreto del **webhook Apple Pay**, interno a tappy: non è
// una credenziale d'accesso e non sostituisce mai il codice Fru Pass (che è
// la credenziale dell'intero ecosistema e non va messa in un Comando Rapido).
function generateApiKey() {
  return crypto.randomBytes(24).toString("base64url");
}

async function getUserByApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  if (!key) return null;
  const records = await table("Users")
    .select({ filterByFormula: `{ApiKey} = '${esc(key)}'`, maxRecords: 1 })
    .firstPage();
  return records[0] ? userFromRecord(records[0]) : null;
}

const DEFAULT_CATEGORIES = [
  { name: "Spesa", color: "#39ff88", icon: "cart" },
  { name: "Macchina", color: "#00e5ff", icon: "car" },
  { name: "Leisure", color: "#ff2ecb", icon: "sparkles" },
  { name: "Altro", color: "#a3a3ff", icon: "dots" },
];

/**
 * Recupera l'utente tappy legato a un profilo Fru Pass **già verificato**,
 * creandolo al primo accesso con le 4 categorie di default.
 * Il chiamante deve aver validato il codice presso l'endpoint condiviso:
 * qui non si verifica nulla, si prende atto.
 */
async function provisionUser(profile) {
  const code = canonicalCode(profile.code);
  const existing = await getUserByFrupasCode(code);
  if (existing) {
    // L'api key manca solo sugli utenti creati prima della sua introduzione.
    if (!existing.api_key) {
      const r = await table("Users").update(existing.id, { ApiKey: generateApiKey() });
      return userFromRecord(r);
    }
    return existing;
  }

  const record = await table("Users").create({
    Name: profile.name || "",
    FrupasCode: code,
    ApiKey: generateApiKey(),
    Theme: "system",
    MonthlyBudget: 800,
    CreatedAt: new Date().toISOString(),
  });

  for (let i = 0; i < DEFAULT_CATEGORIES.length; i++) {
    const c = DEFAULT_CATEGORIES[i];
    await table("Categories").create({
      UserId: code,
      Name: c.name,
      Color: c.color,
      Icon: c.icon,
      IsDefault: true,
      SortOrder: i,
    });
  }
  await table("Cards").create({ UserId: code, Name: "Carta principale" });

  return userFromRecord(record);
}

async function updateUser(id, fields) {
  const patch = {};
  if (fields.theme !== undefined) patch.Theme = fields.theme;
  if (fields.monthly_budget !== undefined) patch.MonthlyBudget = fields.monthly_budget;
  if (fields.name !== undefined) patch.Name = fields.name;
  const r = await table("Users").update(id, patch);
  return userFromRecord(r);
}

async function listCategories(userId) {
  const records = await table("Categories")
    .select({
      filterByFormula: `{UserId} = '${esc(userId)}'`,
      sort: [{ field: "SortOrder", direction: "asc" }],
    })
    .all();
  return records.map(categoryFromRecord);
}

async function createCategory(userId, data) {
  const existing = await listCategories(userId);
  const maxOrder = existing.reduce((m, c) => Math.max(m, c.sort_order), -1);
  const fields = {
    UserId: userId,
    Name: data.name,
    Color: data.color || "#39ff88",
    Icon: data.icon || "circle",
    IsDefault: false,
    SortOrder: maxOrder + 1,
  };
  if (data.budget !== undefined && data.budget !== null) fields.Budget = data.budget;
  const r = await table("Categories").create(fields);
  return categoryFromRecord(r);
}

async function getCategory(id) {
  try {
    return categoryFromRecord(await table("Categories").find(id));
  } catch {
    return null;
  }
}

async function updateCategory(id, data) {
  const patch = {};
  if (data.name !== undefined) patch.Name = data.name;
  if (data.color !== undefined) patch.Color = data.color;
  if (data.icon !== undefined) patch.Icon = data.icon;
  if (Object.prototype.hasOwnProperty.call(data, "budget")) {
    patch.Budget = data.budget === null || data.budget === undefined ? null : data.budget;
  }
  const r = await table("Categories").update(id, patch);
  return categoryFromRecord(r);
}

async function deleteCategory(id) {
  await table("Categories").destroy(id);
}

async function findOrCreateCategory(userId, name) {
  const categories = await listCategories(userId);
  const found = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
  if (found) return found;
  return categories.find((c) => c.name === "Altro") || null;
}

async function listCards(userId) {
  const records = await table("Cards")
    .select({ filterByFormula: `{UserId} = '${esc(userId)}'` })
    .all();
  return records.map(cardFromRecord);
}

async function createCard(userId, name) {
  const r = await table("Cards").create({ UserId: userId, Name: name });
  return cardFromRecord(r);
}

async function findCardByName(userId, name) {
  const cards = await listCards(userId);
  return cards.find((c) => c.name.toLowerCase() === name.toLowerCase()) || null;
}

async function listTransactions(userId, { from, to } = {}) {
  let formula = `{UserId} = '${esc(userId)}'`;
  if (from) formula = `AND(${formula}, {Date} >= '${esc(from)}')`;
  if (to) formula = `AND(${formula}, {Date} <= '${esc(to)}')`;
  const records = await table("Transactions")
    .select({
      filterByFormula: formula,
      sort: [
        { field: "Date", direction: "desc" },
        { field: "Time", direction: "desc" },
      ],
    })
    .all();
  return records.map(transactionFromRecord);
}

async function getTransaction(id, userId) {
  try {
    const tx = transactionFromRecord(await table("Transactions").find(id));
    return tx.user_id === userId ? tx : null;
  } catch {
    return null;
  }
}

async function createTransaction(userId, data) {
  const now = new Date();
  const fields = {
    UserId: userId,
    Date: data.date || now.toISOString().slice(0, 10),
    Time: data.time || now.toISOString().slice(11, 16),
    Amount: data.amount,
    MyShare: data.my_share ?? data.amount,
    Name: data.name,
    CategoryId: data.category_id,
    Source: data.source || "manual",
    IsIncome: !!data.is_income,
    CreatedAt: now.toISOString(),
  };
  if (data.card_id) fields.CardId = data.card_id;
  if (data.note) fields.Note = data.note;
  const r = await table("Transactions").create(fields);
  return transactionFromRecord(r);
}

async function updateTransaction(id, data) {
  const patch = {};
  if (data.amount !== undefined) patch.Amount = data.amount;
  if (data.my_share !== undefined) patch.MyShare = data.my_share;
  if (data.name !== undefined) patch.Name = data.name;
  if (data.date !== undefined) patch.Date = data.date;
  if (data.time !== undefined) patch.Time = data.time;
  if (data.card_id !== undefined) patch.CardId = data.card_id;
  if (data.category_id !== undefined) patch.CategoryId = data.category_id;
  if (data.note !== undefined) patch.Note = data.note;
  if (data.is_income !== undefined) patch.IsIncome = !!data.is_income;
  const r = await table("Transactions").update(id, patch);
  return transactionFromRecord(r);
}

async function deleteTransaction(id) {
  await table("Transactions").destroy(id);
}

async function reassignTransactionsCategory(userId, fromCategoryId, toCategoryId) {
  const records = await table("Transactions")
    .select({
      filterByFormula: `AND({UserId} = '${esc(userId)}', {CategoryId} = '${esc(fromCategoryId)}')`,
    })
    .all();
  for (let i = 0; i < records.length; i += 10) {
    const chunk = records
      .slice(i, i + 10)
      .map((r) => ({ id: r.id, fields: { CategoryId: toCategoryId } }));
    if (chunk.length) await table("Transactions").update(chunk);
  }
}

module.exports = {
  getUserByFrupasCode,
  getUserByApiKey,
  provisionUser,
  updateUser,
  listCategories,
  createCategory,
  getCategory,
  updateCategory,
  deleteCategory,
  findOrCreateCategory,
  listCards,
  createCard,
  findCardByName,
  listTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  reassignTransactionsCategory,
};
