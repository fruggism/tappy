// Dove ho speso: heatmap dei pagamenti su OpenStreetMap.
//
// Vive in una vista propria e non dentro Movimenti, che sta per essere
// riscritta: da lì arriva solo l'icona di ingresso.
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { HeatLayer, type PuntoCaldo } from "../components/HeatLayer";
import { creaMappa } from "../lib/mappa";
import { useApp } from "../lib/AppContext";

type Periodo = "giorno" | "mese" | "anno";

const ETICHETTE: Record<Periodo, string> = {
  giorno: "Giorno",
  mese: "Mese",
  anno: "Anno",
};

/** Estremi del periodo scelto, spostato di `scarto` unità nel passato. */
function intervallo(periodo: Periodo, scarto: number) {
  const oggi = new Date();
  if (periodo === "giorno") {
    const d = new Date(oggi.getFullYear(), oggi.getMonth(), oggi.getDate() + scarto);
    return { da: d, a: d, titolo: titoloGiorno(d, scarto) };
  }
  if (periodo === "mese") {
    const inizio = new Date(oggi.getFullYear(), oggi.getMonth() + scarto, 1);
    const fine = new Date(oggi.getFullYear(), oggi.getMonth() + scarto + 1, 0);
    const nome = inizio.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
    return { da: inizio, a: fine, titolo: scarto === 0 ? "Questo mese" : maiuscola(nome) };
  }
  const anno = oggi.getFullYear() + scarto;
  return {
    da: new Date(anno, 0, 1),
    a: new Date(anno, 11, 31),
    titolo: scarto === 0 ? "Quest'anno" : String(anno),
  };
}

function titoloGiorno(d: Date, scarto: number) {
  if (scarto === 0) return "Oggi";
  if (scarto === -1) return "Ieri";
  return maiuscola(d.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" }));
}

const maiuscola = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// L'inquadratura di partenza è il paese, non una città: senza punti da
// mostrare — la prima volta, o in un periodo senza spese — aprirsi su una
// città sola sembra un errore, e costringe a rimpicciolire per capire dove
// si è. Sono i limiti dell'Italia continentale più isole.
const ITALIA = L.latLngBounds([
  [36.5, 6.5],
  [47.2, 18.6],
]);

type Punto = { lat: number; lon: number; peso: number };

/** Cosa mostrare: le spese del periodo, o il paese se non ce ne sono. */
function inquadratura(m: L.Map, punti: Punto[]) {
  if (punti.length === 0) {
    m.fitBounds(ITALIA, { padding: [12, 12], animate: false });
    return;
  }
  const limiti = L.latLngBounds(punti.map((p) => [p.lat, p.lon] as [number, number]));
  m.fitBounds(limiti, { padding: [48, 48], maxZoom: 15, animate: false });
}

export default function Mappa({ onChiudi }: { onChiudi: () => void }) {
  const { transactions, effectiveTheme } = useApp();
  const [periodo, setPeriodo] = useState<Periodo>("mese");
  const [scarto, setScarto] = useState(0);

  const contenitore = useRef<HTMLDivElement>(null);
  const mappa = useRef<L.Map | null>(null);
  const strato = useRef<HeatLayer | null>(null);

  const { da, a, titolo } = useMemo(() => intervallo(periodo, scarto), [periodo, scarto]);

  // Solo le uscite con posizione: le entrate non sono "dove ho speso", e una
  // spesa senza coordinate semplicemente non compare.
  const punti: PuntoCaldo[] = useMemo(() => {
    const inizio = iso(da);
    const fine = iso(a);
    return transactions
      .filter((t) => !t.is_income && t.lat != null && t.lon != null)
      .filter((t) => t.date >= inizio && t.date <= fine)
      .map((t) => ({ lat: t.lat as number, lon: t.lon as number, peso: t.my_share }));
  }, [transactions, da, a]);

  const totale = useMemo(() => punti.reduce((s, p) => s + p.peso, 0), [punti]);

  // Quante spese del periodo restano fuori dalla mappa perché senza posizione:
  // detto apertamente, così la heatmap non si legge come se fosse tutto.
  const senzaPosizione = useMemo(() => {
    const inizio = iso(da);
    const fine = iso(a);
    return transactions.filter(
      (t) => !t.is_income && t.date >= inizio && t.date <= fine && (t.lat == null || t.lon == null)
    ).length;
  }, [transactions, da, a]);

  // I punti servono all'avvio della mappa, che però gira una volta sola: un
  // ref li tiene aggiornati senza rimontarla a ogni cambio di periodo.
  const puntiCorrenti = useRef(punti);
  useEffect(() => {
    puntiCorrenti.current = punti;
  }, [punti]);

  // Creazione della mappa: una volta sola.
  useEffect(() => {
    if (!contenitore.current || mappa.current) return;

    const { mappa: m, smonta } = creaMappa(L, contenitore.current, (mm: L.Map) =>
      inquadratura(mm, puntiCorrenti.current)
    );

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      // L'attribuzione non è decorativa: le tessere pubbliche di OSM si usano
      // a questa condizione.
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);

    L.control.zoom({ position: "bottomright" }).addTo(m);

    const h = new HeatLayer([]);
    h.addTo(m);

    mappa.current = m;
    strato.current = h;

    return () => {
      smonta();
      mappa.current = null;
      strato.current = null;
    };
  }, []);

  // Aggiornamento dei punti e inquadratura sul periodo scelto.
  useEffect(() => {
    const m = mappa.current;
    if (!m || !strato.current) return;
    strato.current.setPunti(punti);
    inquadratura(m, punti);
  }, [punti]);

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-base dark:bg-base-dark">
      <header
        className="px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        <button
          onClick={onChiudi}
          aria-label="Chiudi la mappa"
          className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full text-muted dark:text-muted-dark active:scale-90 transition-transform"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-headline font-semibold leading-tight">Dove ho speso</h1>
          <p className="text-footnote text-muted dark:text-muted-dark">
            {punti.length === 0
              ? "nessun luogo in questo periodo"
              : `${punti.length} ${punti.length === 1 ? "spesa" : "spese"} · €${Math.round(totale)}`}
          </p>
        </div>
      </header>

      <div className="px-4 pb-3 flex items-center gap-2">
        <div className="inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-footnote">
          {(Object.keys(ETICHETTE) as Periodo[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriodo(p);
                setScarto(0);
              }}
              className={`px-3 py-1 rounded-full ${
                periodo === p ? "bg-white dark:bg-black shadow" : "text-muted dark:text-muted-dark"
              }`}
            >
              {ETICHETTE[p]}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={() => setScarto((s) => s - 1)}
            aria-label="Periodo precedente"
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 18l-6-6 6-6" />
            </svg>
          </button>
          <span className="text-footnote font-medium min-w-[7rem] text-center">{titolo}</span>
          <button
            onClick={() => setScarto((s) => Math.min(0, s + 1))}
            disabled={scarto >= 0}
            aria-label="Periodo successivo"
            className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark disabled:opacity-30"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative flex-1">
        {/* Le tessere di OSM sono chiare: sul tema scuro si invertono, invece
            di appoggiare una mappa luminosa su un'app nera. Il filtro sta
            sulle sole tessere (vedi index.css): sull'intero contenitore
            invertirebbe anche i colori della heatmap, che sono la cosa che
            deve restare riconoscibile. */}
        <div
          ref={contenitore}
          className={`absolute inset-0 ${effectiveTheme === "dark" ? "mappa-scura" : ""}`}
        />

        {punti.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none px-8">
            <p className="text-callout text-muted dark:text-muted-dark text-center bg-surface/90 dark:bg-surface-dark/90 rounded-2xl px-4 py-3">
              Nessun movimento con posizione in questo periodo.
            </p>
          </div>
        )}
      </div>

      {senzaPosizione > 0 && (
        <p
          className="px-4 py-2 text-caption text-muted dark:text-muted-dark text-center"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.5rem)" }}
        >
          {senzaPosizione} {senzaPosizione === 1 ? "spesa" : "spese"} di questo periodo
          {senzaPosizione === 1 ? " non è" : " non sono"} sulla mappa: {senzaPosizione === 1 ? "non ha" : "non hanno"} una posizione.
        </p>
      )}
    </div>
  );
}
