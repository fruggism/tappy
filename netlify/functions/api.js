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

// Normalizza il percorso, che cambia a seconda di come si arriva qui:
//
//   /api/auth/login                          sito dedicato, via redirect
//   /tappy/api/auth/login                    dentro l'hub, via redirect
//   /.netlify/functions/tappy-api/auth/login  chiamata diretta alla funzione
//
// Il nome della funzione non è fisso: dentro l'hub è rinominata per non
// collidere con quelle delle altre app. Riconoscerne uno solo faceva
// rispondere 404 a tutto, con l'app che sembrava a posto fino all'accesso.
function normalizzaPercorso(url) {
  return (
    url
      // qualunque nome abbia la funzione
      .replace(/^\/\.netlify\/functions\/[^/?]+/, "")
      // prefisso dell'app dentro l'hub: /tappy/api/...
      .replace(/^\/[A-Za-z0-9_-]+\/api(?=\/|\?|$)/, "")
      // sito dedicato: /api/...
      .replace(/^\/api(?=\/|\?|$)/, "") || "/"
  );
}

app.use((req, _res, next) => {
  req.url = normalizzaPercorso(req.url);
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

// Categoria e carta arrivano dal client come id Airtable: vanno riportati
// all'utente che li manda, o si finisce per appendere una spesa alla
// categoria di qualcun altro. Restituisce l'id se è suo, `undefined` se non
// è stato mandato, e solleva se non gli appartiene.
async function idAltrui(user, categoryId, cardId) {
  if (categoryId) {
    const categorie = await db.listCategories(user.code);
    if (!categorie.some((c) => c.id === categoryId)) return "category_id";
  }
  if (cardId) {
    const carte = await db.listCards(user.code);
    if (!carte.some((c) => c.id === cardId)) return "card_id";
  }
  return null;
}

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
    const estraneo = await idAltrui(user, req.body.category_id, req.body.card_id);
    if (estraneo) return res.status(400).json({ error: `unknown ${estraneo}` });

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
    const estraneo = await idAltrui(user, req.body.category_id, req.body.card_id);
    if (estraneo) return res.status(400).json({ error: `unknown ${estraneo}` });
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

const TIPI_PIANO = new Set(["subscription", "installment", "once"]);
const FREQ_PIANO = new Set(["weekly", "monthly", "everyN"]);

router.get(
  "/plans",
  withUser(async (req, res, user) => res.json(await db.listPlans(user.code)))
);

router.post(
  "/plans",
  withUser(async (req, res, user) => {
    const { name, amount, type, start_date } = req.body;
    if (!name || amount === undefined || !start_date) {
      return res.status(400).json({ error: "name, amount and start_date required" });
    }
    if (type && !TIPI_PIANO.has(type)) return res.status(400).json({ error: "unknown type" });
    if (req.body.frequency && !FREQ_PIANO.has(req.body.frequency)) {
      return res.status(400).json({ error: "unknown frequency" });
    }
    const estraneo = await idAltrui(user, req.body.category_id, req.body.card_id);
    if (estraneo) return res.status(400).json({ error: `unknown ${estraneo}` });
    res.status(201).json(await db.createPlan(user.code, req.body));
  })
);

router.patch(
  "/plans/:id",
  withUser(async (req, res, user) => {
    const piano = await db.getPlan(req.params.id, user.code);
    if (!piano) return res.status(404).json({ error: "not found" });
    if (req.body.type && !TIPI_PIANO.has(req.body.type)) return res.status(400).json({ error: "unknown type" });
    if (req.body.frequency && !FREQ_PIANO.has(req.body.frequency)) {
      return res.status(400).json({ error: "unknown frequency" });
    }
    const estraneo = await idAltrui(user, req.body.category_id, req.body.card_id);
    if (estraneo) return res.status(400).json({ error: `unknown ${estraneo}` });
    res.json(await db.updatePlan(piano.id, req.body));
  })
);

router.delete(
  "/plans/:id",
  withUser(async (req, res, user) => {
    const piano = await db.getPlan(req.params.id, user.code);
    if (!piano) return res.status(404).json({ error: "not found" });
    await db.deletePlan(piano.id);
    res.status(204).end();
  })
);

// ---------- Apple Pay Shortcut webhook ----------
// L'automazione dell'iPhone (Comandi Rapidi → Automazione), che scatta da sé
// alla notifica di pagamento Apple Pay, fa la POST qui con l'header x-api-key:
// è l'api key interna di tappy, leggibile in Impostazioni. NON si usa il
// codice Fru Pass — è la credenziale dell'intero ecosistema.
// Se l'iPhone non è riuscito a leggere la posizione, i campi arrivano vuoti
// — stringa vuota o null, non assenti. `Number("")` e `Number(null)` fanno
// **zero**, che è una coordinata valida (golfo di Guinea): la spesa sarebbe
// finita sulla mappa in mezzo all'oceano. Qui il vuoto resta vuoto. La
// virgola decimale si accetta perché a seconda della lingua Shortcuts la usa.
function coordinata(valore) {
  if (valore === undefined || valore === null) return undefined;
  const testo = String(valore).trim().replace(",", ".");
  if (!testo) return undefined;
  const n = Number(testo);
  return Number.isFinite(n) ? n : undefined;
}

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
      // Un comando rapido lanciato a mano manda source:"manual": la spesa
      // l'ha inserita una persona, non è stata letta da un pagamento, e in
      // Movimenti non deve comparire come «Apple Pay». Qualunque altro
      // valore, o la sua assenza, resta applepay — l'automazione non lo
      // manda, e non va costretta a farlo.
      source: req.body.source === "manual" ? "manual" : "applepay",
      is_income: false,
      note,
      date,
      time,
      // L'automazione le manda solo se è riuscita a leggere la posizione e se
      // l'utente non l'ha disattivata: qui non sono mai obbligatorie.
      lat: coordinata(lat),
      lon: coordinata(lon),
    });
    res.status(201).json(tx);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
});

// Seconda parte del webhook: quello che si sa **dopo** che la spesa è già
// registrata — la posizione e la categoria.
//
// Esiste perché sull'iPhone due azioni possono interrompere l'automazione:
// «Ottieni la posizione attuale», se iOS nega la localizzazione in
// background, e «Scegli da Elenco», che a telefono bloccato aspetta una
// risposta e scade. Finché stanno prima dell'invio, un loro inciampo fa
// perdere la spesa — è successo davvero, al primo pagamento vero. Messe
// dopo, il peggio che si perde è il dettaglio che stavano portando.
//
// L'`id` viene dalla risposta della prima chiamata. Ogni campo è
// facoltativo: mandare solo la posizione, solo la categoria o entrambe sono
// tutti casi legittimi, e una chiamata senza niente di utile non è un errore.
async function completaSpesa(req, res) {
  try {
    const user = await db.getUserByApiKey(req.header("x-api-key"));
    if (!user) return res.status(401).json({ error: "invalid api key" });

    const { id, category } = req.body;
    if (!id) return res.status(400).json({ error: "id required" });

    const tx = await db.getTransaction(id, user.code);
    if (!tx) return res.status(404).json({ error: "not found" });

    const patch = {};
    const lat = coordinata(req.body.lat);
    const lon = coordinata(req.body.lon);
    if (lat !== undefined && lon !== undefined) {
      patch.lat = lat;
      patch.lon = lon;
    }
    if (category) {
      const cat = await db.findOrCreateCategory(user.code, String(category));
      if (cat) patch.category_id = cat.id;
    }

    // Niente da aggiornare non è un errore: il telefono non aveva la
    // posizione, o nessuno ha risposto alla domanda sulla categoria.
    if (!Object.keys(patch).length) return res.json(tx);

    res.json(await db.updateTransaction(tx.id, patch));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "internal error" });
  }
}

router.post("/webhook/applepay/completa", completaSpesa);
// Il nome originale, quando serviva solo per la posizione: resta valido per
// non costringere a rimettere le mani nelle automazioni già configurate.
router.post("/webhook/applepay/posizione", completaSpesa);

app.use(router);

module.exports.handler = serverless(app);
// Esportata anche l'app nuda, così si può testare senza simulare un evento Lambda.
module.exports.app = app;
// Esportata per i test: è la parte che dipende da come l'app è montata.
module.exports.normalizzaPercorso = normalizzaPercorso;
