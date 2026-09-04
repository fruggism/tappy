// Le schermate extra non coprono il viewport: restano nel pozzo tra header
// e dock. `fixed inset-0` è il difetto che «smonta» l'app in una pagina web
// (nasconde la pulsantiera, esce dalla colonna su iPad).
import { readFileSync } from "node:fs";

let ok = 0, ko = 0;
const t = (n, c, e) => {
  c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : "")));
};

function src(p) {
  return readFileSync(new URL(p, import.meta.url), "utf8");
}

const dettaglio = src("../client/src/views/DettaglioMovimento.tsx");
const mappa = src("../client/src/views/Mappa.tsx");
const modal = src("../client/src/components/TransactionModal.tsx");
const movimenti = src("../client/src/views/Movimenti.tsx");
const impegni = src("../client/src/views/Impegni.tsx");
const foglio = src("../client/src/components/Foglio.tsx");
const pianoForm = src("../client/src/components/FoglioPiano.tsx");
const app = src("../client/src/App.tsx");

t("Foglio esiste e usa un portal, non il viewport", foglio.includes("createPortal") && !/className="[^"]*fixed inset-0/.test(foglio));
t("il dettaglio non è fixed inset-0", !dettaglio.includes("fixed inset-0") && dettaglio.includes("<Foglio"));
t("la mappa non è fixed inset-0", !mappa.includes("fixed inset-0") && mappa.includes("<Foglio"));
t("il form movimento è una lastra, non un dialogo da sito", !modal.includes("fixed inset-0") && modal.includes("lastra") && !modal.includes("sm:items-center"));
t("Movimenti non smonta la lista per aprire il dettaglio", !/if \(dettaglio\) \{\s*return/.test(movimenti));
t("Movimenti non smonta la lista per aprire la mappa", !/if \(showMap\) \{\s*return/.test(movimenti));
t("Impegni ha Modifica e Disdici", impegni.includes("Modifica") && impegni.includes("Disdici"));
t(
  "la lastra copre la pulsantiera, non galleggia sopra",
  app.indexOf("<FoglioRoot>") < app.indexOf("<Dock") && app.indexOf("</Dock>") < app.lastIndexOf("</FoglioRoot>")
);
t("niente «Ricordamelo il»", !pianoForm.includes("Ricordamelo") && !impegni.includes("Revisione il"));
t("niente selezione carta sulle spese previste", !pianoForm.includes(">Carta<"));
t("si può registrare un pagamento una tantum", pianoForm.includes("Una volta"));

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
