import { useEffect, useRef, useState } from "react";

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
}

const R = 84;
const R_OVERFLOW = 96;
const CIRC = 2 * Math.PI * R;
const CIRC_OVERFLOW = 2 * Math.PI * R_OVERFLOW;

export default function RadialGauge({ segments, budget, size = 240, centerLabel, centerSub }: Props) {
  const [mounted, setMounted] = useState(false);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const pct = budget > 0 ? Math.min(total / budget, 1) : 0;
  const overBudget = budget > 0 && total > budget;
  // Quanto si è andati oltre, come frazione del budget stesso (0-1, poi eventualmente >1
  // se lo sforamento è enorme: in quel caso il secondo anello fa un giro completo).
  const overflowFraction = overBudget ? (total - budget) / budget : 0;
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    rafRef.current = requestAnimationFrame(() => setMounted(true));
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Sotto budget: ogni categoria occupa la sua quota del budget (value/budget), il resto
  // dell'anello resta neutro = quanto budget avanza. Sopra budget: le categorie occupano
  // l'intero anello in proporzione alla spesa reale (value/total), perché non c'è più
  // "quota disponibile" da mostrare — lo sforamento si vede nell'anello rosso esterno.
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
        {overBudget && (
          <circle
            cx="100"
            cy="100"
            r={R_OVERFLOW}
            fill="none"
            stroke="#ff2ecb"
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
            left: `calc(50% + ${glowX / R * (size / 2 - 7)}px - 6px)`,
            top: `calc(50% + ${glowY / R * (size / 2 - 7)}px - 6px)`,
            boxShadow: "0 0 12px 4px rgba(255,255,255,0.9)",
          }}
        />
      )}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={`text-3xl font-semibold tracking-tight tabular-nums ${
            overBudget ? "text-neon-pink" : ""
          }`}
        >
          {centerLabel}
        </span>
        <span className="text-xs text-muted dark:text-muted-dark mt-1">{centerSub}</span>
        {overBudget && (
          <span className="text-[10px] font-medium text-neon-pink mt-1 gauge-overflow-pulse">
            +{Math.round(overflowFraction * 100)}% oltre budget
          </span>
        )}
      </div>
    </div>
  );
}
