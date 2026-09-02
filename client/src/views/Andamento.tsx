import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/AppContext";
import RadialGauge from "../components/RadialGauge";
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

const PERIOD_LABELS: Record<Period, string> = {
  day: "Giornaliero",
  week: "Settimanale",
  month: "Mensile",
};

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
            ? "bg-neon-cyan/15 text-neon-cyan"
            : open
            ? "bg-neon-green/15 text-neon-green"
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
          <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
            Viaggia nel tempo
          </span>
          <input
            type="date"
            defaultValue={toISODate(travelDate)}
            max={toISODate(today)}
            onChange={handleChange}
            className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-neon-cyan/60"
          />
          <p className="text-[11px] text-muted dark:text-muted-dark leading-snug">
            Scegli un giorno per rivedere i tuoi dati come se fossi lì: giornaliero, settimanale e
            mensile si aggiornano di conseguenza.
          </p>
          {!isToday && (
            <button
              onClick={() => {
                onPick(today);
                setOpen(false);
              }}
              className="text-sm text-neon-green font-medium text-left"
            >
              ← Torna a oggi
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// Piccolo anello di progresso animato, riusato per le categorie e la proiezione.
function MiniRing({
  pct,
  color,
  size = 60,
  strokeWidth = 6,
  children,
}: {
  pct: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

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
          strokeDashoffset={mounted ? circ * (1 - clamped / 100) : circ}
          style={{
            transition: "stroke-dashoffset 0.9s cubic-bezier(0.22,1,0.36,1)",
            filter: `drop-shadow(0 0 4px ${color}99)`,
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
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

function TrendCard({
  current,
  previous,
  period,
  range,
  prevRange,
}: {
  current: number;
  previous: number;
  period: Period;
  range: { from: string; to: string };
  prevRange: { from: string; to: string };
}) {
  const animated = useCountUp(current);
  const rangeLabel = formatRangeShort(period, range);
  const prevRangeLabel = formatRangeShort(period, prevRange);
  if (previous <= 0) {
    return (
      <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-2 flex-1 min-w-0">
        <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
          Vs periodo prec.
        </span>
        <span className="text-sm text-muted dark:text-muted-dark">Nessun dato di confronto</span>
        <span className="text-[10px] text-muted dark:text-muted-dark truncate">
          {rangeLabel} vs {prevRangeLabel}
        </span>
      </div>
    );
  }
  const deltaPct = ((current - previous) / previous) * 100;
  const up = deltaPct >= 0;
  const color = up ? "#ff2ecb" : "#39ff88";
  const textColor = up ? "text-neon-pink" : "text-neon-green";
  const maxVal = Math.max(current, previous, 1);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3 flex-1 min-w-0 overflow-hidden">
      <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
        Vs periodo prec.
      </span>
      <div className="flex items-end gap-3">
        <div className="flex flex-col items-center gap-1">
          <div className="h-12 w-3 rounded-full bg-black/[0.06] dark:bg-white/10 relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full bg-muted/50 dark:bg-muted-dark/50 transition-all duration-700 ease-out"
              style={{ height: mounted ? `${(previous / maxVal) * 100}%` : 0 }}
            />
          </div>
          <span className="text-[9px] text-muted dark:text-muted-dark">prima</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-12 w-3 rounded-full bg-black/[0.06] dark:bg-white/10 relative overflow-hidden">
            <div
              className="absolute bottom-0 left-0 right-0 rounded-full transition-all duration-700 ease-out"
              style={{
                height: mounted ? `${(current / maxVal) * 100}%` : 0,
                background: color,
                boxShadow: `0 0 8px 0 ${color}aa`,
              }}
            />
          </div>
          <span className="text-[9px] text-muted dark:text-muted-dark">ora</span>
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className={`flex items-center gap-1 ${textColor}`}>
            <TrendArrow up={up} className="h-4 w-4 shrink-0" />
            <span className="text-xl font-semibold tabular-nums">{Math.abs(deltaPct).toFixed(0)}%</span>
          </div>
          <span className="text-[11px] text-muted dark:text-muted-dark tabular-nums truncate">
            €{animated.toFixed(0)} vs €{previous.toFixed(0)}
          </span>
          <span className="text-[10px] text-muted dark:text-muted-dark truncate">
            {rangeLabel} vs {prevRangeLabel}
          </span>
        </div>
      </div>
    </div>
  );
}

function ProjectionCard({
  perDay,
  daysTotal,
  budget,
}: {
  perDay: number;
  daysTotal: number;
  budget: number;
}) {
  const projected = perDay * daysTotal;
  const animated = useCountUp(projected);
  const over = budget > 0 && projected > budget;
  const pct = budget > 0 ? (projected / budget) * 100 : 0;
  const color = over ? "#ff2ecb" : "#39ff88";
  return (
    <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex items-center gap-3 flex-1 min-w-0 overflow-hidden">
      <MiniRing pct={pct} color={color} size={52} strokeWidth={5}>
        <span className="text-[10px] font-semibold tabular-nums" style={{ color }}>
          {Math.round(pct)}%
        </span>
      </MiniRing>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
          Proiezione
        </span>
        <span className="text-lg font-semibold tabular-nums" style={{ color }}>
          €{animated.toFixed(0)}
        </span>
        <span className="text-[11px] text-muted dark:text-muted-dark truncate">
          {budget > 0
            ? over
              ? `€${(projected - budget).toFixed(0)} oltre budget`
              : "in linea col budget"
            : "in base al ritmo attuale"}
        </span>
      </div>
    </div>
  );
}

function TopCard({
  topCategory,
  topMerchant,
}: {
  topCategory: { label: string; color: string; value: number } | null;
  topMerchant: { name: string; value: number } | null;
}) {
  if (!topCategory && !topMerchant) return null;
  return (
    <div className="w-full rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
      <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
        In evidenza
      </span>
      <div className="flex items-center gap-4 flex-wrap">
        {topCategory && (
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="h-2.5 w-2.5 rounded-full shrink-0"
              style={{ background: topCategory.color, boxShadow: `0 0 6px ${topCategory.color}` }}
            />
            <span className="text-sm truncate">
              {topCategory.label} <span className="text-muted dark:text-muted-dark">· €{topCategory.value.toFixed(0)}</span>
            </span>
          </div>
        )}
        {topCategory && topMerchant && <span className="text-muted dark:text-muted-dark">·</span>}
        {topMerchant && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-neon-amber shrink-0">★</span>
            <span className="text-sm truncate">
              {topMerchant.name} <span className="text-muted dark:text-muted-dark">· €{topMerchant.value.toFixed(0)}</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ data }: { data: { date: string; total: number }[] }) {
  const [mounted, setMounted] = useState(false);
  const [hover, setHover] = useState<number | null>(null);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const max = Math.max(1, ...data.map((d) => d.total));
  const today = toISODate(new Date());

  return (
    <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
          Ultimi 14 giorni
        </span>
        <span className="text-xs text-muted dark:text-muted-dark tabular-nums shrink-0">
          picco €{max === 1 ? 0 : max.toFixed(0)}
        </span>
      </div>
      <div className="flex items-end gap-1.5 h-20">
        {data.map((d, i) => {
          const isToday = d.date === today;
          const h = mounted ? Math.max(3, (d.total / max) * 100) : 0;
          const isHover = hover === i;
          return (
            <div
              key={d.date}
              className="relative flex-1 h-full cursor-pointer"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onTouchStart={() => setHover(i)}
            >
              {isHover && (
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink dark:bg-white text-white dark:text-black text-[10px] font-medium px-2 py-1 shadow-lg z-10 animate-rise">
                  €{d.total.toFixed(0)} · {formatShortDate(d.date)}
                </div>
              )}
              <div className="h-full w-full rounded-full bg-black/5 dark:bg-white/10 relative overflow-hidden">
                <div
                  className="absolute bottom-0 left-0 right-0 rounded-full transition-all ease-out"
                  style={{
                    height: `${h}%`,
                    transitionDuration: "800ms",
                    transitionDelay: `${i * 35}ms`,
                    background: isHover ? "#39ff88" : isToday ? "#39ff88" : "#39ff8855",
                    boxShadow: isHover || isToday ? "0 0 10px #39ff88aa" : "none",
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
}: {
  category: { id: string; label: string; color: string; value: number; budget: number | null };
  total: number;
}) {
  const hasBudget = c.budget != null && c.budget > 0;
  const over = hasBudget && c.value > c.budget!;
  const pct = hasBudget
    ? (c.value / c.budget!) * 100
    : total > 0
    ? (c.value / total) * 100
    : 0;
  const color = over ? "#ff2ecb" : c.color;

  return (
    <div className="flex flex-col items-center gap-2 w-[5.5rem] shrink-0">
      <MiniRing pct={pct} color={color}>
        <span className="text-[13px] font-semibold tabular-nums leading-none" style={{ color }}>
          €{c.value.toFixed(0)}
        </span>
      </MiniRing>
      <div className="flex flex-col items-center gap-0.5 max-w-full">
        <span className="text-xs font-medium truncate max-w-full">{c.label}</span>
        <span className="text-[10px] text-muted dark:text-muted-dark truncate max-w-full">
          {hasBudget ? (over ? "oltre budget" : `su €${c.budget!.toFixed(0)}`) : `${Math.round(pct)}% del totale`}
        </span>
      </div>
    </div>
  );
}

function CategoryBreakdown({
  categories,
}: {
  categories: { id: string; label: string; color: string; value: number; budget: number | null }[];
}) {
  const total = categories.reduce((s, c) => s + c.value, 0);

  return (
    <div className="w-full rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-4">
      <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
        Per categoria
      </span>
      {categories.length === 0 && (
        <p className="text-center text-sm text-muted dark:text-muted-dark py-4">
          Nessuna spesa in questo periodo.
        </p>
      )}
      <div className="flex flex-wrap justify-center gap-y-4 gap-x-2">
        {categories.map((c) => (
          <CategoryRing key={c.id} category={c} total={total} />
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

  const budgetLabel =
    period === "day" ? "Budget giornaliero" : period === "week" ? "Budget settimanale" : "Budget mensile";

  const showProjection = period !== "day" && range.current && range.daysElapsed < range.daysTotal;

  return (
    <div className="flex flex-col items-center gap-6 animate-rise">
      <div className="w-full flex items-center justify-between gap-2">
        <div className="inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-sm">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-full transition-colors ${
                period === p
                  ? "bg-white dark:bg-black text-ink dark:text-ink-dark shadow"
                  : "text-muted dark:text-muted-dark"
              }`}
            >
              {PERIOD_LABELS[p]}
            </button>
          ))}
        </div>
        <TimeTravelMenu travelDate={travelDate} today={now} onPick={setTravelDate} />
      </div>

      <div className="w-full flex items-center justify-center gap-3">
        <button
          onClick={() => setTravelDate((d) => shiftPeriod(d, period, -1))}
          aria-label="Periodo precedente"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span
          className={`text-sm font-medium min-w-[9rem] text-center ${
            !range.current ? "text-neon-cyan" : ""
          }`}
        >
          {formatPeriodLabel(period, range, now)}
        </span>
        <button
          onClick={() => setTravelDate((d) => shiftPeriod(d, period, 1))}
          disabled={range.current}
          aria-label="Periodo successivo"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      <RadialGauge
        segments={byCategory}
        budget={budget}
        centerLabel={`€${totalPeriod.toFixed(0)}`}
        centerSub={`${pctText} · €${perDay.toFixed(0)}/giorno`}
      />

      <div className="w-full flex justify-between text-sm px-1">
        <span className="text-muted dark:text-muted-dark">{budgetLabel}</span>
        <span className="font-medium tabular-nums">€{budget.toFixed(0)}</span>
      </div>

      <div className="w-full flex gap-3">
        <TrendCard
          current={totalPeriod}
          previous={previousTotal}
          period={period}
          range={range}
          prevRange={prevRange}
        />
        {showProjection && (
          <ProjectionCard perDay={perDay} daysTotal={range.daysTotal} budget={budget} />
        )}
      </div>

      <CategoryBreakdown categories={byCategory} />

      <Sparkline data={last14} />

      <TopCard topCategory={byCategory[0] ?? null} topMerchant={topMerchant} />
    </div>
  );
}
