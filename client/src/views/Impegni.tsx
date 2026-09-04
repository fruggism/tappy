import { useMemo, useState } from "react";
import { useApp } from "../lib/AppContext";
import {
  caricoPerMese,
  costoRicorrenteMensile,
  disdire,
  formattaGiorno,
  impegnoResiduo,
  impegnoResiduoTotale,
  mappaGiorno,
  occorrenzeConImporto,
  riattivare,
  type Piano,
} from "../lib/piani";
import { aggiornaPiano, eliminaPiano, leggiPiani } from "../lib/pianiLocali";
import Foglio from "../components/Foglio";
import FoglioPiano from "../components/FoglioPiano";

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

function Scheda({
  piano,
  onChiudi,
  onModifica,
  onCambio,
}: {
  piano: Piano;
  onChiudi: () => void;
  onModifica: () => void;
  onCambio: () => void;
}) {
  const { user } = useApp();
  const oggi = oggiIso();
  const r = impegnoResiduo(piano, oggi);
  const [scadenze, setScadenze] = useState(false);
  const [confermaElimina, setConfermaElimina] = useState(false);

  const orizzonte = piano.end_date
    ? piano.end_date
    : `${new Date().getFullYear() + 2}-12-31`;
  const occorrenze = occorrenzeConImporto({ ...piano, active: true }, piano.start_date, orizzonte);
  const passate = occorrenze.filter((o) => o.date < oggi);
  const future = occorrenze.filter((o) => o.date >= oggi);

  function toccaDisdetta() {
    if (!user) return;
    aggiornaPiano(user.code, piano.active ? disdire(piano) : riattivare(piano));
    onCambio();
    onChiudi();
  }

  function toccaElimina() {
    if (!user) return;
    eliminaPiano(user.code, piano.id);
    onCambio();
    onChiudi();
  }

  return (
    <Foglio lastra onChiudi={onChiudi}>
      <div className="p-5 pb-8 flex flex-col gap-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-title2 truncate">{piano.name}</p>
            <p className="text-headline tabular-nums mt-1">
              €{piano.amount.toFixed(2)}
              <span className="text-callout font-normal text-muted dark:text-muted-dark">
                {piano.type === "subscription" ? " / occorrenza" : " a rata"}
              </span>
            </p>
            {!piano.active && (
              <p className="text-callout text-acc-pink mt-2">Disdetto — lo storico resta</p>
            )}
            {piano.type === "installment" ? (
              <div className="mt-3 space-y-1 text-callout text-muted dark:text-muted-dark">
                <p>Mancano {r.rate} rate · €{r.euro.toFixed(0)}</p>
                <p>Totale piano €{r.euroTotale.toFixed(0)}</p>
                {r.prossimo ? <p>Prossimo {formattaGiorno(r.prossimo)}</p> : <p>Nessuna rata rimasta</p>}
              </div>
            ) : null}
          </div>
          {piano.type === "installment" ? <AnelloRata fatte={r.fatte} totali={r.totali} /> : null}
        </div>

        <button
          type="button"
          onClick={() => setScadenze((s) => !s)}
          className="w-full rounded-2xl bg-surface2 dark:bg-surface2-dark py-2.5 text-callout"
        >
          {scadenze ? "Nascondi le scadenze" : "Vedi le scadenze"}
        </button>

        {scadenze && (
          <div className="rounded-2xl bg-surface dark:bg-surface-dark px-4 py-2 max-h-48 overflow-y-auto">
            {passate.map((o) => (
              <p key={o.date} className="flex justify-between py-1.5 text-callout text-muted dark:text-muted-dark">
                <span>{formattaGiorno(o.date)}</span>
                <span className="tabular-nums">€{o.importo.toFixed(2)}</span>
              </p>
            ))}
            <p className="text-caption uppercase tracking-wide text-muted dark:text-muted-dark py-2">oggi</p>
            {future.map((o) => (
              <p key={o.date} className="flex justify-between py-1.5 text-callout">
                <span>{formattaGiorno(o.date)}</span>
                <span className="tabular-nums">€{o.importo.toFixed(2)}</span>
              </p>
            ))}
            {occorrenze.length === 0 && (
              <p className="text-callout text-muted dark:text-muted-dark py-2">Nessuna scadenza calcolata.</p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={onModifica}
            className="rounded-xl bg-ink dark:bg-white text-white dark:text-black text-callout font-medium py-2.5"
          >
            Modifica
          </button>
          <button
            type="button"
            onClick={toccaDisdetta}
            className="rounded-xl bg-surface2 dark:bg-surface2-dark text-callout py-2.5"
          >
            {piano.active ? "Disdici" : "Riattiva"}
          </button>
          {!confermaElimina ? (
            <button
              type="button"
              onClick={() => setConfermaElimina(true)}
              className="text-callout text-acc-pink py-2"
            >
              Elimina
            </button>
          ) : (
            <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
              <p className="text-callout">Si cancella del tutto, anche lo storico. Per fermarlo basta disdire.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfermaElimina(false)} className="flex-1 text-callout rounded-xl bg-surface2 dark:bg-surface2-dark py-2">
                  Annulla
                </button>
                <button type="button" onClick={toccaElimina} className="flex-1 text-callout rounded-xl bg-acc-pink/10 text-acc-pink py-2">
                  Elimina
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </Foglio>
  );
}

export default function Impegni() {
  const { user } = useApp();
  const [, setTick] = useState(0);
  const piani = user ? leggiPiani(user.code) : [];
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
  const [form, setForm] = useState<Piano | null | "nuovo">(null);

  const ricarica = () => setTick((n) => n + 1);

  const lista = giorno
    ? piani.filter((p) => mappaGiorno([p], giorno, giorno).has(giorno))
    : [...piani].sort((a, b) => Number(b.active) - Number(a.active));

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

      <button
        onClick={() => setForm("nuovo")}
        className="w-full rounded-2xl bg-ink dark:bg-white text-white dark:text-black font-medium py-3 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
      >
        <span className="text-headline leading-none">+</span> Aggiungi spesa prevista
      </button>

      <LineaTempo mesi={mesi} />

      <p className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide px-1">
        {MESI[month]} {year}
      </p>
      <Calendario year={year} month={month} intensita={intensita} selezionato={giorno} onPick={(d) => setGiorno((g) => (g === d ? null : d))} />

      <div className="flex flex-col gap-2">
        {lista.length === 0 && (
          <p className="text-center text-callout text-muted dark:text-muted-dark py-8">
            Nessuna spesa prevista. Aggiungi un abbonamento o una rata.
          </p>
        )}
        {lista.map((p) => {
          const r = impegnoResiduo(p, oggi);
          return (
            <button
              key={p.id}
              onClick={() => setAperto(p)}
              className={`w-full rounded-3xl bg-surface dark:bg-surface-dark p-4 flex items-center justify-between text-left ${p.active ? "" : "opacity-55"}`}
            >
              <div className="min-w-0">
                <p className="text-headline truncate">{p.name}</p>
                <p className="text-footnote text-muted dark:text-muted-dark">
                  {!p.active
                    ? "disdetto"
                    : p.type === "installment"
                      ? `rata · ${r.fatte}/${r.totali}`
                      : "abbonamento"}
                </p>
              </div>
              <span className="text-headline tabular-nums">€{p.amount.toFixed(0)}</span>
            </button>
          );
        })}
      </div>

      {aperto ? (
        <Scheda
          piano={aperto}
          onChiudi={() => setAperto(null)}
          onModifica={() => {
            setForm(aperto);
            setAperto(null);
          }}
          onCambio={ricarica}
        />
      ) : null}

      {form !== null ? (
        <FoglioPiano
          esistente={form === "nuovo" ? undefined : form}
          onChiudi={() => setForm(null)}
          onSalvato={ricarica}
        />
      ) : null}
    </div>
  );
}
