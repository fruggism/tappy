// Un'unica Netlify Function che espone tutta l'API REST di tappy
// (stesse rotte del vecchio server Express+SQLite, ma dati su Airtable).
//
// Ogni utente è identificato dal suo codice Fru Pass (header x-frupas-code):
// è quel codice, non un id interno Airtable, a comparire come "UserId"
// nelle righe di Categories/Cards/Transactions.
//
// Il codice viene **verificato presso l'ecosistema Fru Pass** (POST /auth/login
// e /auth/refresh, vedi lib/frupass.js), mai qui: un utente esiste nella nostra
// base Airtable solo perché almeno una volta l'endpoint condiviso ha confermato
// il suo codice. Le rotte dati si limitano quindi a cercarlo in Airtable, e la
// revoca di un codice viene intercettata dal refresh periodico del client.
const express = require("express");
const cors = require("cors");
const serverless = require("serverless-http");
const db = require("./lib/airtable");
const { verifyFruPass, canonicalCode } = require("./lib/frupass");

const app = express();
app.use(cors());
app.use(express.json());

// Attraverso serverless-http il corpo della richiesta arriva come Buffer, che
// express.json lascia intatto: senza questo, ogni rotta riceve un Buffer al
// posto dell'oggetto e risponde "campo mancante". Non si nota provando
// l'app Express direttamente — solo passando dal gestore, cioe' come gira
// davvero su Netlify.
app.use((req, _res, next) => {
  if (Buffer.isBuffer(req.body) || typeof req.body === "string") {
    const grezzo = req.body.toString("utf8").trim();
    try {
      req.body = grezzo ? JSON.parse(grezzo) : {};
    } catch {
      req.body = {};
    }
  }
  if (!req.body) req.body = {};
  next();
});

// Normalizza il path indipendentemente da come Netlify invoca la funzione
// (via redirect "/api/*" o chiamata diretta "/.netlify/functions/api/*").
app.use((req, _res, next) => {
  req.url = req.url.replace(/^\/\.netlify\/functions\/api/, "").replace(/^\/api/, "") || "/";
  if (!req.url.startsWith("/")) req.url = "/" + req.url;
  next();
});

const router = express.Router();

// Solo l'header. Niente ?code=... in query string: metterebbe la credenziale
// dell'intero ecosistema Fru Pass negli URL, nella cronologia e nei log.
function frupasCodeFromRequest(req) {
  return canonicalCode(req.header("x-frupas-code"));
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

// ---------- autenticazione Fru Pass ----------
// Il client manda qui il codice; noi lo facciamo verificare all'ecosistema e,
// solo se è valido, restituiamo (creandolo al primo accesso) l'utente tappy.
function handleAuth(action) {
  return async (req, res) => {
    try {
      const code = canonicalCode(req.body && req.body.code);
      if (!code) return res.status(400).json({ error: "Codice mancante" });

      let profile;
      try {
        profile = await verifyFruPass(code, action);
      } catch (err) {
        // Ecosistema irraggiungibile: è un guasto temporaneo, non un codice
        // sbagliato. Il client non deve cancellare la sessione salvata.
        console.error("Fru Pass irraggiungibile:", err);
        return res.status(503).json({ error: "Fru Pass non raggiungibile, riprova" });
      }

      if (!profile) return res.status(401).json({ error: "Codice non riconosciuto" });

      const user = await db.provisionUser(profile);
      res.json({ profile, user });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "internal error" });
    }
  };
}

router.post("/auth/login", handleAuth("login"));
router.post("/auth/refresh", handleAuth("refresh"));

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
// L'automazione dell'iPhone (Comandi Rapidi → Automazione), che scatta da sé
// alla notifica di pagamento Apple Pay, fa la POST qui con l'header x-api-key:
// è l'api key interna di tappy, leggibile in Impostazioni. NON si usa il
// codice Fru Pass — è la credenziale dell'intero ecosistema.
router.post("/webhook/applepay", async (req, res) => {
  try {
    const user = await db.getUserByApiKey(req.header("x-api-key"));
    if (!user) return res.status(401).json({ error: "invalid api key" });

    const { amount, name, card, category, date, time, note, lat, lon } = req.body;
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
      // L'automazione le manda solo se è riuscita a leggere la posizione e se
      // l'utente non l'ha disattivata: qui non sono mai obbligatorie.
      lat: Number(lat),
      lon: Number(lon),
    });
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

app.use(router);

module.exports.handler = serverless(app);
// Esportata anche l'app nuda, così si può testare senza simulare un evento Lambda.
module.exports.app = app;
