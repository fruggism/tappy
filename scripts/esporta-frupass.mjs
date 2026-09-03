#!/usr/bin/env node
// Prepara la consegna per l'hub Fru Pass.
//
//   npm run esporta
//     Tutto dentro l'hub: il frontend statico più la funzione da aggiungere
//     al sito dell'hub, che è già un sito Netlify e può ospitarla.
//
//   TAPPY_API_URL=https://tappy.netlify.app npm run esporta
//     Backend su un sito Netlify separato: nell'hub va solo il frontend, che
//     lo chiama da un'altra origine. Serve se l'amministratore non vuole
//     toccare il progetto dell'hub.
import { execFileSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOME_APP = "tappy";
const EXPORT = join(RADICE, "export");
const STATICO = join(EXPORT, NOME_APP);

const apiEsterna = (process.env.TAPPY_API_URL || process.argv[2] || "").replace(/\/+$/, "");
const dentroHub = !apiEsterna;

if (apiEsterna && !/^https:\/\//.test(apiEsterna)) {
  console.error(`L'indirizzo del backend deve iniziare per https:// — ricevuto: ${apiEsterna}`);
  process.exit(1);
}

// Dentro l'hub l'API sta sullo stesso dominio, sotto il prefisso dell'app.
const apiUrl = dentroHub ? `/${NOME_APP}` : apiEsterna;

console.log(
  dentroHub
    ? `\nConsegna "tutto dentro l'hub": API su /${NOME_APP}/api\n`
    : `\nConsegna con backend separato: API su ${apiEsterna}\n`
);

execFileSync("npm", ["run", "build"], {
  cwd: join(RADICE, "client"),
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: apiUrl, VITE_BASE_PATH: "./" },
});

rmSync(EXPORT, { recursive: true, force: true });
mkdirSync(STATICO, { recursive: true });
cpSync(join(RADICE, "client/dist"), STATICO, { recursive: true });

// --- la funzione, se il backend vive dentro l'hub --------------------------
if (dentroHub) {
  const funzioni = join(EXPORT, "hub", "netlify", "functions");
  mkdirSync(join(funzioni, "lib"), { recursive: true });
  // Rinominata: nel sito dell'hub convivono le funzioni di tutte le app, e
  // due file "api.js" si sovrascriverebbero.
  cpSync(join(RADICE, "netlify/functions/api.js"), join(funzioni, `${NOME_APP}-api.js`));
  for (const f of readdirSync(join(RADICE, "netlify/functions/lib"))) {
    cpSync(join(RADICE, "netlify/functions/lib", f), join(funzioni, "lib", f));
  }
  writeFileSync(join(EXPORT, "ISTRUZIONI-HUB.md"), ISTRUZIONI());
}

// --- controlli: un export sbagliato si scopre solo online ------------------
const problemi = [];

if (!existsSync(join(STATICO, "index.html"))) problemi.push("manca index.html nella radice della cartella");
for (const atteso of ["manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"]) {
  if (!existsSync(join(STATICO, atteso))) problemi.push(`manca ${atteso}`);
}

const html = readFileSync(join(STATICO, "index.html"), "utf8");
const assoluti = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
if (assoluti.length) problemi.push(`riferimenti assoluti in index.html: ${assoluti.join(", ")}`);
if (/http:\/\/localhost/.test(html)) problemi.push("index.html contiene un indirizzo localhost");

for (const file of readdirSync(join(STATICO, "assets"))) {
  const contenuto = readFileSync(join(STATICO, "assets", file), "utf8");
  if (/\bpat[A-Za-z0-9]{10,}\./.test(contenuto)) problemi.push(`${file} contiene un token Airtable`);
  if (/\bapp[A-Za-z0-9]{14}\b/.test(contenuto)) problemi.push(`${file} contiene un id di base Airtable`);
}

console.log("");
if (problemi.length) {
  for (const p of problemi) console.log(`  NO    ${p}`);
  console.log("\nExport non consegnabile: correggi quanto sopra.");
  process.exit(1);
}

console.log("  ok    index.html nella radice, percorsi relativi");
console.log("  ok    manifest e icone");
console.log("  ok    nessuna credenziale nel pacchetto");
if (dentroHub) console.log("  ok    funzione e istruzioni per l'hub");

console.log(`\nPronto in export/:`);
console.log(`  ${NOME_APP}/                      → va in frupass-hub/${NOME_APP}/`);
if (dentroHub) {
  console.log(`  hub/netlify/functions/         → va nelle funzioni del sito dell'hub`);
  console.log(`  ISTRUZIONI-HUB.md              → le quattro aggiunte da fare al progetto dell'hub`);
}
console.log(`\nCommitta e pusha, poi comunica branch e percorso all'amministratore.`);

function ISTRUZIONI() {
  return `# tappy — cosa aggiungere al progetto dell'hub

La cartella \`${NOME_APP}/\` è il frontend statico: si copia in
\`frupass-hub/${NOME_APP}/\` e non richiede nulla.

Tappy però ha anche un **backend**, ed è il motivo per cui esiste: al
pagamento, un'automazione dell'iPhone manda la spesa a un endpoint, e un file
statico non può riceverla. Il sito dell'hub è un sito Netlify, quindi può
ospitarlo senza bisogno di un secondo deploy: servono **quattro aggiunte**.

Nessuna di queste tocca le altre app.

## 1. La funzione

Copia \`hub/netlify/functions/\` dentro la cartella delle funzioni del sito
dell'hub. Sono:

- \`${NOME_APP}-api.js\` — già rinominata, così non collide con le funzioni
  delle altre app;
- \`lib/airtable.js\` e \`lib/frupass.js\` — usate solo da quella.

## 2. Tre dipendenze

Nel \`package.json\` del sito dell'hub:

\`\`\`json
"dependencies": {
  "airtable": "^0.12.2",
  "cors": "^2.8.6",
  "express": "^5.2.1",
  "serverless-http": "^3.2.0"
}
\`\`\`

## 3. Due redirect

Nel \`netlify.toml\` del sito dell'hub. **L'ordine conta**: la regola dell'API
va prima di quella che serve la pagina, altrimenti le chiamate finiscono
nell'HTML.

\`\`\`toml
[[redirects]]
  from = "/${NOME_APP}/api/*"
  to = "/.netlify/functions/${NOME_APP}-api/:splat"
  status = 200

[[redirects]]
  from = "/${NOME_APP}/*"
  to = "/${NOME_APP}/index.html"
  status = 200
\`\`\`

## 4. Due variabili d'ambiente

In **Site configuration → Environment variables** del sito dell'hub:

\`\`\`
TAPPY_AIRTABLE_API_KEY=pat...
TAPPY_AIRTABLE_BASE_ID=app...
\`\`\`

Il prefisso non è un vezzo: nel sito condiviso **tutte le funzioni vedono
tutte le variabili**, quindi ogni app deve avere le sue. Per lo stesso motivo
il token di tappy va abilitato **solo sulla base di tappy**: se avesse accesso
anche alla base dell'hub, un errore nel codice di tappy potrebbe scriverci.

Vanno aggiunte **prima** del primo deploy utile: se si aggiungono dopo, serve
*Trigger deploy → Clear cache and deploy site*, non un deploy normale.

## Come verificare che sia andata

1. Apri \`https://<dominio-hub>/${NOME_APP}/\` — deve comparire la schermata di
   accesso con il campo \`FRU-••••-••••\`.
2. Entra con un codice Fru Pass valido: se entra, la funzione risponde e
   Airtable è raggiungibile.
3. Apri \`https://<dominio-hub>/${NOME_APP}/#code=FRU-XXXX-XXXX\` — deve entrare
   **senza** mostrare il login. È così che l'hub apre l'app dalla tile.

Se il punto 2 dà «Errore del server», il problema è nelle quattro aggiunte qui
sopra: quasi sempre le variabili d'ambiente o l'ordine dei redirect.
`;
}
