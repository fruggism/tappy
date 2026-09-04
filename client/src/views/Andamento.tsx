import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/AppContext";
import RadialGauge, { ritmo, type Orologio, type Scelta } from "../components/RadialGauge";
import SegmentedControl from "../components/SegmentedControl";
import { accent } from "../lib/accent";
import { formattaGiorno, indiceNelPeriodo, occorrenzePiani } from "../lib/piani";
import { leggiPiani } from "../lib/pianiLocali";
import type { Transaction } from "../lib/types";

type Period = "day" | "week" | "month";

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Lunedì come primo giorno della settimana
function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function isoLocale(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function finePiena(from: string, passi: number) {
  const [y, m, d] = from.split("-").map(Number);
  const x = new Date(y, m - 1, d);
  x.setDate(x.getDate() + passi - 1);
  return isoLocale(x);
}

function formatShortDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", { day: "numeric", month: "short" });
}

// Etichetta compatta per un intervallo di date, usata nel confronto vs periodo precedente.
function formatRangeShort(period: Period, r: { from: string; to: string }) {
  if (period === "day") return formatShortDate(r.from);
  if (period === "week") return `${formatShortDate(r.from)}–${formatShortDate(r.to)}`;
  const label = new Date(`${r.from}T00:00:00`).toLocaleDateString("it-IT", { month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Etichette corte: con "Giornaliero"/"Settimanale" la riga non ci sta su un
// iPhone stretto e spinge fuori dalla card l'icona della macchina del tempo.
// Sono anche le stesse parole della vista mappa.
const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "day", label: "Giorno" },
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
];

// Calcola l'intervallo di un periodo (giorno/settimana/mese) ancorato a una data
// di riferimento (il "giorno nel passato" scelto con la macchina del tempo).
function getRange(period: Period, refDate: Date, today: Date) {
  const todayISO = toISODate(today);

  if (period === "day") {
    const iso = toISODate(refDate);
    return { from: iso, to: iso, daysTotal: 1, daysElapsed: 1, ref: refDate, current: iso === todayISO };
  }

  if (period === "week") {
    const start = startOfWeek(refDate);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const startISO = toISODate(start);
    const endISO = toISODate(end);
    const current = todayISO >= startISO && todayISO <= endISO;
    const daysElapsed = current
      ? Math.floor((today.getTime() - start.getTime()) / 86400000) + 1
      : 7;
    return { from: startISO, to: current ? todayISO : endISO, daysTotal: 7, daysElapsed, ref: start, current };
  }

  // month
  const ref = new Date(refDate.getFullYear(), refDate.getMonth(), 1);
  const dim = daysInMonth(ref.getFullYear(), ref.getMonth());
  const prefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  const current = today.getFullYear() === ref.getFullYear() && today.getMonth() === ref.getMonth();
  return {
    from: `${prefix}-01`,
    to: current ? todayISO : `${prefix}-${String(dim).padStart(2, "0")}`,
    daysTotal: dim,
    daysElapsed: current ? today.getDate() : dim,
    ref,
    current,
  };
}

function shiftPeriod(date: Date, period: Period, delta: number) {
  const d = new Date(date);
  if (period === "day") d.setDate(d.getDate() + delta);
  else if (period === "week") d.setDate(d.getDate() + delta * 7);
  else d.setMonth(d.getMonth() + delta);
  return d;
}

function formatPeriodLabel(period: Period, range: ReturnType<typeof getRange>, today: Date) {
  if (period === "day") {
    if (range.current) return "Oggi";
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (toISODate(range.ref) === toISODate(yesterday)) return "Ieri";
    return range.ref.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
  }
  if (period === "week") {
    if (range.current) return "Questa settimana";
    const lastWeekStart = startOfWeek(shiftPeriod(today, "week", -1));
    if (toISODate(range.ref) === toISODate(lastWeekStart)) return "Settimana scorsa";
    return `Settimana del ${range.ref.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
  }
  if (range.current) return "Questo mese";
  const lastMonth = shiftPeriod(today, "month", -1);
  if (range.ref.getFullYear() === lastMonth.getFullYear() && range.ref.getMonth() === lastMonth.getMonth()) {
    return "Mese scorso";
  }
  const label = range.ref.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

// Anima un numero verso il valore target con un easing morbido.
function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf: number;
    function tick(t: number) {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(from + (to - from) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else {
        setDisplay(to);
        prev.current = to;
      }
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return display;
}

/**
 * Diventa true la prima volta che l'elemento entra nel viewport, e resta true:
 * le card sotto la piega (Nel tempo, Dove) animano quando l'utente le raggiunge
 * scrollando, non prima — altrimenti l'animazione è già finita quando arrivano.
 */
function useInView<T extends HTMLElement>(threshold = 0.15) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          obs.disconnect();
        }
      },
      { threshold }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);

  return [ref, inView] as const;
}

function TimeTravelMenu({
  travelDate,
  today,
  onPick,
}: {
  travelDate: Date;
  today: Date;
  onPick: (date: Date) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const isToday = toISODate(travelDate) === toISODate(today);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    if (!v) return;
    const [y, m, d] = v.split("-").map(Number);
    onPick(new Date(y, m - 1, d));
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Viaggia nel tempo"
        className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
          !isToday
            ? "bg-acc-cyan/15 text-acc-cyan"
            : open
            ? "bg-acc-green/15 text-acc-green"
            : "text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10"
        }`}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4.5 w-4.5">
          <circle cx="12" cy="12" r="9" strokeWidth="1.8" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M12 7v5l3.5 2" />
        </svg>
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-10 w-56 rounded-2xl bg-surface dark:bg-surface-dark shadow-xl border border-black/5 dark:border-white/10 overflow-hidden animate-rise p-3 flex flex-col gap-2">
          <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
            Viaggia nel tempo
          </span>
          <input
            type="date"
            defaultValue={toISODate(travelDate)}
            max={toISODate(today)}
            onChange={handleChange}
            className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-cyan/60"
          />
          <p className="text-footnote text-muted dark:text-muted-dark leading-snug">
            Scegli un giorno per rivedere i tuoi dati come se fossi lì: giornaliero, settimanale e
            mensile si aggiornano di conseguenza.
          </p>
          {!isToday && (
            <button
              onClick={() => {
                onPick(today);
                setOpen(false);
              }}
              className="text-callout text-acc-green font-medium text-left"
            >
              ← Torna a oggi
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Piccolo anello di progresso, riusato per le categorie e la proiezione.
// `visible` è pilotato dal genitore (useInView) così l'animazione parte
// quando la card entra nel viewport, non quando il componente monta.
function MiniRing({
  pct,
  color,
  visible,
  size = 60,
  strokeWidth = 6,
  children,
}: {
  pct: number;
  color: string;
  visible: boolean;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const clamped = Math.min(100, Math.max(0, pct));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          className="text-black/[0.06] dark:text-white/10"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={visible ? circ * (1 - clamped / 100) : circ}
          style={{ transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

function PerDayRow({ perDay }: { perDay: number }) {
  const animated = useCountUp(perDay);
  return (
    <div className="w-full flex justify-between text-callout px-1">
      <span className="text-muted dark:text-muted-dark">Spesa media al giorno</span>
      <span className="font-semibold tabular-nums text-acc-green">
        €{animated.toFixed(0)}
        <span className="text-footnote font-normal text-muted dark:text-muted-dark">/giorno</span>
      </span>
    </div>
  );
}

function TrendArrow({ up, className }: { up: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      className={className}
      style={{ transform: up ? "rotate(0deg)" : "rotate(180deg)", transition: "transform 0.4s ease" }}
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

function TrendContent({
  current,
  previous,
  period,
  range,
  prevRange,
  visible,
}: {
  current: number;
  previous: number;
  period: Period;
  range: { from: string; to: string };
  prevRange: { from: string; to: string };
  visible: boolean;
}) {
  const animated = useCountUp(current);
  const rangeLabel = formatRangeShort(period, range);
  const prevRangeLabel = formatRangeShort(period, prevRange);

  if (previous <= 0) {
    return (
      <div className="flex flex-col gap-2 flex-1 min-w-0">
        <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
          Vs periodo prec.
        </span>
        <span className="text-callout text-muted dark:text-muted-dark">Nessun dato di confronto</span>
        <span className="text-caption text-muted dark:text-muted-dark">
          {rangeLabel} vs {prevRangeLabel}
        </span>
      </div>
    );
  }

  const deltaPct = ((current - previous) / previous) * 100;
  const up = deltaPct >= 0;
  const color = up ? accent("pink", "#ff2ecb") : accent("green", "#39ff88");
  const textColor = up ? "text-acc-pink" : "text-acc-green";
  const maxVal = Math.max(current, previous, 1);

  return (
    <div className="flex flex-col gap-3 flex-1 min-w-0 overflow-hidden">
      <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
        Vs periodo prec.
      </span>
      <div className="flex items-end gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="h-12 w-3 rounded-full bg-black/[0.06] dark:bg-white/10 relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full bg-muted/50 dark:bg-muted-dark/50 transition-all duration-700 ease-out"
              style={{ height: visible ? `${(previous / maxVal) * 100}%` : 0 }}
            />
          </div>
          <span className="text-caption text-muted dark:text-muted-dark">prima</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-12 w-3 rounded-full bg-black/[0.06] dark:bg-white/10 relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700 ease-out"
              style={{
                height: visible ? `${(current / maxVal) * 100}%` : 0,
                background: color,
              }}
            />
          </div>
          <span className="text-caption text-muted dark:text-muted-dark">ora</span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className={`flex items-center gap-1 ${textColor}`}>
            <TrendArrow up={up} className="h-4 w-4 shrink-0" />
            <span className="text-headline font-semibold tabular-nums">{Math.abs(deltaPct).toFixed(0)}%</span>
          </div>
          <span className="text-footnote text-muted dark:text-muted-dark tabular-nums">
            €{animated.toFixed(0)} vs €{previous.toFixed(0)}
          </span>
          <span className="text-caption text-muted dark:text-muted-dark leading-snug">
            {rangeLabel} vs {prevRangeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function TopContent({
  topCategory,
  topMerchant,
}: {
  topCategory: { label: string; color: string; value: number } | null;
  topMerchant: { name: string; value: number } | null;
}) {
  if (!topCategory && !topMerchant) return null;
  return (
    <div className="w-full flex flex-col gap-3">
      <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
        In evidenza
      </span>
      <div className="flex items-center gap-4 flex-wrap">
        {topCategory && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: topCategory.color }} />
            <span className="text-callout truncate">
              {topCategory.label}{" "}
              <span className="text-muted dark:text-muted-dark">· €{topCategory.value.toFixed(0)}</span>
            </span>
          </div>
        )}
        {topCategory && topMerchant && <span className="text-muted dark:text-muted-dark">·</span>}
        {topMerchant && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-acc-amber shrink-0">★</span>
            <span className="text-callout truncate">
              {topMerchant.name}{" "}
              <span className="text-muted dark:text-muted-dark">· €{topMerchant.value.toFixed(0)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function SparklineContent({
  data,
  visible,
}: {
  data: { date: string; total: number }[];
  visible: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const green = accent("green", "#39ff88");
  const barre = useRef<HTMLDivElement>(null);
  const etichetta = useRef<HTMLDivElement>(null);
  const [sinistra, setSinistra] = useState(0);

  // L'etichetta era centrata sulla barra: sulle prime e sulle ultime finiva
  // metà fuori dal grafico, a fluttuare nel vuoto a destra dello schermo.
  // Qui si misura quanto è larga davvero — dipende dall'importo, «€6 · 3 set»
  // e «€1.234 · 12 set» non occupano lo stesso spazio — e la si trattiene
  // entro i bordi del grafico. Il calcolo sta in un layout effect così
  // avviene prima che il browser dipinga: nessuno la vede saltare.
  useLayoutEffect(() => {
    if (hover === null || !barre.current || !etichetta.current) return;
    const larghezza = barre.current.clientWidth;
    const w = etichetta.current.offsetWidth;
    const centroBarra = ((hover + 0.5) / data.length) * larghezza;
    setSinistra(Math.max(0, Math.min(larghezza - w, centroBarra - w / 2)));
  }, [hover, data.length]);
  const max = Math.max(1, ...data.map((d) => d.total));
  const today = toISODate(new Date());

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
          Ultimi 14 giorni
        </span>
        <span className="text-caption text-muted dark:text-muted-dark tabular-nums shrink-0">
          picco €{max === 1 ? 0 : max.toFixed(0)}
        </span>
      </div>
      <div ref={barre} className="relative flex items-end gap-1.5 h-20">
        {hover !== null && (
          <div
            ref={etichetta}
            className="absolute -top-8 whitespace-nowrap rounded-lg bg-ink dark:bg-white text-white dark:text-black text-caption font-medium px-2 py-1 shadow-lg z-10 animate-rise pointer-events-none"
            style={{ left: sinistra }}
          >
            €{data[hover].total.toFixed(0)} · {formatShortDate(data[hover].date)}
          </div>
        )}
        {data.map((d, i) => {
          const isToday = d.date === today;
          const h = visible ? Math.max(3, (d.total / max) * 100) : 0;
          const isHover = hover === i;
          return (
            <div
              key={d.date}
              className="relative flex-1 h-full cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
            >
              <div className="h-full w-full rounded-full bg-black/5 dark:bg-white/10 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full transition-all ease-out"
                  style={{
                    height: `${h}%`,
                    transitionDuration: "800ms",
                    transitionDelay: `${i * 35}ms`,
                    background: isHover || isToday ? green : `${green}55`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CategoryRing({
  category: c,
  total,
  visible,
}: {
  category: { id: string; label: string; color: string; value: number; budget: number | null };
  total: number;
  visible: boolean;
}) {
  const hasBudget = c.budget != null && c.budget > 0;
  const over = hasBudget && c.value > c.budget!;
  const pct = hasBudget
    ? (c.value / c.budget!) * 100
    : total > 0
    ? (c.value / total) * 100
    : 0;
  const color = over ? accent("pink", "#ff2ecb") : c.color;

  return (
    <div className="flex flex-col items-center gap-2 w-[5.5rem] shrink-0">
      <MiniRing pct={pct} color={color} visible={visible}>
        <span className="text-footnote font-semibold tabular-nums leading-none" style={{ color }}>
          €{c.value.toFixed(0)}
        </span>
      </MiniRing>
      <div className="flex flex-col items-center gap-0.5 max-w-full">
        <span className="text-callout font-medium truncate max-w-full">{c.label}</span>
        <span className="text-caption text-muted dark:text-muted-dark truncate max-w-full">
          {hasBudget ? (over ? "oltre budget" : `su €${c.budget!.toFixed(0)}`) : `${Math.round(pct)}% del totale`}
        </span>
      </div>
    </div>
  );
}

function CategoryRingsContent({
  categories,
  visible,
}: {
  categories: { id: string; label: string; color: string; value: number; budget: number | null }[];
  visible: boolean;
}) {
  const total = categories.reduce((s, c) => s + c.value, 0);

  return (
    <div className="w-full flex flex-col gap-4">
      <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
        Per categoria
      </span>
      {categories.length === 0 && (
        <p className="text-center text-callout text-muted dark:text-muted-dark py-4">
          Nessuna spesa in questo periodo.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-y-4 gap-x-2">
        {categories.map((c) => (
          <CategoryRing key={c.id} category={c} total={total} visible={visible} />
        ))}
      </div>
    </div>
  );
}

function getRangeTotal(expenses: Transaction[], from: string, to: string) {
  return expenses.filter((t) => t.date >= from && t.date <= to).reduce((s, t) => s + t.my_share, 0);
}

// Converte un budget mensile nell'equivalente del periodo selezionato (stessa logica del budget generale).
function scaleToPeriod(monthlyAmount: number, period: Period, dim: number) {
  if (period === "day") return monthlyAmount / dim;
  if (period === "week") return (monthlyAmount / dim) * 7;
  return monthlyAmount;
}

function PannelloScelta({ scelta }: { scelta: Scelta }) {
  if (scelta.tipo === "categoria") {
    return (
      <div className="w-full rounded-2xl bg-surface2 dark:bg-surface2-dark px-4 py-3 flex items-center gap-3">
        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: scelta.colore }} />
        <div className="min-w-0 flex-1">
          <p className="text-callout font-medium truncate">{scelta.nome}</p>
          <p className="text-footnote text-muted dark:text-muted-dark">categoria</p>
        </div>
        <p className="text-callout tabular-nums font-medium shrink-0">
          €{Math.round(scelta.importo)} · {Math.round(scelta.pct)}%
        </p>
      </div>
    );
  }
  return (
    <div className="w-full rounded-2xl bg-surface2 dark:bg-surface2-dark px-4 py-3 flex flex-col gap-2">
      {scelta.voci.map((v, i) => (
        <div key={`${v.date}-${v.nome}-${i}`} className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full shrink-0 bg-[#ff3b30]" />
          <div className="min-w-0 flex-1">
            <p className="text-callout font-medium truncate">{v.nome}</p>
            <p className="text-footnote text-muted dark:text-muted-dark">prevista · {formattaGiorno(v.date)}</p>
          </div>
          <p className="text-callout tabular-nums font-medium shrink-0">€{v.importo.toFixed(2)}</p>
        </div>
      ))}
    </div>
  );
}

// --- le tre card della pagina -----------------------------------------------

function HeroCard({
  period,
  onPeriodChange,
  travelDate,
  onTravelDateChange,
  now,
  range,
  byCategory,
  budget,
  budgetLabel,
  totalPeriod,
  perDay,
  pctText,
  orologio,
}: {
  period: Period;
  onPeriodChange: (p: Period) => void;
  travelDate: Date;
  onTravelDateChange: (d: Date) => void;
  now: Date;
  range: ReturnType<typeof getRange>;
  byCategory: { id: string; label: string; color: string; value: number }[];
  budget: number;
  budgetLabel: string;
  totalPeriod: number;
  perDay: number;
  pctText: string;
  orologio: Orologio | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const ruota = useRef<HTMLDivElement>(null);
  const [lato, setLato] = useState(320);
  const [scelta, setScelta] = useState<Scelta | null>(null);

  useLayoutEffect(() => {
    const carta = box.current;
    const slot = ruota.current;
    const pozzo = carta?.closest("main");
    if (!carta || !pozzo || !slot) return;
    const misura = () => {
      carta.style.minHeight = `${Math.max(pozzo.clientHeight - 4, 320)}px`;
      const latoNuovo = Math.floor(Math.min(slot.clientWidth, slot.clientHeight));
      if (latoNuovo > 80) setLato(latoNuovo);
    };
    misura();
    const occhio = new ResizeObserver(misura);
    occhio.observe(pozzo);
    occhio.observe(slot);
    return () => occhio.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className="w-full rounded-2xl bg-surface dark:bg-surface-dark px-3 pt-3 pb-3 flex flex-col items-center gap-2"
    >      <div className="w-full flex items-center justify-between gap-2">
        <SegmentedControl
          options={PERIOD_OPTIONS}
          value={period}
          onChange={onPeriodChange}
          className="min-w-0"
        />
        <div className="shrink-0">
          <TimeTravelMenu travelDate={travelDate} today={now} onPick={onTravelDateChange} />
        </div>
      </div>

      <div className="w-full flex items-center justify-center gap-3">
        <button
          onClick={() => onTravelDateChange(shiftPeriod(travelDate, period, -1))}
          aria-label="Periodo precedente"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span
          className={`text-callout font-medium min-w-[9rem] text-center ${
            !range.current ? "text-acc-cyan" : ""
          }`}
        >
          {formatPeriodLabel(period, range, now)}
        </span>
        <button
          onClick={() => onTravelDateChange(shiftPeriod(travelDate, period, 1))}
          disabled={range.current}
          aria-label="Periodo successivo"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <div ref={ruota} className="flex-1 flex items-center justify-center min-h-0 w-full">
        <RadialGauge
          size={lato}
          segments={byCategory}
          budget={budget}
          centerLabel={`€${totalPeriod.toFixed(0)}`}
          centerSub={
            orologio
              ? ritmo(totalPeriod, budget, orologio.oggi, orologio.passi) ??
                (budget > 0 ? `${pctText} del budget` : pctText)
              : budget > 0
                ? `${pctText} del budget`
                : pctText
          }
          orologio={orologio}
          onScelta={setScelta}
        />
      </div>

      {scelta ? <PannelloScelta scelta={scelta} /> : null}
      <div className="w-full flex flex-col gap-2">
        <div className="w-full flex justify-between text-callout px-1">
          <span className="text-muted dark:text-muted-dark">{budgetLabel}</span>
          <span className="font-medium tabular-nums">€{budget.toFixed(0)}</span>
        </div>
        <PerDayRow perDay={perDay} />
      </div>
    </div>
  );
}

function TimeCard({
  last14,
  totalPeriod,
  previousTotal,
  period,
  range,
  prevRange,
}: {
  last14: { date: string; total: number }[];
  totalPeriod: number;
  previousTotal: number;
  period: Period;
  range: ReturnType<typeof getRange>;
  prevRange: { from: string; to: string };
}) {
  const [ref, visible] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="w-full rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-5">
      <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">
        Nel tempo
      </span>
      <SparklineContent data={last14} visible={visible} />
      <div className="h-px bg-black/[0.06] dark:bg-white/10" />
      <TrendContent
        current={totalPeriod}
        previous={previousTotal}
        period={period}
        range={range}
        prevRange={prevRange}
        visible={visible}
      />
    </div>
  );
}

function WhereCard({
  byCategory,
  topCategory,
  topMerchant,
}: {
  byCategory: { id: string; label: string; color: string; value: number; budget: number | null }[];
  topCategory: { label: string; color: string; value: number } | null;
  topMerchant: { name: string; value: number } | null;
}) {
  const [ref, visible] = useInView<HTMLDivElement>();
  return (
    <div ref={ref} className="w-full rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-5">
      <span className="text-caption text-muted dark:text-muted-dark uppercase tracking-wide">Dove</span>
      <CategoryRingsContent categories={byCategory} visible={visible} />
      <div className="h-px bg-black/[0.06] dark:bg-white/10" />
      <TopContent topCategory={topCategory} topMerchant={topMerchant} />
    </div>
  );
}

export default function Andamento() {
  const { user, categories, transactions } = useApp();
  const [period, setPeriod] = useState<Period>("month");
  const [travelDate, setTravelDate] = useState<Date>(() => new Date());

  const now = new Date();
  const range = useMemo(() => getRange(period, travelDate, now), [period, travelDate]);
  const prevRange = useMemo(
    () => getRange(period, shiftPeriod(travelDate, period, -1), now),
    [period, travelDate]
  );
  const dimForBudget = daysInMonth(range.ref.getFullYear(), range.ref.getMonth());

  const expenses = useMemo(
    () => transactions.filter((t) => !t.is_income),
    [transactions]
  );

  const periodTx = useMemo(
    () => expenses.filter((t) => t.date >= range.from && t.date <= range.to),
    [expenses, range]
  );

  const previousTotal = useMemo(
    () => getRangeTotal(expenses, prevRange.from, prevRange.to),
    [expenses, prevRange]
  );

  const last14 = useMemo(() => {
    const days: { date: string; total: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = toISODate(d);
      days.push({ date: iso, total: getRangeTotal(expenses, iso, iso) });
    }
    return days;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses]);

  const budget = user
    ? period === "day"
      ? user.monthly_budget / dimForBudget
      : period === "week"
      ? (user.monthly_budget / dimForBudget) * 7
      : user.monthly_budget
    : 0;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTx) {
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.my_share);
    }
    return categories
      .map((c) => ({
        id: c.id,
        label: c.name,
        color: c.color,
        value: map.get(c.id) ?? 0,
        budget: c.budget != null ? scaleToPeriod(c.budget, period, dimForBudget) : null,
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [periodTx, categories, period, dimForBudget]);

  const topMerchant = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTx) map.set(t.name, (map.get(t.name) ?? 0) + t.my_share);
    let best: { name: string; value: number } | null = null;
    map.forEach((value, name) => {
      if (!best || value > best.value) best = { name, value };
    });
    return best;
  }, [periodTx]);

  const totalPeriod = byCategory.reduce((s, c) => s + c.value, 0);
  const perDay = range.daysElapsed > 0 ? totalPeriod / range.daysElapsed : 0;
  const pctText = budget > 0 ? `${Math.round((totalPeriod / budget) * 100)}%` : "—";

  const orologio = useMemo<Orologio | null>(() => {
    if (period === "day" || !user) return null;
    const from = range.from;
    const to = finePiena(from, range.daysTotal);
    const piani = leggiPiani(user.code);
    const occ = occorrenzePiani(piani, from, to);
    const programmati = occ
      .map((o) => {
        const piano = piani.find((p) => p.id === o.piano_id);
        return {
          i: indiceNelPeriodo(from, o.date),
          nome: piano?.name ?? "Spesa prevista",
          importo: o.importo,
          date: o.date,
        };
      })
      .filter((v) => v.i >= 0 && v.i < range.daysTotal);
    return {
      passi: range.daysTotal,
      oggi: range.current ? range.daysElapsed - 1 : null,
      programmati,
      etichette: Array.from({ length: range.daysTotal }, (_, i) => {
        const [y, m, d] = from.split("-").map(Number);
        return String(new Date(y, m - 1, d + i).getDate());
      }),
    };
  }, [period, range, user]);

  const budgetLabel =
    period === "day" ? "Budget giornaliero" : period === "week" ? "Budget settimanale" : "Budget mensile";

  return (
    <div className="flex flex-col items-center gap-6 animate-rise">
      <HeroCard
        period={period}
        onPeriodChange={setPeriod}
        travelDate={travelDate}
        onTravelDateChange={setTravelDate}
        now={now}
        range={range}
        byCategory={byCategory}
        budget={budget}
        budgetLabel={budgetLabel}
        totalPeriod={totalPeriod}
        perDay={perDay}
        pctText={pctText}
        orologio={orologio}
      />

      <TimeCard
        last14={last14}
        totalPeriod={totalPeriod}
        previousTotal={previousTotal}
        period={period}
        range={range}
        prevRange={prevRange}
      />

      <WhereCard byCategory={byCategory} topCategory={byCategory[0] ?? null} topMerchant={topMerchant} />
    </div>
  );
}
