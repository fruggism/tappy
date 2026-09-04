import { useMemo, useState } from "react";
import { useApp } from "../lib/AppContext";
import {
  caricoPerMese,
  costoRicorrenteMensile,
  formattaGiorno,
  impegnoResiduo,
  impegnoResiduoTotale,
  mappaGiorno,
  type Piano,
} from "../lib/piani";
import { leggiPiani } from "../lib/pianiLocali";

const MESI = ["gennaio","febbraio","marzo","aprile","maggio","giugno","luglio","agosto","settembre","ottobre","novembre","dicembre"];
const GIORNI = ["L","M","M","G","V","S","D"];

function oggiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function AnelloRata({ fatte, totali }: { fatte: number; totali: number }) {
  const size = 88;
  const r = 34;
  const circ = 2 * Math.PI * r;
  const pct = totali > 0 ? Math.min(1, fatte / totali) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-black/[0.06] dark:text-white/10" strokeWidth={7} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" className="text-acc-green" strokeWidth={7} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-headline tabular-nums">{fatte}/{totali || "—"}</span>
      </div>
    </div>
  );
}

function LineaTempo({ mesi }: { mesi: { chiave: string; etichetta: string; euro: number }[] }) {
  const max = Math.max(1, ...mesi.map((m) => m.euro));
  const w = 320;
  const h = 92;
  const pad = 10;
  const inner = w - pad * 2;
  const punti = mesi.map((m, i) => {
    const x = pad + (mesi.length === 1 ? inner / 2 : (i / (mesi.length - 1)) * inner);
    const y = h - 18 - (m.euro / max) * 58;
    return { ...m, x, y };
  });
  const linea = punti.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${linea} L${punti[punti.length - 1].x},${h - 16} L${punti[0].x},${h - 16} Z`;
  return (
    <div className="w-full rounded-3xl bg-surface dark:bg-surface-dark p-4">
      <p className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide mb-2">Nei prossimi mesi</p>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-24 text-acc-green">
        <path d={area} fill="currentColor" className="opacity-20" />
        <path d={linea} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {punti.map((p) => (
          <circle key={p.chiave} cx={p.x} cy={p.y} r={Math.max(2.5, 2 + (p.euro / max) * 3)} fill="currentColor" />
        ))}
        {punti.map((p) => (
          <text key={p.chiave + "l"} x={p.x} y={h - 4} textAnchor="middle" className="fill-current" style={{ fontSize: 9, opacity: 0.55 }}>
            {p.etichetta}
          </text>
        ))}
      </svg>
    </div>
  );
}

function Calendario({
  year,
  month,
  intensita,
  selezionato,
  onPick,
}: {
  year: number;
  month: number;
  intensita: Map<string, number>;
  selezionato: string | null;
  onPick: (iso: string) => void;
}) {
  const primo = new Date(year, month, 1);
  const startWeekday = (primo.getDay() + 6) % 7;
  const dim = new Date(year, month + 1, 0).getDate();
  const max = Math.max(1, ...intensita.values());
  const celle: (number | null)[] = [...Array(startWeekday).fill(null), ...Array.from({ length: dim }, (_, i) => i + 1)];
  while (celle.length % 7) celle.push(null);

  return (
    <div className="w-full rounded-3xl bg-surface dark:bg-surface-dark p-4">
      <div className="grid grid-cols-7 mb-2">
        {GIORNI.map((g, i) => (
          <span key={i} className="text-center text-caption text-muted dark:text-muted-dark">{g}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {celle.map((n, i) => {
          if (!n) return <div key={i} className="h-9" />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(n).padStart(2, "0")}`;
          const euro = intensita.get(iso) ?? 0;
          const t = euro > 0 ? Math.max(0.18, euro / max) : 0;
          const on = selezionato === iso;
          return (
            <button
              key={iso}
              onClick={() => onPick(iso)}
              className={`h-9 w-full rounded-full text-footnote tabular-nums flex items-center justify-center ${on ? "ring-1 ring-acc-green" : ""}`}
              style={euro > 0 ? { backgroundColor: `color-mix(in srgb, var(--acc-green) ${Math.round(t * 100)}%, transparent)` } : undefined}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function Scheda({ piano, onChiudi }: { piano: Piano; onChiudi: () => void }) {
  const oggi = oggiIso();
  const r = impegnoResiduo(piano, oggi);
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" onClick={onChiudi}>
      <div className="w-full max-w-md rounded-t-3xl bg-base dark:bg-base-dark p-5 pb-10" onClick={(e) => e.stopPropagation()}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15" />
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-title2 truncate">{piano.name}</p>
            <p className="text-headline tabular-nums mt-1">
              €{piano.amount.toFixed(2)}
              <span className="text-callout font-normal text-muted dark:text-muted-dark">
                {piano.type === "subscription" ? " / mese" : " a rata"}
              </span>
            </p>
            {piano.type === "installment" ? (
              <div className="mt-3 space-y-1 text-callout text-muted dark:text-muted-dark">
                <p>Mancano {r.rate} rate · €{r.euro.toFixed(0)}</p>
                <p>Totale piano €{r.euroTotale.toFixed(0)}</p>
                {r.prossimo ? <p>Prossimo {formattaGiorno(r.prossimo)}</p> : <p>Nessuna rata rimasta</p>}
              </div>
            ) : piano.review_date ? (
              <p className="text-callout text-muted dark:text-muted-dark mt-3">Revisione il {formattaGiorno(piano.review_date)}</p>
            ) : null}
          </div>
          {piano.type === "installment" ? <AnelloRata fatte={r.fatte} totali={r.totali} /> : null}
        </div>
      </div>
    </div>
  );
}

export default function Impegni() {
  const { user } = useApp();
  const piani = useMemo(() => (user ? leggiPiani(user.code) : []), [user]);
  const oggi = oggiIso();
  const cursore = new Date();
  const year = cursore.getFullYear();
  const month = cursore.getMonth();
  const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const to = `${year}-${String(month + 1).padStart(2, "0")}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, "0")}`;
  const intensita = useMemo(() => mappaGiorno(piani, from, to), [piani, from, to]);
  const mesi = useMemo(() => caricoPerMese(piani, new Date(year, month, 1), 8), [piani, year, month]);
  const ricorrente = costoRicorrenteMensile(piani);
  const residuo = impegnoResiduoTotale(piani, oggi);
  const [giorno, setGiorno] = useState<string | null>(null);
  const [aperto, setAperto] = useState<Piano | null>(null);

  const lista = giorno
    ? piani.filter((p) => mappaGiorno([p], giorno, giorno).has(giorno))
    : piani.filter((p) => p.active);

  return (
    <div className="flex flex-col gap-4 animate-rise">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-3xl bg-surface dark:bg-surface-dark p-4">
          <p className="text-caption text-muted dark:text-muted-dark">Costo ricorrente</p>
          <p className="text-title2 tabular-nums mt-1">€{ricorrente.toFixed(0)}</p>
          <p className="text-caption text-muted dark:text-muted-dark">/mese</p>
        </div>
        <div className="rounded-3xl bg-surface dark:bg-surface-dark p-4">
          <p className="text-caption text-muted dark:text-muted-dark">Ancora da pagare</p>
          <p className="text-title2 tabular-nums mt-1">€{residuo.euro.toFixed(0)}</p>
          <p className="text-caption text-muted dark:text-muted-dark">{residuo.rate} rate</p>
        </div>
      </div>

      <LineaTempo mesi={mesi} />

      <p className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide px-1">
        {MESI[month]} {year}
      </p>
      <Calendario year={year} month={month} intensita={intensita} selezionato={giorno} onPick={(d) => setGiorno((g) => (g === d ? null : d))} />

      <div className="flex flex-col gap-2">
        {lista.map((p) => {
          const r = impegnoResiduo(p, oggi);
          return (
            <button key={p.id} onClick={() => setAperto(p)} className="w-full rounded-3xl bg-surface dark:bg-surface-dark p-4 flex items-center justify-between text-left">
              <div className="min-w-0">
                <p className="text-headline truncate">{p.name}</p>
                <p className="text-footnote text-muted dark:text-muted-dark">
                  {p.type === "installment" ? `rata · ${r.fatte}/${r.totali}` : "abbonamento"}
                </p>
              </div>
              <span className="text-headline tabular-nums">€{p.amount.toFixed(0)}</span>
            </button>
          );
        })}
      </div>

      {aperto ? <Scheda piano={aperto} onChiudi={() => setAperto(null)} /> : null}
    </div>
  );
}
