// Test attraverso il **gestore serverless**, cioè il percorso che la
// richiesta fa davvero su Netlify.
//
// Esiste per un motivo preciso: i test in auth-routes.test.mjs montano l'app
// Express su un server http e passavano anche quando il gestore era rotto.
// Il corpo della richiesta arriva qui come Buffer, e quel dettaglio si vede
// solo da questa parte.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Module = require("module");

const utenti = [];
const stubDb = {
  getUserByFrupasCode: async (c) => utenti.find((u) => u.code === c) || null,
  getUserByApiKey: async (k) => utenti.find((u) => u.api_key === k) || null,
  provisionUser: async (p) => {
    let u = utenti.find((x) => x.code === p.code);
    if (!u) { u = { id: "rec1", code: p.code, name: p.name, api_key: "KEY-" + p.code, theme: "system", monthly_budget: 800 }; utenti.push(u); }
    return u;
  },
  listCategories: async () => [{ id: "c1", name: "Altro", is_default: 1 }],
  listCards: async () => [], findCardByName: async () => null,
  createCard: async (u, n) => ({ id: "cd1", name: n }),
  findOrCreateCategory: async () => ({ id: "c1", name: "Altro" }),
  createTransaction: async (userId, d) => ({ id: "tx1", user_id: userId, ...d }),
  listTransactions: async () => [],
};

const origLoad = Module._load;
Module._load = function (req, ...rest) {
  if (req === "./lib/airtable") return stubDb;
  return origLoad.call(this, req, ...rest);
};

global.fetch = async (_u, o) => {
  const { payload } = JSON.parse(o.body);
  if (payload.code !== "FRU-AB12-CD34") return { status: 401, ok: false };
  return { status: 200, ok: true, json: async () => ({ profile: { code: payload.code, name: "Ricky", username: "ricky" } }) };
};

const { handler } = require(new URL("../netlify/functions/api.js", import.meta.url).pathname);

// L'evento come lo costruiscono `netlify dev` e Netlify in produzione.
async function chiama(method, percorso, { body, headers } = {}) {
  const corpo = body ? JSON.stringify(body) : null;
  const r = await handler({
    httpMethod: method,
    path: `/.netlify/functions/api${percorso}`,
    rawUrl: `http://localhost:8888/.netlify/functions/api${percorso}`,
    headers: {
      host: "localhost:8888",
      ...(corpo ? { "content-type": "application/json", "content-length": String(Buffer.byteLength(corpo)) } : {}),
      ...(headers || {}),
    },
    queryStringParameters: null,
    body: corpo,
    isBase64Encoded: false,
  }, {});
  let j = null;
  try { j = JSON.parse(r.body); } catch { /* non JSON */ }
  return { status: r.statusCode, body: j };
}

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e ? " -> " + JSON.stringify(e) : ""))); };

let r = await chiama("POST", "/auth/login", { body: { code: "FRU-AB12-CD34" } });
t("login: il corpo JSON arriva alla rotta (non resta un Buffer)", r.status === 200 && r.body.profile.code === "FRU-AB12-CD34", r);
const apiKey = r.body?.user?.api_key;

r = await chiama("POST", "/auth/login", { body: { code: "FRU-9999-9999" } });
t("login: codice non riconosciuto -> 401", r.status === 401, r);

r = await chiama("POST", "/auth/login", { body: {} });
t("login: corpo senza codice -> 400", r.status === 400, r);

r = await chiama("POST", "/auth/login");
t("login: nessun corpo -> 400, non un errore interno", r.status === 400, r);

r = await chiama("GET", "/me", { headers: { "x-frupas-code": "FRU-AB12-CD34" } });
t("rotte dati raggiungibili col percorso di Netlify", r.status === 200, r);

r = await chiama("POST", "/transactions", {
  headers: { "x-frupas-code": "FRU-AB12-CD34" },
  body: { amount: 9.5, name: "Bar" },
});
t("una spesa manuale arriva col suo importo", r.status === 201 && r.body.amount === 9.5, r);

r = await chiama("POST", "/webhook/applepay", {
  headers: { "x-api-key": apiKey },
  body: { amount: 12.5, name: "Bar Roma" },
});
t("il webhook legge il corpo dell'automazione", r.status === 201 && r.body.amount === 12.5 && r.body.source === "applepay", r);

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
