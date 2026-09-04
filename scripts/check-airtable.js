#!/usr/bin/env node
// Verifica che la base Airtable corrisponda a quella che tappy si aspetta.
//
// Sola lettura: chiede ad Airtable un record per tabella indicando i campi
// attesi. Se una tabella o un campo non esiste, Airtable rifiuta la richiesta
// e noi lo traduciamo in un messaggio leggibile. Non scrive e non cancella
// nulla.
//
// Uso:
//   AIRTABLE_API_KEY=pat... AIRTABLE_BASE_ID=app... npm run check-airtable

const Airtable = require("airtable");

// Gli stessi nomi che usa netlify/functions/lib/airtable.js. Cambiarli qui
// senza cambiarli lì (o viceversa) è esattamente il bug che questo script
// serve a trovare.
const SCHEMA = {
  Users: ["Name", "FrupasCode", "ApiKey", "Theme", "MonthlyBudget", "CreatedAt"],
  Categories: ["UserId", "Name", "Color", "Icon", "IsDefault", "SortOrder", "Budget"],
  Cards: ["UserId", "Name"],
  Transactions: [
    "UserId", "Date", "Time", "Amount", "MyShare", "Name",
    "CardId", "CategoryId", "Source", "IsIncome", "Note", "CreatedAt",
    "Lat", "Lon",
  ],
  Plans: [
    "UserId", "Name", "Type", "Amount", "PriceHistory", "CategoryId", "CardId",
    "Frequency", "IntervalMonths", "StartDate", "EndDate", "ReviewDate",
    "Active", "Note", "CreatedAt",
  ],
};

/**
 * Traduce l'errore di Airtable in un esito comprensibile. Estratta perché è
 * la parte che vale la pena testare: il resto è una chiamata di rete.
 */
function classifica(err, tabella, campi) {
  if (!err) return { tabella, esito: "ok" };

  const msg = String(err.message || err);

  // I campi sconosciuti vanno riconosciuti per primi: Airtable li segnala con
  // un 422, ma il messaggio può contenere anche la parola "not found".
  if (/UNKNOWN_FIELD_NAME|Unknown field name/i.test(msg)) {
    const citati = [...msg.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const nostri = citati.filter((f) => campi.includes(f));
    return { tabella, esito: "campi-assenti", campi: nostri.length ? nostri : citati };
  }

  if (err.statusCode === 401 || err.statusCode === 403 || /NOT_AUTHORIZED/i.test(msg)) {
    return { tabella, esito: "permessi", dettaglio: msg };
  }

  if (err.statusCode === 404 || /TABLE_NOT_FOUND|NOT_FOUND|could not be found/i.test(msg)) {
    return { tabella, esito: "tabella-assente" };
  }

  return { tabella, esito: "errore", dettaglio: msg };
}

async function controlla(base, tabella, campi) {
  try {
    await base(tabella).select({ fields: campi, maxRecords: 1 }).firstPage();
    return { tabella, esito: "ok" };
  } catch (err) {
    return classifica(err, tabella, campi);
  }
}

async function main() {
  // Nel sito condiviso dell'hub ogni app ha le sue variabili col prefisso.
  const apiKey = process.env.TAPPY_AIRTABLE_API_KEY || process.env.AIRTABLE_API_KEY;
  const baseId = process.env.TAPPY_AIRTABLE_BASE_ID || process.env.AIRTABLE_BASE_ID;

  if (!apiKey || !baseId) {
    console.error("Servono AIRTABLE_API_KEY e AIRTABLE_BASE_ID nell'ambiente (o le TAPPY_*).");
    console.error("Esempio: AIRTABLE_API_KEY=pat... AIRTABLE_BASE_ID=app... npm run check-airtable");
    process.exit(1);
  }

  const base = new Airtable({ apiKey }).base(baseId);
  console.log(`Controllo la base ${baseId}…\n`);

  const esiti = [];
  for (const [tabella, campi] of Object.entries(SCHEMA)) {
    // Una tabella alla volta: se le credenziali sono sbagliate, il primo
    // errore lo dice subito invece di ripetersi quattro volte in parallelo.
    const esito = await controlla(base, tabella, campi);
    esiti.push(esito);

    if (esito.esito === "ok") {
      console.log(`  ok        ${tabella} — ${campi.length} campi`);
    } else if (esito.esito === "tabella-assente") {
      console.log(`  MANCA     ${tabella} — la tabella non esiste (attenzione a maiuscole e plurale)`);
    } else if (esito.esito === "campi-assenti") {
      console.log(`  INCOMPLETA ${tabella} — campi mancanti o scritti diversamente: ${esito.campi.join(", ")}`);
    } else if (esito.esito === "permessi") {
      console.log(`  ACCESSO   ${tabella} — il token non arriva a questa base`);
    } else {
      console.log(`  ERRORE    ${tabella} — ${esito.dettaglio}`);
    }
  }

  const problemi = esiti.filter((e) => e.esito !== "ok");
  console.log("");

  if (problemi.length === 0) {
    console.log("La base è a posto: puoi avviare `netlify dev` e accedere col tuo codice Fru Pass.");
    console.log("Al primo accesso tappy crea da sé il tuo utente, le 4 categorie e la carta.");
    return;
  }

  if (problemi.some((p) => p.esito === "permessi")) {
    console.log("Il token non ha accesso a questa base. Controlla su");
    console.log("airtable.com/create/tokens che abbia gli scope data.records:read e");
    console.log("data.records:write, e che fra le basi selezionate ci sia proprio questa.");
  } else {
    console.log("Correggi quanto sopra su Airtable (i nomi contano, maiuscole comprese:");
    console.log("vedi SETUP.md §1) e rilancia questo controllo.");
  }
  process.exitCode = 1;
}

module.exports = { classifica, SCHEMA };

if (require.main === module) {
  main().catch((err) => {
    console.error("Controllo non riuscito:", err.message || err);
    process.exit(1);
  });
}
