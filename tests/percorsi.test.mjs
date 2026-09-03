// Come arriva il percorso alla funzione, a seconda di dove l'app è montata.
//
// Esiste perché la prima consegna all'hub è fallita proprio qui: la funzione
// riconosceva solo il proprio nome originale (`api`), e dentro l'hub è
// rinominata `tappy-api`. Ogni rotta rispondeva 404, con l'app che sembrava a
// posto fino al momento dell'accesso.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Module = require("module");

const origLoad = Module._load;
Module._load = function (r, ...rest) {
  if (r === "./lib/airtable")
    return {
      getUserByFrupasCode: async (c) => (c === "FRU-AB12-CD34" ? { id: "1", code: c } : null),
      provisionUser: async (p) => ({ id: "1", ...p }),
      getUserByApiKey: async () => null,
      listCategories: async () => [],
      listCards: async () => [],
      listTransactions: async () => [],
    };
  return origLoad.call(this, r, ...rest);
};
global.fetch = async () => ({
  status: 200,
  ok: true,
  json: async () => ({ profile: { code: "FRU-AB12-CD34", name: "R", username: "r" } }),
});

const { handler, normalizzaPercorso } = require(new URL("../netlify/functions/api.js", import.meta.url).pathname);

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : ""))); };

// --- la normalizzazione, forma per forma ---------------------------------
const forme = [
  ["sito dedicato", "/api/auth/login", "/auth/login"],
  ["dentro l'hub", "/tappy/api/auth/login", "/auth/login"],
  ["funzione chiamata per nome", "/.netlify/functions/api/auth/login", "/auth/login"],
  ["funzione rinominata per l'hub", "/.netlify/functions/tappy-api/auth/login", "/auth/login"],
  ["con querystring", "/api/transactions?from=2026-01-01", "/transactions?from=2026-01-01"],
  ["radice", "/tappy/api", "/"],
];
for (const [nome, dentro, atteso] of forme) {
  t(`percorso: ${nome}`, normalizzaPercorso(dentro) === atteso, normalizzaPercorso(dentro));
}

// --- e la rotta risponde davvero, non solo il percorso si accorcia --------
async function chiama(percorso, body) {
  const corpo = JSON.stringify(body);
  const r = await handler({
    httpMethod: "POST",
    path: percorso,
    rawUrl: `http://esempio${percorso}`,
    headers: { host: "esempio", "content-type": "application/json", "content-length": String(Buffer.byteLength(corpo)) },
    queryStringParameters: null,
    body: corpo,
    isBase64Encoded: false,
  }, {});
  return r.statusCode;
}

t(
  "login raggiungibile su un sito dedicato",
  (await chiama("/.netlify/functions/api/auth/login", { code: "FRU-AB12-CD34" })) === 200
);
t(
  "login raggiungibile con la funzione rinominata dell'hub",
  (await chiama("/.netlify/functions/tappy-api/auth/login", { code: "FRU-AB12-CD34" })) === 200
);
t(
  "login raggiungibile col percorso pubblico dell'hub",
  (await chiama("/tappy/api/auth/login", { code: "FRU-AB12-CD34" })) === 200
);

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
