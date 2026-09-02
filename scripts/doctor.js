#!/usr/bin/env node
// Controllo completo di quanto serve per far girare tappy in locale.
// Ogni voce dice cosa fare se fallisce: l'obiettivo è non lasciarti mai
// davanti a un "non funziona" senza il passo successivo.
//
// Uso: npm run doctor

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { classifica, SCHEMA } = require("./check-airtable.js");

const RADICE = path.join(__dirname, "..");
const esiti = [];

function ok(cosa, dettaglio) {
  esiti.push({ stato: "ok", cosa });
  console.log(`  ok    ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
}
function ko(cosa, rimedio) {
  esiti.push({ stato: "ko", cosa });
  console.log(`  NO    ${cosa}`);
  console.log(`        → ${rimedio}`);
}
function nota(cosa, dettaglio) {
  esiti.push({ stato: "nota", cosa });
  console.log(`  ~     ${cosa}${dettaglio ? ` — ${dettaglio}` : ""}`);
}

function leggiEnv() {
  const p = path.join(RADICE, ".env");
  if (!fs.existsSync(p)) return null;
  const vars = {};
  for (const riga of fs.readFileSync(p, "utf8").split("\n")) {
    const m = riga.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
    if (m) vars[m[1]] = m[2].trim();
  }
  return vars;
}

async function main() {
  console.log("\nControllo l'ambiente di tappy…\n");

  // --- 1. Node -------------------------------------------------------------
  const major = Number(process.versions.node.split(".")[0]);
  if (major >= 18) ok("Node", `v${process.versions.node}`);
  else ko(`Node troppo vecchio (v${process.versions.node})`, "installa Node 18 o superiore da nodejs.org");

  // --- 2. Dipendenze -------------------------------------------------------
  fs.existsSync(path.join(RADICE, "node_modules"))
    ? ok("Dipendenze del backend installate")
    : ko("Dipendenze del backend mancanti", "lancia: npm install");

  fs.existsSync(path.join(RADICE, "client", "node_modules"))
    ? ok("Dipendenze del client installate")
    : ko("Dipendenze del client mancanti", "lancia: cd client && npm install && cd ..");

  // --- 3. Netlify CLI ------------------------------------------------------
  try {
    const v = execFileSync("netlify", ["--version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    ok("Netlify CLI", v.trim().split("\n")[0]);
  } catch {
    ko("Netlify CLI non installata", "lancia: npm install -g netlify-cli");
  }

  // --- 4. File .env --------------------------------------------------------
  const env = leggiEnv();
  if (!env) {
    ko("File .env assente", "lancia: npm run setup-env");
  } else {
    const mancanti = ["AIRTABLE_API_KEY", "AIRTABLE_BASE_ID"].filter((k) => !env[k]);
    if (mancanti.length) ko(`.env incompleto: manca ${mancanti.join(", ")}`, "rilancia: npm run setup-env");
    else if (!env.AIRTABLE_API_KEY.startsWith("pat"))
      ko(".env: il token non sembra un token Airtable", "un Personal Access Token comincia per 'pat' — rilancia: npm run setup-env");
    else ok("File .env", `base ${env.AIRTABLE_BASE_ID}`);

    // Permessi: il file contiene un segreto.
    try {
      const modo = fs.statSync(path.join(RADICE, ".env")).mode & 0o777;
      if (modo & 0o077) nota(".env leggibile da altri utenti del computer", `permessi ${modo.toString(8)} — se ti importa: chmod 600 .env`);
    } catch { /* niente */ }
  }

  // --- 5. Airtable ---------------------------------------------------------
  if (env?.AIRTABLE_API_KEY && env?.AIRTABLE_BASE_ID) {
    const Airtable = require("airtable");
    const base = new Airtable({ apiKey: env.AIRTABLE_API_KEY }).base(env.AIRTABLE_BASE_ID);
    let problemi = 0;

    for (const [tabella, campi] of Object.entries(SCHEMA)) {
      let esito;
      try {
        await base(tabella).select({ fields: campi, maxRecords: 1 }).firstPage();
        esito = { esito: "ok" };
      } catch (err) {
        esito = classifica(err, tabella, campi);
      }
      if (esito.esito !== "ok") {
        problemi++;
        // Se il token non apre la base, le altre tre tabelle darebbero lo
        // stesso errore: inutile ripeterlo quattro volte.
        if (esito.esito === "permessi") {
          ko("Airtable: il token non apre questa base", "su airtable.com/create/tokens: scope data.records:read e data.records:write, e la base di tappy fra quelle selezionate");
          break;
        }
        else if (esito.esito === "tabella-assente") ko(`Airtable: manca la tabella ${tabella}`, "vedi SETUP.md §1 — i nomi contano, maiuscole comprese");
        else if (esito.esito === "campi-assenti") ko(`Airtable: in ${tabella} manca ${esito.campi.join(", ")}`, "vedi SETUP.md §1");
        else ko(`Airtable: errore su ${tabella}`, esito.dettaglio);
      }
    }
    if (problemi === 0) ok("Airtable", "4 tabelle, tutti i campi al loro posto");
  } else {
    nota("Airtable non controllato", "manca il .env");
  }

  // --- 6. Ecosistema Fru Pass ---------------------------------------------
  // Un codice inventato deve tornare 401: significa che l'endpoint risponde.
  try {
    const res = await fetch("https://frupass-user.netlify.app/.netlify/functions/api", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", payload: { code: "FRU-0000-0000" } }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.ok) ok("Ecosistema Fru Pass raggiungibile");
    else nota(`Fru Pass risponde ${res.status}`, "inatteso, ma non è un problema del tuo setup");
  } catch {
    ko("Ecosistema Fru Pass irraggiungibile", "controlla la connessione; se persiste non è colpa di tappy, riprova più tardi");
  }

  // --- 7. Il client compila ------------------------------------------------
  if (fs.existsSync(path.join(RADICE, "client", "node_modules"))) {
    try {
      execFileSync("npm", ["run", "build"], { cwd: path.join(RADICE, "client"), stdio: "ignore" });
      ok("Il client compila");
    } catch {
      ko("Il client non compila", "lancia `cd client && npm run build` per vedere l'errore");
    }
  }

  // --- riepilogo -----------------------------------------------------------
  const falliti = esiti.filter((e) => e.stato === "ko");
  console.log("");
  if (falliti.length === 0) {
    console.log("Tutto a posto. Avvia `netlify dev` e apri http://localhost:8888.");
    console.log("Poi restano due cose che solo tu puoi vedere:");
    console.log("  1. entri con il tuo codice Fru Pass;");
    console.log("  2. su Airtable compaiono la riga in Users, 4 categorie e una carta.");
    return;
  }
  console.log(`${falliti.length} cosa/e da sistemare, elencate qui sopra con il rimedio.`);
  process.exitCode = 1;
}

main().catch((err) => {
  console.error("Controllo non riuscito:", err.message || err);
  process.exit(1);
});
