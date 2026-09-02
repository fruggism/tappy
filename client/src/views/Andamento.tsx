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

const PERIOD_LABELS: Record<Period, string> = {
  day: "Giornaliero",
  week: "Settimanale",
  month: "Mensile",
};

function getRange(period: Period, offset: number, now: Date) {
  const today = toISODate(now);

  if (period === "day") {
    const d = new Date(now);
    d.setDate(d.getDate() - offset);
    const iso = toISODate(d);
    return { from: iso, to: iso, daysTotal: 1, daysElapsed: 1, ref: d };
  }

  if (period === "week") {
    const base = startOfWeek(now);
    const start = new Date(base);
    start.setDate(start.getDate() - offset * 7);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    const daysElapsed =
      offset === 0 ? Math.floor((now.getTime() - start.getTime()) / 86400000) + 1 : 7;
    return {
      from: toISODate(start),
      to: offset === 0 ? today : toISODate(end),
      daysTotal: 7,
      daysElapsed,
      ref: start,
    };
  }

  // month
  const ref = new Date(now.getFullYear(), now.getMonth() - offset, 1);
  const dim = daysInMonth(ref.getFullYear(), ref.getMonth());
  const prefix = `${ref.getFullYear()}-${String(ref.getMonth() + 1).padStart(2, "0")}`;
  return {
    from: `${prefix}-01`,
    to: offset === 0 ? today : `${prefix}-${String(dim).padStart(2, "0")}`,
    daysTotal: dim,
    daysElapsed: offset === 0 ? now.getDate() : dim,
    ref,
  };
}

function formatPeriodLabel(period: Period, offset: number, range: ReturnType<typeof getRange>) {
  if (period === "day") {
    if (offset === 0) return "Oggi";
    if (offset === 1) return "Ieri";
    return range.ref.toLocaleDateString("it-IT", { weekday: "short", day: "numeric", month: "short" });
  }
  if (period === "week") {
    if (offset === 0) return "Questa settimana";
    if (offset === 1) return "Settimana scorsa";
    return `Settimana del ${range.ref.toLocaleDateString("it-IT", { day: "numeric", month: "short" })}`;
  }
  if (offset === 0) return "Questo mese";
  if (offset === 1) return "Mese scorso";
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

function HistoryMenu({
  period,
  onPick,
}: {
  period: Period;
  onPick: (period: Period, offset: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const options: { label: string; period: Period; offset: number }[] = [
    { label: "Oggi", period: "day", offset: 0 },
    { label: "Ieri", period: "day", offset: 1 },
    { label: "Questa settimana", period: "week", offset: 0 },
    { label: "Settimana scorsa", period: "week", offset: 1 },
    { label: "Questo mese", period: "month", offset: 0 },
    { label: "Mese scorso", period: "month", offset: 1 },
  ];

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Vai a un periodo precedente"
        className={`h-8 w-8 flex items-center justify-center rounded-full transition-colors ${
          open
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
        <div className="absolute right-0 top-10 z-10 w-48 rounded-2xl bg-surface dark:bg-surface-dark shadow-xl border border-black/5 dark:border-white/10 overflow-hidden animate-rise py-1">
          {options.map((o) => (
            <button
              key={o.label}
              onClick={() => {
                setOpen(false);
                onPick(o.period, o.offset);
              }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                o.period === period ? "text-neon-green font-medium" : ""
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
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

function TrendCard({ current, previous }: { current: number; previous: number }) {
  const animated = useCountUp(current);
  if (previous <= 0) {
    return (
      <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-2 flex-1 min-w-0">
        <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
          Vs periodo prec.
        </span>
        <span className="text-sm text-muted dark:text-muted-dark">Nessun dato di confronto</span>
      </div>
    );
  }
  const deltaPct = ((current - previous) / previous) * 100;
  const up = deltaPct >= 0;
  const color = up ? "text-neon-pink" : "text-neon-green";
  return (
    <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-2 flex-1 min-w-0 overflow-hidden">
      <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
        Vs periodo prec.
      </span>
      <div className={`flex items-center gap-1.5 ${color}`}>
        <TrendArrow up={up} className="h-4 w-4 shrink-0" />
        <span className="text-xl font-semibold tabular-nums">
          {Math.abs(deltaPct).toFixed(0)}%
        </span>
      </div>
      <span className="text-xs text-muted dark:text-muted-dark tabular-nums truncate">
        €{animated.toFixed(0)} vs €{previous.toFixed(0)}
      </span>
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
  return (
    <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-2 flex-1 min-w-0 overflow-hidden">
      <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
        Proiezione fine periodo
      </span>
      <span className={`text-xl font-semibold tabular-nums ${over ? "text-neon-pink" : "text-neon-green"}`}>
        €{animated.toFixed(0)}
      </span>
      <span className="text-xs text-muted dark:text-muted-dark truncate">
        {budget > 0
          ? over
            ? `€${(projected - budget).toFixed(0)} oltre il budget`
            : "di questo passo, sei in linea"
          : "in base al ritmo attuale"}
      </span>
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
    <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
      <span className="text-xs text-muted dark:text-muted-dark uppercase tracking-wide">
        In evidenza
      </span>
      <div className="flex items-center gap-4">
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
          return (
            <div
              key={d.date}
              className="flex-1 h-full rounded-full bg-black/5 dark:bg-white/10 relative overflow-hidden"
            >
              <div
                className="absolute bottom-0 left-0 right-0 rounded-full transition-all ease-out"
                style={{
                  height: `${h}%`,
                  transitionDuration: "800ms",
                  transitionDelay: `${i * 35}ms`,
                  background: isToday ? "#39ff88" : "#39ff8855",
                  boxShadow: isToday ? "0 0 10px #39ff88aa" : "none",
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function getRangeTotal(expenses: Transaction[], from: string, to: string) {
  return expenses.filter((t) => t.date >= from && t.date <= to).reduce((s, t) => s + t.my_share, 0);
}

export default function Andamento() {
  const { user, categories, transactions } = useApp();
  const [period, setPeriod] = useState<Period>("month");
  const [offset, setOffset] = useState(0);

  const now = new Date();
  const range = useMemo(() => getRange(period, offset, now), [period, offset]);
  const prevRange = useMemo(() => getRange(period, offset + 1, now), [period, offset]);
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
      .map((c) => ({ id: c.id, label: c.name, color: c.color, value: map.get(c.id) ?? 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [periodTx, categories]);

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

  const showProjection = period !== "day" && offset === 0 && range.daysElapsed < range.daysTotal;

  function changePeriod(p: Period) {
    setPeriod(p);
    setOffset(0);
  }

  return (
    <div className="flex flex-col items-center gap-6 animate-rise">
      <div className="w-full flex items-center justify-between gap-2">
        <div className="inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-sm">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => changePeriod(p)}
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
        <HistoryMenu
          period={period}
          onPick={(p, o) => {
            setPeriod(p);
            setOffset(o);
          }}
        />
      </div>

      <div className="w-full flex items-center justify-center gap-3">
        <button
          onClick={() => setOffset((o) => o + 1)}
          aria-label="Periodo precedente"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span className="text-sm font-medium min-w-[9rem] text-center">
          {formatPeriodLabel(period, offset, range)}
        </span>
        <button
          onClick={() => setOffset((o) => Math.max(0, o - 1))}
          disabled={offset === 0}
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
        <TrendCard current={totalPeriod} previous={previousTotal} />
        {showProjection && (
          <ProjectionCard perDay={perDay} daysTotal={range.daysTotal} budget={budget} />
        )}
      </div>

      <TopCard topCategory={byCategory[0] ?? null} topMerchant={topMerchant} />

      <div className="w-full flex flex-col gap-3">
        {byCategory.length === 0 && (
          <p className="text-center text-sm text-muted dark:text-muted-dark py-8">
            Nessuna spesa in questo periodo.
          </p>
        )}
        {byCategory.map((c) => {
          const pct = totalPeriod > 0 ? (c.value / totalPeriod) * 100 : 0;
          return (
            <div key={c.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{c.label}</span>
                <span className="tabular-nums text-muted dark:text-muted-dark">
                  €{c.value.toFixed(0)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: c.color,
                    boxShadow: `0 0 8px 0 ${c.color}aa`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <Sparkline data={last14} />
    </div>
  );
}
