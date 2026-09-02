// Verifica che gli errori di Airtable diventino messaggi comprensibili.
// Nessuna rete: si passano alla funzione gli errori che Airtable produce.
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { classifica, SCHEMA } = require(new URL("../scripts/check-airtable.js", import.meta.url).pathname);

let ok = 0, ko = 0;
const t = (n, c, extra) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (extra ? " -> " + JSON.stringify(extra) : ""))); };

const err = (statusCode, message) => Object.assign(new Error(message), { statusCode });
const campiTx = SCHEMA.Transactions;

let r = classifica(null, "Users", SCHEMA.Users);
t("nessun errore -> ok", r.esito === "ok", r);

r = classifica(err(404, "Table not found"), "Cards", SCHEMA.Cards);
t("tabella inesistente -> tabella-assente", r.esito === "tabella-assente", r);

r = classifica(err(422, 'Unknown field names: "MyShare"'), "Transactions", campiTx);
t("campo scritto male -> lo nomina", r.esito === "campi-assenti" && r.campi.join() === "MyShare", r);

r = classifica(err(422, 'Unknown field names: "MyShare", "CreatedAt"'), "Transactions", campiTx);
t("più campi mancanti -> li elenca tutti", r.campi.join() === "MyShare,CreatedAt", r);

r = classifica(err(403, "Not authorized"), "Users", SCHEMA.Users);
t("token senza accesso -> permessi", r.esito === "permessi", r);

r = classifica(err(401, "Unauthorized"), "Users", SCHEMA.Users);
t("token non valido -> permessi", r.esito === "permessi", r);

// Un 422 che cita "not found" resta un problema di campi, non di tabella.
r = classifica(err(422, 'Unknown field names: "Budget" (field not found)'), "Categories", SCHEMA.Categories);
t("campo mancante non viene scambiato per tabella mancante", r.esito === "campi-assenti", r);

r = classifica(err(500, "Internal error"), "Users", SCHEMA.Users);
t("errore imprevisto -> riportato com'è", r.esito === "errore" && r.dettaglio === "Internal error", r);

t("lo schema controllato copre le 4 tabelle", Object.keys(SCHEMA).join() === "Users,Categories,Cards,Transactions");

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
