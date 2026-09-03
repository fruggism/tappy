// Cosa succede quando gli utenti sono più di uno.
//
// Con un solo utente ogni riga della base è sua, e i difetti di isolamento
// non si vedono. Qui gli utenti sono due, Anna e Bruno, e si controlla che
// nessuno dei due possa finire nei dati dell'altro.
//
// Il finto sta al posto della **libreria Airtable**, non del nostro modulo:
// così girano il nostro `esc`, le nostre formule e le nostre guardie vere.
// La `select` finta interpreta la formula come farebbe Airtable — in
// particolare, una formula piegata a `OR TRUE()` restituisce tutte le righe.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const Module = require("module");

const RIGHE = {
  Users: [
    { id: "recA", FrupasCode: "FRU-AAAA-AAAA", ApiKey: "chiaveDiAnnaChiaveDiAnna", Name: "Anna" },
    { id: "recB", FrupasCode: "FRU-BBBB-BBBB", ApiKey: "chiaveDiBrunoChiaveDiBrun", Name: "Bruno" },
  ],
  Categories: [
    { id: "catA", UserId: "FRU-AAAA-AAAA", Name: "Altro", IsDefault: true, SortOrder: 0 },
    { id: "catB", UserId: "FRU-BBBB-BBBB", Name: "Altro", IsDefault: true, SortOrder: 0 },
  ],
  Cards: [
    { id: "cardA", UserId: "FRU-AAAA-AAAA", Name: "Visa" },
    { id: "cardB", UserId: "FRU-BBBB-BBBB", Name: "Amex" },
  ],
  Transactions: [],
};

let creazioni = [];

// Airtable valuta la formula: qui ne basta la parte che ci riguarda, cioè
// `{Campo} = 'valore'` con l'escape, più il riconoscimento di una formula
// che è stata allargata con un OR (che in Airtable renderebbe vero tutto).
function valuta(formula, riga) {
  const senzaStringhe = formula.replace(/'(?:\\.|[^'\\])*'/g, "''");
  if (/\bOR\b|\bTRUE\(\)/i.test(senzaStringhe)) return true; // formula iniettata
  const m = formula.match(/^\{([A-Za-z]+)\} = '((?:\\.|[^'\\])*)'$/);
  if (m) return String(riga[m[1]] ?? "") === m[2].replace(/\\(.)/g, "$1");
  const and = formula.match(/^AND\((.+)\)$/s);
  if (and) return and[1].split(/,\s*(?=\{)/).every((p) => valuta(p.trim(), riga));
  return false;
}

function tabellaFinta(nome) {
  const righe = (RIGHE[nome] ??= []);
  return {
    select({ filterByFormula } = {}) {
      const trovate = righe.filter((r) => !filterByFormula || valuta(filterByFormula, r));
      const impacchetta = (r) => ({ id: r.id, get: (c) => r[c] });
      return { firstPage: async () => trovate.map(impacchetta), all: async () => trovate.map(impacchetta) };
    },
    async create(campi) {
      const r = { id: `rec${nome}${righe.length}`, ...campi };
      righe.push(r);
      creazioni.push({ tabella: nome, ...campi });
      return { id: r.id, get: (c) => r[c] };
    },
    async update(id, campi) {
      const r = righe.find((x) => x.id === id);
      Object.assign(r, campi);
      return { id: r.id, get: (c) => r[c] };
    },
    async destroy(id) {
      RIGHE[nome] = righe.filter((x) => x.id !== id);
    },
    async find(id) {
      const r = righe.find((x) => x.id === id);
      if (!r) throw new Error("not found");
      return { id: r.id, get: (c) => r[c] };
    },
  };
}

Module._load = ((orig) => function (r, ...rest) {
  if (r === "airtable") {
    return class {
      base() {
        return tabellaFinta;
      }
    };
  }
  return orig.call(this, r, ...rest);
})(Module._load);

process.env.AIRTABLE_API_KEY = "finta";
process.env.AIRTABLE_BASE_ID = "finta";
global.fetch = async () => ({ status: 200, ok: true, json: async () => ({ profile: { code: "FRU-AAAA-AAAA", name: "Anna" } }) });

const { handler } = require(new URL("../netlify/functions/api.js", import.meta.url).pathname);

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : ""))); };

async function chiama(metodo, percorso, { corpo, chiave, codice } = {}) {
  const b = corpo === undefined ? "" : JSON.stringify(corpo);
  const headers = { host: "esempio", "content-type": "application/json", "content-length": String(Buffer.byteLength(b)) };
  if (chiave !== undefined) headers["x-api-key"] = chiave;
  if (codice) headers["x-frupas-code"] = codice;
  const r = await handler({
    httpMethod: metodo, path: percorso, rawUrl: `http://esempio${percorso}`,
    headers, queryStringParameters: null, body: b, isBase64Encoded: false,
  }, {});
  return { stato: r.statusCode, corpo: r.body ? JSON.parse(r.body) : null };
}

// --- 1. il webhook non si fa passare per un altro utente ------------------
for (const [nome, chiave] of [
  ["backslash finale, che chiude la stringa nella formula", `\\' OR TRUE() OR '`],
  ["apostrofo e OR", `' OR TRUE() OR '`],
  ["chiave vuota", ``],
  ["formula intera", `TRUE()`],
  ["chiave di forma giusta ma inesistente", `chiaveInventataDiUnoQualunque`],
]) {
  creazioni = [];
  const r = await chiama("POST", "/api/webhook/applepay", { corpo: { amount: 1, name: "Furto" }, chiave });
  t(`webhook rifiuta: ${nome}`, r.stato === 401 && creazioni.length === 0, r);
}

creazioni = [];
const buona = await chiama("POST", "/api/webhook/applepay", { corpo: { amount: 1, name: "Caffè" }, chiave: "chiaveDiBrunoChiaveDiBrun" });
const scritta = creazioni.find((c) => c.tabella === "Transactions");
t("webhook accetta la chiave vera e scrive sull'utente giusto",
  buona.stato === 201 && scritta && scritta.UserId === "FRU-BBBB-BBBB", { buona, scritta });

// --- 2. gli id di un altro utente non passano ----------------------------
for (const [nome, corpo] of [
  ["categoria", { amount: 5, name: "Spesa", category_id: "catB" }],
  ["carta", { amount: 5, name: "Spesa", card_id: "cardB" }],
]) {
  creazioni = [];
  const r = await chiama("POST", "/api/transactions", { corpo, codice: "FRU-AAAA-AAAA" });
  t(`spesa con la ${nome} di un altro utente: rifiutata`,
    r.stato === 400 && !creazioni.some((c) => c.tabella === "Transactions"), r);
}
const propria = await chiama("POST", "/api/transactions", {
  corpo: { amount: 5, name: "Spesa", category_id: "catA", card_id: "cardA" }, codice: "FRU-AAAA-AAAA",
});
t("spesa con i propri id: accettata", propria.stato === 201, propria);

// --- 3. ognuno vede solo la propria roba ---------------------------------
const catAnna = await chiama("GET", "/api/categories", { codice: "FRU-AAAA-AAAA" });
t("le categorie sono solo le proprie",
  catAnna.stato === 200 && catAnna.corpo.every((c) => c.user_id === "FRU-AAAA-AAAA") && catAnna.corpo.length === 1, catAnna);

const txBruno = await chiama("GET", "/api/transactions", { codice: "FRU-BBBB-BBBB" });
t("i movimenti sono solo i propri",
  txBruno.stato === 200 && txBruno.corpo.every((x) => x.user_id === "FRU-BBBB-BBBB"), txBruno);

// La spesa di Anna, letta col codice di Bruno: deve essere 404, non la sua.
const idAnna = (await chiama("GET", "/api/transactions", { codice: "FRU-AAAA-AAAA" })).corpo[0].id;
const sbirciata = await chiama("PATCH", `/api/transactions/${idAnna}`, { corpo: { name: "Modificata" }, codice: "FRU-BBBB-BBBB" });
t("il movimento di un altro utente non si tocca", sbirciata.stato === 404, sbirciata);

// --- 4. due primi accessi simultanei non creano due utenti ---------------
creazioni = [];
global.fetch = async () => ({ status: 200, ok: true, json: async () => ({ profile: { code: "FRU-CCCC-CCCC", name: "Carla" } }) });
const insieme = await Promise.all([
  chiama("POST", "/api/auth/login", { corpo: { code: "FRU-CCCC-CCCC" } }),
  chiama("POST", "/api/auth/login", { corpo: { code: "FRU-CCCC-CCCC" } }),
]);
const utentiCarla = RIGHE.Users.filter((u) => u.FrupasCode === "FRU-CCCC-CCCC");
t("primo accesso in contemporanea: resta un solo utente",
  insieme.every((r) => r.stato === 200) && utentiCarla.length === 1,
  { stati: insieme.map((r) => r.stato), utentiCarla: utentiCarla.length });

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
