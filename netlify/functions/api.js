// Un'unica Netlify Function che espone tutta l'API REST di tappy
// (stesse rotte del vecchio server Express+SQLite, ma dati su Airtable).
//
// Ogni utente è identificato dal suo codice frupas (header x-frupas-code):
// è quel codice, non un id interno Airtable, a comparire come "UserId"
// nelle righe di Categories/Cards/Transactions.
const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
const db = require("./lib/airtable");

const app = express();
app.use(cors());
app.use(express.json());

// Normalizza il path indipendentemente da come Netlify invoca la funzione
// (via redirect "/api/*" o chiamata diretta "/.netlify/functions/api/*").
app.use((req, _res, next) => {
  req.url = req.url.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
  if (!req.url.startsWith("/")) req.url = "/" + req.url;
  next();
});

const router = express.Router();

function frupasCodeFromRequest(req) {
  // Header dedicato, con fallback a query string ?code=... (comodo per URL
  // da Comandi Rapidi) e al vecchio nome x-api-key per compatibilità.
  return req.header("x-frupas-code") || req.query.code || req.header("x-api-key");
}

async function resolveUser(req) {
  return db.getUserByFrupasCode(frupasCodeFromRequest(req));
}

function withUser(handler) {
  return async (req, res) => {
    try {
      const user = await resolveUser(req);
      if (!user) return res.status(401).json({ error: "invalid or missing frupas code" });
      await handler(req, res, user);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  };
}

// ---------- users / settings ----------
router.get("/me", withUser(async (req, res, user) => res.json(user)));

router.patch(
  "/me",
  withUser(async (req, res, user) => res.json(await db.updateUser(user.id, req.body)))
);

// ---------- categories ----------
router.get(
  "/categories",
  withUser(async (req, res, user) => res.json(await db.listCategories(user.code)))
);

router.post(
  "/categories",
  withUser(async (req, res, user) => {
    if (!req.body.name) return res.status(400).json({ error: "name required" });
    res.status(201).json(await db.createCategory(user.code, req.body));
  })
);

router.patch(
  "/categories/:id",
  withUser(async (req, res, user) => {
    const cat = await db.getCategory(req.params.id);
    if (!cat || cat.user_id !== user.code) return res.status(404).json({ error: "not found" });
    if (cat.is_default && cat.name === "Altro" && req.body.name) {
      return res.status(400).json({ error: "cannot rename Altro" });
    }
    res.json(await db.updateCategory(cat.id, req.body));
  })
);

router.delete(
  "/categories/:id",
  withUser(async (req, res, user) => {
    const cat = await db.getCategory(req.params.id);
    if (!cat || cat.user_id !== user.code) return res.status(404).json({ error: "not found" });
    if (cat.is_default) return res.status(400).json({ error: "cannot delete default category" });
    const categories = await db.listCategories(user.code);
    const fallback = categories.find((c) => c.name === "Altro");
    await db.reassignTransactionsCategory(user.code, cat.id, fallback.id);
    await db.deleteCategory(cat.id);
    res.status(204).end();
  })
);

// ---------- cards ----------
router.get(
  "/cards",
  withUser(async (req, res, user) => res.json(await db.listCards(user.code)))
);

router.post(
  "/cards",
  withUser(async (req, res, user) => {
    if (!req.body.name) return res.status(400).json({ error: "name required" });
    res.status(201).json(await db.createCard(user.code, req.body.name));
  })
);

// ---------- transactions ----------
router.get(
  "/transactions",
  withUser(async (req, res, user) => {
    const { from, to } = req.query;
    res.json(await db.listTransactions(user.code, { from, to }));
  })
);

router.post(
  "/transactions",
  withUser(async (req, res, user) => {
    const { amount, name } = req.body;
    if (amount === undefined || !name) {
      return res.status(400).json({ error: "amount and name required" });
    }
    let categoryId = req.body.category_id;
    if (!categoryId) {
      const categories = await db.listCategories(user.code);
      categoryId = (categories.find((c) => c.name === "Altro") || {}).id;
    }
    const tx = await db.createTransaction(user.code, { ...req.body, category_id: categoryId });
    res.status(201).json(tx);
  })
);

router.patch(
  "/transactions/:id",
  withUser(async (req, res, user) => {
    const tx = await db.getTransaction(req.params.id, user.code);
    if (!tx) return res.status(404).json({ error: "not found" });
    res.json(await db.updateTransaction(tx.id, req.body));
  })
);

router.delete(
  "/transactions/:id",
  withUser(async (req, res, user) => {
    const tx = await db.getTransaction(req.params.id, user.code);
    if (!tx) return res.status(404).json({ error: "not found" });
    await db.deleteTransaction(tx.id);
    res.status(204).end();
  })
);

// ---------- Apple Pay Shortcut webhook ----------
// L'automazione Comandi Rapidi "Alla ricezione di una notifica" fa la POST
// qui, con l'header x-frupas-code impostato sul codice frupas dell'utente:
// la spesa viene salvata su Transactions con quello stesso codice.
router.post("/webhook/applepay", async (req, res) => {
  try {
    const user = await db.getUserByFrupasCode(frupasCodeFromRequest(req));
    if (!user) return res.status(401).json({ error: "invalid frupas code" });

    const { amount, name, card, category, date, time, note } = req.body;
    if (amount === undefined || !name) {
      return res.status(400).json({ error: "amount and name required" });
    }

    let cardId;
    if (card) {
      const existing = await db.findCardByName(user.code, card);
      cardId = existing ? existing.id : (await db.createCard(user.code, card)).id;
    }

    let categoryId;
    if (category) {
      const cat = await db.findOrCreateCategory(user.code, category);
      categoryId = cat ? cat.id : undefined;
    } else {
      const categories = await db.listCategories(user.code);
      categoryId = (categories.find((c) => c.name === "Altro") || {}).id;
    }

    const tx = await db.createTransaction(user.code, {
      amount,
      my_share: amount,
      name,
      card_id: cardId,
      category_id: categoryId,
      source: "applepay",
      is_income: false,
      note,
      date,
      time,
    });
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.use(router);

module.exports.handler = serverless(app);
