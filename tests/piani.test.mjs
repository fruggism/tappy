// Contratto delle spese previste: le occorrenze si calcolano, il prezzo
// nuovo non riscrive il passato, un piano disdetto non genera scadenze.
import { readFileSync } from "node:fs";
import ts from "../client/node_modules/typescript/lib/typescript.js";

const grezzo = readFileSync(new URL("../client/src/lib/piani.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(grezzo, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const modulo = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const { occorrenzeConImporto, congelarePrezzo, disdire, costoRicorrenteMensile, indiceNelPeriodo, giorniConProgrammati } = modulo;

let ok = 0, ko = 0;
const t = (n, c, e) => {
  c ? (ok++, console.log("  ok  " + n)) : (ko++, console.log("  FAIL " + n + (e !== undefined ? " -> " + JSON.stringify(e) : "")));
};

const base = {
  id: "p1",
  user_id: "FRU-TEST",
  name: "Netflix",
  type: "subscription",
  amount: 12.99,
  price_history: [{ da: "2025-01-01", importo: 12.99 }],
  category_id: null,
  card_id: null,
  frequency: "monthly",
  interval_months: null,
  start_date: "2025-01-15",
  end_date: null,
  review_date: null,
  active: true,
  note: null,
  created_at: "2025-01-01T00:00:00.000Z",
};

const occ = occorrenzeConImporto(base, "2025-01-01", "2025-04-01");
t("tre addebiti tra gennaio e marzo", occ.length === 3, occ.map((o) => o.date));
t("ogni addebito è 12.99 finché il prezzo non cambia", occ.every((o) => o.importo === 12.99));

const dopo = congelarePrezzo(base, 14.99, "2025-03-01");
t("il prezzo corrente diventa 14.99", dopo.amount === 14.99);
const occ2 = occorrenzeConImporto(dopo, "2025-01-01", "2025-04-01");
const gen = occ2.find((o) => o.date.startsWith("2025-01"));
const mar = occ2.find((o) => o.date.startsWith("2025-03"));
t("gennaio resta a 12.99", gen?.importo === 12.99, gen);
t("marzo prende 14.99", mar?.importo === 14.99, mar);

const spento = disdire(base);
t("disdetto non genera occorrenze", occorrenzeConImporto(spento, "2025-01-01", "2025-04-01").length === 0);
t("disdetto non entra nel costo ricorrente", costoRicorrenteMensile([spento]) === 0);
t("attivo sì", Math.abs(costoRicorrenteMensile([base]) - 12.99) < 0.001);

const rata = {
  ...base,
  id: "r1",
  name: "iPhone",
  type: "installment",
  amount: 79,
  price_history: [{ da: "2025-01-01", importo: 79 }],
  start_date: "2025-01-01",
  end_date: "2025-04-01",
};
t("le rate si fermano alla fine", occorrenzeConImporto(rata, "2025-01-01", "2026-01-01").length === 4);

const una = {
  ...base,
  id: "u1",
  name: "Assicurazione",
  type: "once",
  amount: 320,
  price_history: [{ da: "2025-06-01", importo: 320 }],
  start_date: "2025-06-10",
  end_date: "2025-06-10",
};
t("una volta è una sola scadenza", occorrenzeConImporto(una, "2025-01-01", "2025-12-31").length === 1);
t("una volta non entra nel costo ricorrente", costoRicorrenteMensile([una]) === 0);
t("fuori intervallo non compare", occorrenzeConImporto(una, "2025-01-01", "2025-05-01").length === 0);

t("indice 0 è lo stesso giorno", indiceNelPeriodo("2026-09-01", "2026-09-01") === 0);
t("indice 3 è tre giorni dopo", indiceNelPeriodo("2026-09-01", "2026-09-04") === 3);
t("i giorni con previsti sono unici", giorniConProgrammati([una], "2025-01-01", "2025-12-31").join() === "2025-06-10");

console.log(`\n${ok} ok, ${ko} falliti`);
process.exit(ko ? 1 : 0);
