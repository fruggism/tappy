import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/AppContext";
import { haptic, HAPTIC } from "../lib/haptics";
import { accent } from "../lib/accent";

// --- geometria (viewBox 0 0 300 300) ---------------------------------------
const CX = 150;
const CY = 150;
const R_ARC = 122; // arco del budget
const R_TICK = 108; // tacche dei giorni
const R_BAR = 100; // base delle barre, che crescono verso il centro
const BAR_MAX = 38;

// --- gesto ------------------------------------------------------------------
const STEP_PX = 72; // pixel di trascinamento per un mese
const RUBBER = 0.35; // compressione oltre i limiti
const AXIS_LOCK_PX = 10; // dopo quanti px si decide l'asse
const MONTHS_BACK = 11; // quanto indietro si può scorrere

export interface SpendingClockProps {
  /** 0 = mese corrente, -1 = mese scorso, … fino a -MONTHS_BACK. */
  offset: number;
  onOffsetChange: (offset: number) => void;
}

function daysInMonth(y: number, m: number) {
  return new Date(y, m + 1, 0).getDate();
}

function monthFromOffset(offset: number) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function monthLabel(offset: number) {
  if (offset === 0) return "Questo mese";
  if (offset === -1) return "Mese scorso";
  const d = monthFromOffset(offset);
  const l = d.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return l.charAt(0).toUpperCase() + l.slice(1);
}

function shortMonthLabel(offset: number) {
  const l = monthFromOffset(offset).toLocaleDateString("it-IT", { month: "short" });
  return l.charAt(0).toUpperCase() + l.slice(1);
}

/** Punto sull'anello: frazione 0-1 del periodo, mezzanotte del giorno 1 in alto. */
function pol(r: number, frac: number) {
  const a = ((frac * 360 - 90) * Math.PI) / 180;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function arcPath(r: number, from: number, to: number) {
  const end = to - from >= 0.9999 ? from + 0.9999 : to;
  const p0 = pol(r, from);
  const p1 = pol(r, end);
  const large = end - from > 0.5 ? 1 : 0;
  return `M ${p0.x.toFixed(2)} ${p0.y.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`;
}

export default function SpendingClock({ offset, onOffsetChange }: SpendingClockProps) {
  const { user, categories, transactions } = useApp();
  const [dragging, setDragging] = useState(false);

  const today = new Date();
  const month = monthFromOffset(offset);
  const isCurrent = offset === 0;
  const days = daysInMonth(month.getFullYear(), month.getMonth());
  const elapsed = isCurrent ? today.getDate() : days;
  const budget = user?.monthly_budget ?? 0;

  const colorById = useMemo(
    () => new Map(categories.map((c) => [c.id, c.color])),
    [categories]
  );

  // Totale e categoria dominante per ogni giorno del mese mostrato.
  const perDay = useMemo(() => {
    const prefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, "0")}`;
    const totals = Array.from({ length: days }, () => 0);
    const byCat = Array.from({ length: days }, () => new Map<string, number>());

    for (const t of transactions) {
      if (t.is_income) continue;
      if (!t.date.startsWith(prefix)) continue;
      const i = Number(t.date.slice(8, 10)) - 1;
      if (i < 0 || i >= days) continue;
      totals[i] += t.my_share;
      byCat[i].set(t.category_id, (byCat[i].get(t.category_id) ?? 0) + t.my_share);
    }

    return totals.map((total, i) => {
      let bestId: string | null = null;
      let bestVal = -1;
      byCat[i].forEach((v, id) => {
        if (v > bestVal) {
          bestVal = v;
          bestId = id;
        }
      });
      return { total, color: (bestId && colorById.get(bestId)) || "#8a8f98" };
    });
  }, [transactions, month, days, colorById]);

  const spent = perDay.reduce((s, d) => s + d.total, 0);
  const peak = Math.max(1, ...perDay.map((d) => d.total));
  const budgetFrac = budget > 0 ? Math.min(spent / budget, 1) : 0;
  const todayFrac = elapsed / days;
  const ahead = isCurrent && budget > 0 && budgetFrac > todayFrac;

  const green = accent("green", "#39ff88");
  const pink = accent("pink", "#ff2ecb");
  const cyan = accent("cyan", "#00e5ff");
  const arcColor = isCurrent ? green : cyan;

  // L'anello si anima al primo montaggio, non a ogni cambio di mese.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  // Avvisa una sola volta quando si entra in un mese fuori budget.
  const prevOver = useRef(false);
  useEffect(() => {
    const over = budget > 0 && spent > budget;
    if (over && !prevOver.current) haptic(HAPTIC.overBudget);
    prevOver.current = over;
  }, [spent, budget]);

  // --- gesto scrub ----------------------------------------------------------
  // Lo stato del gesto vive in un ref, non in useState: `dragging` serve solo al
  // cursore, e leggerlo qui perderebbe il primo pointermove del trascinamento.
  const drag = useRef({
    x: 0,
    y: 0,
    from: 0,
    axis: null as null | "x" | "y",
    active: false,
    moved: false,
    bumped: false,
  });

  function onPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    drag.current = {
      x: e.clientX,
      y: e.clientY,
      from: offset,
      axis: null,
      active: true,
      moved: false,
      bumped: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging(true);
  }

  function onPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d.active) return;

    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;

    // L'asse si decide una volta sola: se il movimento è verticale, lo scroll
    // della pagina resta libero e il gesto si ritira fino al pointerup.
    if (d.axis === null) {
      if (Math.abs(dx) < AXIS_LOCK_PX && Math.abs(dy) < AXIS_LOCK_PX) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
      if (d.axis === "y") {
        d.active = false;
        setDragging(false);
        return;
      }
    }

    // Trascinare a sinistra porta avanti nel tempo.
    let target = d.from - dx / STEP_PX;
    if (target > 0) target *= RUBBER;
    if (target < -MONTHS_BACK) target = -MONTHS_BACK + (target + MONTHS_BACK) * RUBBER;

    const next = Math.max(-MONTHS_BACK, Math.min(0, Math.round(target)));
    if (next !== offset) {
      d.moved = true;
      onOffsetChange(next);
      haptic(HAPTIC.tick);
    } else if (Math.abs(target - next) > 0.5) {
      // Si sta spingendo contro un limite: il doppio colpo suona una volta sola,
      // non a ogni frame del trascinamento.
      if (!d.bumped) {
        d.bumped = true;
        haptic(HAPTIC.limit);
      }
    } else {
      d.bumped = false;
    }
  }

  function endDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    if (drag.current.moved) haptic(HAPTIC.snap);
    drag.current.active = false;
    drag.current.axis = null;
    drag.current.moved = false;
    drag.current.bumped = false;
    setDragging(false);
  }

  function step(delta: number) {
    const next = Math.max(-MONTHS_BACK, Math.min(0, offset + delta));
    if (next === offset) {
      haptic(HAPTIC.limit);
      return;
    }
    onOffsetChange(next);
    haptic(HAPTIC.tick);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-1);
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(1);
    }
  }

  // --- verdetto testuale (è anche la versione accessibile del quadrante) -----
  let verdict = "";
  let verdictClass = "text-muted dark:text-muted-dark";
  if (budget > 0) {
    if (isCurrent) {
      const deltaDays = Math.round(Math.abs(budgetFrac - todayFrac) * days);
      verdict = ahead
        ? `▲ ${deltaDays} giorni avanti sul budget`
        : `▼ ${deltaDays} giorni di margine`;
      verdictClass = ahead ? "text-acc-pink" : "text-acc-green";
    } else {
      const over = spent - budget;
      verdict =
        over > 0
          ? `chiuso €${Math.round(over)} oltre il budget`
          : `chiuso con €${Math.round(-over)} di margine`;
      verdictClass = over > 0 ? "text-acc-pink" : "text-muted dark:text-muted-dark";
    }
  }

  const ruler = Array.from({ length: MONTHS_BACK + 1 }, (_, i) => i - MONTHS_BACK);

  return (
    <section className="w-full flex flex-col items-center gap-3">
      {/* intestazione: le frecce restano l'interfaccia primaria */}
      <div className="w-full flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => step(-1)}
          disabled={offset <= -MONTHS_BACK}
          aria-label="Mese precedente"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <span
          className={`text-callout font-medium min-w-[9.5rem] text-center transition-colors ${
            isCurrent ? "" : "text-acc-cyan"
          }`}
        >
          {monthLabel(offset)}
        </span>
        <button
          type="button"
          onClick={() => step(1)}
          disabled={offset >= 0}
          aria-label="Mese successivo"
          className="h-7 w-7 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 18l6-6-6-6" />
          </svg>
        </button>
      </div>

      {/* zona del gesto: il grafico è la maniglia */}
      <div
        role="slider"
        tabIndex={0}
        aria-label="Mese visualizzato — trascina o usa le frecce"
        aria-valuemin={-MONTHS_BACK}
        aria-valuemax={0}
        aria-valuenow={offset}
        aria-valuetext={monthLabel(offset)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={onKeyDown}
        className={`relative touch-none select-none rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-acc-cyan ${
          dragging ? "cursor-grabbing" : "cursor-grab"
        }`}
        style={{ width: 250, height: 250 }}
      >
        <svg viewBox="0 0 300 300" width={250} height={250} className="overflow-visible pointer-events-none">
          <circle cx={CX} cy={CY} r={R_ARC} fill="none" strokeWidth={10} stroke="currentColor" className="text-black/[0.06] dark:text-white/10" />

          {/* tacche dei giorni, marcate sui lunedì */}
          {Array.from({ length: days }, (_, i) => {
            const date = new Date(month.getFullYear(), month.getMonth(), i + 1);
            const strong = date.getDay() === 1;
            const f = i / days;
            const a = pol(R_TICK, f);
            const b = pol(R_TICK - (strong ? 7 : 4), f);
            return (
              <line
                key={i}
                x1={a.x}
                y1={a.y}
                x2={b.x}
                y2={b.y}
                strokeWidth={strong ? 1.6 : 1}
                strokeLinecap="round"
                stroke="currentColor"
                className={strong ? "text-black/25 dark:text-white/30" : "text-black/10 dark:text-white/[0.13]"}
              />
            );
          })}

          {/* le spese, nel giorno in cui sono avvenute */}
          {perDay.map((d, i) => {
            if (d.total <= 0) return null;
            const f = (i + 0.5) / days;
            const len = 6 + (d.total / peak) * BAR_MAX;
            const p0 = pol(R_BAR, f);
            const p1 = pol(R_BAR - (mounted ? len : 0), f);
            return (
              <line
                key={i}
                x1={p0.x}
                y1={p0.y}
                x2={p1.x}
                y2={p1.y}
                stroke={d.color}
                strokeWidth={5}
                strokeLinecap="round"
                opacity={0.92}
                style={{ transition: `all 0.6s cubic-bezier(0.22,1,0.36,1) ${i * 12}ms` }}
              />
            );
          })}

          {/* arco del budget consumato — l'unico elemento con il glow */}
          {budget > 0 && (
            <path
              d={arcPath(R_ARC, 0, mounted ? (ahead ? todayFrac : budgetFrac) : 0)}
              fill="none"
              stroke={arcColor}
              strokeWidth={10}
              strokeLinecap="round"
              style={{
                filter: `drop-shadow(0 0 7px ${arcColor}99)`,
                transition: "d 0.7s cubic-bezier(0.22,1,0.36,1)",
              }}
            />
          )}

          {/* il tratto oltre la lancetta: stai correndo più veloce del budget */}
          {ahead && mounted && (
            <path
              d={arcPath(R_ARC, todayFrac, budgetFrac)}
              fill="none"
              stroke={pink}
              strokeWidth={10}
              strokeLinecap="round"
              className="gauge-overflow-pulse"
            />
          )}

          {/* la lancetta è oggi: solo nel mese corrente */}
          {isCurrent && (
            <>
              <line
                x1={pol(R_ARC + 11, todayFrac).x}
                y1={pol(R_ARC + 11, todayFrac).y}
                x2={pol(R_ARC - 11, todayFrac).x}
                y2={pol(R_ARC - 11, todayFrac).y}
                stroke="currentColor"
                className="text-ink dark:text-white"
                strokeWidth={2}
                strokeLinecap="round"
                opacity={0.85}
              />
              <circle
                cx={pol(R_ARC, todayFrac).x}
                cy={pol(R_ARC, todayFrac).y}
                r={5}
                fill="currentColor"
                className="text-ink dark:text-white"
                style={{ filter: "drop-shadow(0 0 8px rgba(255,255,255,0.9))" }}
              />
            </>
          )}
        </svg>

        {/* centro, in HTML come già fa RadialGauge: eredita i colori del tema */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={`text-largeTitle tabular-nums ${ahead ? "text-acc-pink" : ""}`}>
            €{Math.round(spent)}
          </span>
          {budget > 0 && (
            <span className="text-footnote text-muted dark:text-muted-dark mt-0.5">
              {Math.round((spent / budget) * 100)}% del budget
            </span>
          )}
          <span className="text-caption text-muted dark:text-muted-dark mt-0.5">
            {isCurrent ? `giorno ${elapsed} di ${days}` : "mese chiuso"}
          </span>
        </div>
      </div>

      {/* righello: l'affordance che rende scopribile il gesto */}
      <div
        className="relative w-full h-8 overflow-hidden pointer-events-none"
        style={{ maskImage: "linear-gradient(90deg,transparent,#000 18%,#000 82%,transparent)" }}
        aria-hidden="true"
      >
        <div className="absolute left-1/2 top-0.5 h-7 w-px -translate-x-1/2 bg-black/15 dark:bg-white/20" />
        <div
          className="absolute top-0 left-1/2 flex items-center h-8 transition-transform duration-300 ease-out"
          style={{ transform: `translateX(${-(ruler.indexOf(offset)) * 66 - 33}px)` }}
        >
          {ruler.map((o) => (
            <span
              key={o}
              className={`w-[66px] shrink-0 text-center text-caption ${
                o === offset ? "text-acc-cyan font-semibold" : "text-muted dark:text-muted-dark"
              }`}
            >
              {shortMonthLabel(o)}
            </span>
          ))}
        </div>
      </div>

      {verdict && <p className={`text-footnote font-medium ${verdictClass}`}>{verdict}</p>}

      {!isCurrent && (
        <button
          type="button"
          onClick={() => {
            onOffsetChange(0);
            haptic(HAPTIC.home);
          }}
          className="text-footnote font-medium text-acc-cyan border border-acc-cyan/35 bg-acc-cyan/10 rounded-full px-4 py-1.5"
        >
          ↺ Torna a oggi
        </button>
      )}
    </section>
  );
}
