// I campi di testo non scendono sotto i 16px.
//
// Sotto quella soglia iOS ingrandisce la pagina quando il campo prende il
// fuoco: la schermata sottostante si allarga e resta storta anche dopo aver
// chiuso la tastiera. Basta un campo a 13px per riportare il difetto, e non
// si vede provando sul computer — da qui questo test.
//
// Due controlli: la regola globale c'è, e nessun campo la scavalca con una
// classe più piccola. Il secondo è un'euristica sul sorgente JSX: guarda i
// 500 caratteri dopo l'apertura del tag, che in questo progetto bastano a
// coprirne gli attributi.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const RADICE = new URL("../client/src", import.meta.url).pathname;
const CSS = new URL("../client/src/index.css", import.meta.url).pathname;

// Le classi di testo del progetto che stanno sotto i 16px (vedi
// tailwind.config.js): callout 15, footnote 13, caption 12.
const TROPPO_PICCOLE = ["text-callout", "text-footnote", "text-caption"];

let ok = 0, ko = 0;
const t = (n, c, e) => { c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : ""))); };

const css = readFileSync(CSS, "utf8");
t("la regola globale sui campi c'è", /input[^{]*\{[^}]*font-size:\s*16px/s.test(css));

function file(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? file(p) : p.endsWith(".tsx") ? [p] : [];
  });
}

const colpevoli = [];
for (const p of file(RADICE)) {
  const testo = readFileSync(p, "utf8");
  for (const m of testo.matchAll(/<(input|select|textarea)\b/g)) {
    const attributi = testo.slice(m.index, m.index + 500);
    const fine = attributi.indexOf("/>");
    const dentro = fine === -1 ? attributi : attributi.slice(0, fine);
    const piccola = TROPPO_PICCOLE.find((c) => dentro.includes(c));
    if (piccola) {
      const riga = testo.slice(0, m.index).split("\n").length;
      colpevoli.push(`${p.replace(RADICE, "client/src")}:${riga} <${m[1]}> ha ${piccola}`);
    }
  }
}
t("nessun campo scende sotto i 16px con una classe", colpevoli.length === 0, colpevoli);

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
