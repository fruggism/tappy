// Lo zoom con le dita è bloccato ovunque tranne che sulla mappa.
//
// La regola è una sola riga di codice, ma sbagliarla si nota tardi e male:
// o l'app resta ingrandibile per sbaglio, o la heatmap diventa inutilizzabile
// perché non si può più avvicinare. Qui si prova su un DOM vero, con la
// gerarchia di Leaflet così com'è: il bersaglio di un pinch sulla mappa non è
// mai il contenitore, è una tessera o un controllo dentro di esso.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const sorgente = readFileSync(new URL("../client/src/lib/zoom.ts", import.meta.url), "utf8");
// Il modulo è TypeScript ma la funzione è JavaScript puro: si estrae il corpo
// invece di aggiungere un passo di compilazione solo per il test.
const corpo = sorgente
  .slice(sorgente.indexOf("export function vaImpedito"))
  .split("export function impedisciZoomDelleDita")[0]
  .replace("export function", "function")
  .replace(/: EventTarget \| null/, "")
  .replace(/: boolean/, "");

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage();
await p.setContent(`
  <main>
    <button id="pulsante">Registra spesa</button>
    <div id="grafico"><div id="barra"></div></div>
    <div class="leaflet-container" id="mappa">
      <div class="leaflet-pane"><img id="tessera" class="leaflet-tile"></div>
      <div class="leaflet-control-zoom"><a id="piu">+</a></div>
    </div>
  </main>
`);

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : ""))); };

const esito = await p.evaluate((corpo) => {
  eval(corpo);
  const su = (id) => vaImpedito(document.getElementById(id));
  return {
    pulsante: su("pulsante"),
    barraDelGrafico: su("barra"),
    body: vaImpedito(document.body),
    nessunBersaglio: vaImpedito(null),
    contenitoreMappa: su("mappa"),
    tessellaDellaMappa: su("tessera"),
    controlloDellaMappa: su("piu"),
  };
}, corpo);

t("bloccato su un pulsante", esito.pulsante === true, esito);
t("bloccato sul grafico", esito.barraDelGrafico === true, esito);
t("bloccato sullo sfondo della pagina", esito.body === true, esito);
t("bloccato anche senza bersaglio", esito.nessunBersaglio === true, esito);
t("permesso sul contenitore della mappa", esito.contenitoreMappa === false, esito);
t("permesso su una tessera, che è il vero bersaglio di un pinch",
  esito.tessellaDellaMappa === false, esito);
t("permesso sui controlli della mappa", esito.controlloDellaMappa === false, esito);

await b.close();
console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
