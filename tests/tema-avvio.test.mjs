// Il colore della status bar all'avvio.
//
// Su iPhone iOS decide il colore della striscia in cima **prima** che React
// esista: legge il <meta name="theme-color"> del documento iniziale. Finché
// erano due meta legati a prefers-color-scheme vinceva il tema di *sistema*,
// e su un telefono in scuro con l'app in chiaro restava una fascia nera sopra
// una schermata bianca.
//
// Qui si prova lo script di index.html così com'è compilato, nei quattro
// incroci fra quello che l'utente ha scelto e quello che vuole il sistema.
import { chromium } from "playwright-core";
import { readFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";

const INDEX = new URL("../client/dist/index.html", import.meta.url).pathname;
if (!existsSync(INDEX)) {
  console.log("  salto: manca client/dist — esegui prima `npm run build` in client/");
  process.exit(0);
}
const html = readFileSync(INDEX, "utf8");

// Un server minimo, così il test non dipende da niente di avviato a mano.
// Serve solo il documento: gli asset non servono, anzi vanno evitati (vedi
// sotto), e qualsiasi percorso risponde con index.html come farebbe una SPA.
const server = createServer((_req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(html);
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}`;

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : ""))); };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

const casi = [
  { salvato: "light", sistema: "dark", atteso: "#f5f5f7", scuro: false, nome: "app chiara su telefono scuro" },
  { salvato: "dark", sistema: "light", atteso: "#000000", scuro: true, nome: "app scura su telefono chiaro" },
  { salvato: null, sistema: "dark", atteso: "#000000", scuro: true, nome: "nessuna scelta: segue il sistema (scuro)" },
  { salvato: null, sistema: "light", atteso: "#f5f5f7", scuro: false, nome: "nessuna scelta: segue il sistema (chiaro)" },
];

for (const c of casi) {
  const ctx = await b.newContext({ colorScheme: c.sistema });
  const p = await ctx.newPage();
  // Conta solo ciò che il documento fa **da solo**: iOS legge il colore
  // prima che l'applicazione esista. Bloccando il bundle si misura lo script
  // in cima a index.html, non l'effetto di React che arriva dopo.
  await p.route("**/assets/*.js", (r) => r.abort());
  // Il valore va scritto prima che il documento giri: l'origine deve
  // esistere, quindi si passa da una pagina vuota sullo stesso host.
  // Una pagina qualsiasi della stessa origine, per poter scrivere in
  // localStorage prima che il documento vero giri. Il server risponde con
  // index.html anche a un percorso inesistente (è una SPA), e va benissimo.
  await p.goto(`${BASE}/pagina-inesistente`);
  if (c.salvato) await p.evaluate((v) => localStorage.setItem("tappy_tema", v), c.salvato);
  else await p.evaluate(() => localStorage.removeItem("tappy_tema"));
  await p.goto(`${BASE}/`);
  const r = await p.evaluate(() => ({
    colore: document.querySelector('meta[name="theme-color"]').getAttribute("content"),
    quantiMeta: document.querySelectorAll('meta[name="theme-color"]').length,
    classeScura: document.documentElement.classList.contains("dark"),
  }));
  t(`${c.nome}: striscia ${c.atteso}`, r.colore === c.atteso && r.classeScura === c.scuro, r);
  t(`${c.nome}: un solo meta theme-color`, r.quantiMeta === 1, r);
  await ctx.close();
}

t("nessun meta legato a prefers-color-scheme nel documento iniziale",
  !/<meta[^>]*theme-color[^>]*media=/.test(html));

await b.close();
server.close();
console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
