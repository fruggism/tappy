#!/usr/bin/env node
// Crea il file .env per lo sviluppo in locale.
//
// L'id della base è già noto e non è un segreto, quindi l'unica cosa che
// resta da fornire è il token Airtable — che non sta nel repository e non
// deve starci.
//
// Uso: npm run setup-env

const fs = require("fs");
const path = require("path");
const readline = require("readline");

const ENV_PATH = path.join(__dirname, "..", ".env");

// Lo stesso valore di .env.example: si cambia lì e qui insieme.
const BASE_ID_DEFAULT = "app5U8MT6jT6Ei36q";

// Una sola interfaccia per tutte le domande: aprirne e chiuderne una per
// domanda si comporta male quando l'input non arriva dalla tastiera.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function chiedi(domanda) {
  return new Promise((resolve) => {
    // Se lo stdin finisce prima della risposta (input incollato, script non
    // interattivo) la promessa si risolve vuota invece di restare appesa.
    const suChiusura = () => resolve("");
    rl.once("close", suChiusura);
    rl.question(domanda, (risposta) => {
      rl.off("close", suChiusura);
      resolve(risposta.trim());
    });
  });
}

async function main() {
  if (fs.existsSync(ENV_PATH)) {
    const risposta = await chiedi("Esiste già un .env. Lo sostituisco? [s/N] ");
    if (risposta.toLowerCase() !== "s") {
      console.log("Lasciato com'è.");
      return;
    }
  }

  console.log("\nToken Airtable (comincia per 'pat').");
  console.log("Si crea su https://airtable.com/create/tokens con gli scope");
  console.log("data.records:read e data.records:write, sulla sola base di tappy.\n");

  // Il token resta visibile mentre lo incolli: è il compromesso per uno
  // script che funziona sempre. Dopo, pulisci la finestra con Cmd+K.
  const token = await chiedi("AIRTABLE_API_KEY: ");
  if (!token) {
    console.error("\nNessun token inserito: non ho creato niente.");
    process.exit(1);
  }
  if (!token.startsWith("pat")) {
    console.error("\nUn token Airtable comincia per 'pat'. Controlla di aver copiato quello giusto.");
    process.exit(1);
  }

  const baseId = (await chiedi(`AIRTABLE_BASE_ID [${BASE_ID_DEFAULT}]: `)) || BASE_ID_DEFAULT;

  fs.writeFileSync(
    ENV_PATH,
    `# Creato da "npm run setup-env". Non finisce nel repository (.gitignore).\n` +
      `AIRTABLE_API_KEY=${token}\n` +
      `AIRTABLE_BASE_ID=${baseId}\n`,
    { mode: 0o600 } // leggibile solo dal tuo utente
  );

  console.log("\nScritto .env (leggibile solo da te).");
  console.log("Adesso:  npm run check-airtable   e poi   netlify dev");
}

main()
  .then(() => rl.close())
  .catch((err) => {
    rl.close();
    console.error("Non riuscito:", err.message || err);
    process.exit(1);
  });
