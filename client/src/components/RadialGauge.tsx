import { useEffect, useRef, useState } from "react";
import { accent } from "../lib/accent";

export interface GaugeSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface Props {
  segments: GaugeSegment[];
  budget: number;
  size?: number;
  centerLabel: string;
  centerSub: string;
  /** Importo previsto nel periodo: non entra nel totale pieno, solo nell'arco tratteggiato. */
  programmati?: number;
}

const R = 84;
const R_OVERFLOW = 96;
const CIRC = 2 * Math.PI * R;
const CIRC_OVERFLOW = 2 * Math.PI * R_OVERFLOW;

export default function RadialGauge({
  segments,
  budget,
  size = 240,
  centerLabel,
  centerSub,
  programmati = 0,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const pct = budget > 0 ? Math.min(total / budget, 1) : 0;
  const overBudget = budget > 0 && total > budget;
  const overflowFraction = overBudget ? (total - budget) / budget : 0;
  const pink = accent("pink", "#ff2ecb");
  const green = accent("green", "#39ff88");
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMounted(true));
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  let cursor = 0;
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const fraction = overBudget
        ? total > 0
          ? seg.value / total
          : 0
        : budget > 0
        ? seg.value / budget
        : total > 0
        ? seg.value / total
        : 0;
      const start = cursor;
      cursor += fraction;
      return { ...seg, start, fraction };
    });

  const plannedFrac =
    budget > 0 && programmati > 0 ? Math.min(programmati / budget, Math.max(0, 1 - cursor)) : 0;

  const glowAngle = mounted ? pct * 360 : 0;
  const glowX = Math.cos((glowAngle - 90) * (Math.PI / 180)) * R;
  const glowY = Math.sin((glowAngle - 90) * (Math.PI / 180)) * R;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="-rotate-90 overflow-visible">
        <circle
          cx="100"
          cy="100"
          r={R}
          fill="none"
          stroke="currentColor"
          className="text-black/5 dark:text-white/10"
          strokeWidth="14"
        />
        {arcs.map((seg, i) => (
          <circle
            key={seg.id}
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={seg.color}
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={mounted ? CIRC * (1 - seg.fraction) : CIRC}
            style={{
              transform: `rotate(${seg.start * 360}deg)`,
              transformOrigin: "100px 100px",
              transition: `stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1) ${i * 0.08}s`,
              filter: `drop-shadow(0 0 6px ${seg.color}aa)`,
            }}
          />
        ))}
        {plannedFrac > 0 && (
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={green}
            strokeWidth="14"
            strokeLinecap="butt"
            strokeDasharray={`${CIRC * plannedFrac} ${CIRC}`}
            strokeDashoffset={0}
            opacity={0.55}
            style={{
              transform: `rotate(${cursor * 360}deg)`,
              transformOrigin: "100px 100px",
            }}
          />
        )}
        {plannedFrac > 0 && (
          <circle
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={green}
            strokeWidth="14"
            strokeLinecap="butt"
            strokeDasharray="5 7"
            opacity={0.9}
            style={{
              transform: `rotate(${cursor * 360}deg)`,
              transformOrigin: "100px 100px",
              clipPath: `circle(${R + 8}px at 100px 100px)`,
            }}
          />
        )}
        {overBudget && (
          <circle
            cx="100"
            cy="100"
            r={R_OVERFLOW}
            fill="none"
            stroke={pink}
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={CIRC_OVERFLOW}
            strokeDashoffset={mounted ? CIRC_OVERFLOW * (1 - Math.min(overflowFraction, 1)) : CIRC_OVERFLOW}
            className="gauge-overflow-pulse"
            style={{
              transition: "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1) 0.4s",
            }}
          />
        )}
      </svg>
      {mounted && !overBudget && total > 0 && (
        <div
          className="absolute rounded-full h-3 w-3 bg-white transition-all duration-1000 ease-out"
          style={{
            left: `calc(50% + ${(glowX / R) * (size / 2 - 7)}px - 6px)`,
            top: `calc(50% + ${(glowY / R) * (size / 2 - 7)}px - 6px)`,
            boxShadow: "0 0 12px 4px rgba(255,255,255,0.9)",
          }}
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-largeTitle font-semibold tracking-tight tabular-nums ${
            overBudget ? "text-acc-pink" : ""
          }`}
        >
          {centerLabel}
        </span>
        <span className="text-footnote text-muted dark:text-muted-dark mt-1">{centerSub}</span>
        {overBudget && (
          <span className="text-caption font-medium text-acc-pink mt-1 gauge-overflow-pulse">
            oltre €{Math.round(total - budget)}
          </span>
        )}
        {!overBudget && budget > 0 && (
          <span className="text-caption font-medium text-muted dark:text-muted-dark mt-1">
            ancora €{Math.round(budget - total)}
          </span>
        )}
      </div>
    </div>
  );
}
