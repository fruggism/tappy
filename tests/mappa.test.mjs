// La mappa deve disegnarsi anche se nasce in un pannello ancora chiuso.
//
// Aprendo «Dove ho speso» la mappa restava una superficie vuota: nessuna
// tessera, nessun errore in console. La causa: il contenitore non ha ancora
// altezza quando il pannello monta, e `fitBounds` su un contenitore alto zero
// non solleva niente ma lascia lo zoom a `null` — senza zoom Leaflet non
// chiede nemmeno una tessera. `setView`, che c'era prima, non aveva il
// problema: è per questo che il difetto è comparso cambiando l'inquadratura
// di partenza.
//
// Qui si prova con Leaflet vero e con la sequenza vera: contenitore a zero,
// poi l'altezza che arriva.
import { chromium } from "playwright-core";
import { readFileSync } from "node:fs";

const modulo = readFileSync(new URL("../client/src/lib/mappa.js", import.meta.url), "utf8")
  .replace(/^export /gm, "");
const leaflet = new URL("../client/node_modules/leaflet/dist/leaflet.js", import.meta.url).pathname;

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : ""))); };

const b = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const p = await b.newPage({ viewport: { width: 390, height: 700 } });
// Le tessere non si scaricano davvero: interessa sapere se vengono chieste.
const tessereChieste = [];
await p.route("**/tile.openstreetmap.org/**", (r) => {
  tessereChieste.push(r.request().url());
  r.abort();
});
await p.setContent(`<div id="pannello" style="height:0"><div id="m" style="height:100%"></div></div>`);
await p.addScriptTag({ path: leaflet });

const esito = await p.evaluate(async ({ modulo }) => {
  eval(modulo);
  const ITALIA = L.latLngBounds([[36.5, 6.5], [47.2, 18.6]]);
  const pannello = document.getElementById("pannello");
  const el = document.getElementById("m");

  let inquadrature = 0;
  const { mappa, smonta } = creaMappa(L, el, (m) => {
    inquadrature++;
    m.fitBounds(ITALIA, { padding: [12, 12], animate: false });
  });
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(mappa);

  const subito = { zoom: mappa.getZoom(), inquadrature };

  // il pannello si apre: è qui che la mappa deve rimettersi in sesto
  pannello.style.height = "500px";
  await new Promise((r) => setTimeout(r, 300));

  const dopo = {
    zoom: mappa.getZoom(),
    inquadrature,
    altezzaNota: mappa.getSize().y,
    dentroItalia: mappa.getBounds().intersects(ITALIA),
  };
  smonta();
  return { subito, dopo };
}, { modulo });

t("con il pannello chiuso la mappa ha comunque uno zoom valido",
  Number.isFinite(esito.subito.zoom), esito.subito);
t("con il pannello chiuso non si inquadra ancora", esito.subito.inquadrature === 0, esito.subito);
t("all'apertura Leaflet impara l'altezza vera", esito.dopo.altezzaNota === 500, esito.dopo);
t("all'apertura inquadra una volta", esito.dopo.inquadrature === 1, esito.dopo);
t("e guarda l'Italia", esito.dopo.dentroItalia === true, esito.dopo);
t("le tessere vengono chieste", tessereChieste.length > 0, { chieste: tessereChieste.length });

await b.close();
console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
