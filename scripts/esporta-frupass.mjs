#!/usr/bin/env node
// Prepara la cartella statica da consegnare all'hub Fru Pass.
//
// Uso:
//   TAPPY_API_URL=https://tappy.netlify.app npm run esporta
//
// Perché serve l'indirizzo del backend: dentro l'hub tappy è servita come
// sito statico, ma i dati stanno sul nostro backend (Netlify Functions +
// Airtable), che vive su un altro dominio. Senza questo indirizzo l'app
// cercherebbe l'API sul dominio dell'hub, dove non esiste.
// È la strada che la guida dell'ecosistema stessa indica: identità dall'hub,
// dati da un backend proprio.
import { execFileSync } from "child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, readdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const RADICE = join(dirname(fileURLToPath(import.meta.url)), "..");
const NOME_APP = "tappy";
const DESTINAZIONE = join(RADICE, "export", NOME_APP);

const apiUrl = process.env.TAPPY_API_URL || process.argv[2];

if (!apiUrl) {
  console.error("Manca l'indirizzo del backend.\n");
  console.error("  TAPPY_API_URL=https://<tuo-sito>.netlify.app npm run esporta\n");
  console.error("È il dominio del sito Netlify dove girano le funzioni di tappy,");
  console.error("non quello dell'hub: lì l'app è solo statica.");
  process.exit(1);
}

if (!/^https:\/\//.test(apiUrl)) {
  console.error(`L'indirizzo deve iniziare per https:// — ricevuto: ${apiUrl}`);
  process.exit(1);
}

const base = apiUrl.replace(/\/+$/, "");

console.log(`\nCompilo il client (API su ${base})…`);
execFileSync("npm", ["run", "build"], {
  cwd: join(RADICE, "client"),
  stdio: "inherit",
  env: { ...process.env, VITE_API_URL: base, VITE_BASE_PATH: "./" },
});

rmSync(DESTINAZIONE, { recursive: true, force: true });
mkdirSync(DESTINAZIONE, { recursive: true });
cpSync(join(RADICE, "client/dist"), DESTINAZIONE, { recursive: true });

// --- controlli, perché un export sbagliato si scopre solo online ------------
const problemi = [];

if (!existsSync(join(DESTINAZIONE, "index.html"))) {
  problemi.push("manca index.html nella radice della cartella");
}
for (const atteso of ["manifest.json", "icons/icon-192.png", "icons/icon-512.png", "icons/icon-180.png"]) {
  if (!existsSync(join(DESTINAZIONE, atteso))) problemi.push(`manca ${atteso}`);
}

const html = readFileSync(join(DESTINAZIONE, "index.html"), "utf8");
// Il difetto numero uno di questo tipo di consegna: riferimenti assoluti, che
// in una sottocartella cercano i file nella radice del sito dell'hub.
const assoluti = [...html.matchAll(/(?:src|href)="(\/[^/][^"]*)"/g)].map((m) => m[1]);
if (assoluti.length) problemi.push(`riferimenti assoluti in index.html: ${assoluti.join(", ")}`);
if (/http:\/\/localhost/.test(html)) problemi.push("index.html contiene un indirizzo localhost");

// Nessuna credenziale deve finire nel pacchetto statico.
for (const file of readdirSync(join(DESTINAZIONE, "assets"))) {
  const contenuto = readFileSync(join(DESTINAZIONE, "assets", file), "utf8");
  if (/\bpat[A-Za-z0-9]{10,}\./.test(contenuto)) problemi.push(`${file} contiene un token Airtable`);
  if (/\bapp[A-Za-z0-9]{14}\b/.test(contenuto)) problemi.push(`${file} contiene un id di base Airtable`);
}

console.log("");
if (problemi.length) {
  for (const p of problemi) console.log(`  NO    ${p}`);
  console.log("\nExport non consegnabile: correggi quanto sopra.");
  process.exit(1);
}

console.log(`  ok    index.html nella radice`);
console.log(`  ok    percorsi relativi`);
console.log(`  ok    manifest e icone`);
console.log(`  ok    nessuna credenziale nel pacchetto`);
console.log(`\nCartella pronta: export/${NOME_APP}/`);
console.log(`Committa e pusha, poi comunica branch e percorso all'amministratore.`);
