import { useEffect, useRef, useState } from "react";
import { accent } from "../lib/accent";

export interface GaugeSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

/** Settimana o mese: l'anello interno è anche un orologio. Giorno: null. */
export interface Orologio {
  passi: number;
  /** 0-based, null se il periodo non è quello in corso. */
  oggi: number | null;
  /** 0-based, giorni con una spesa prevista. */
  programmati: number[];
}

interface Props {
  segments: GaugeSegment[];
  budget: number;
  size?: number;
  centerLabel: string;
  centerSub: string;
  orologio?: Orologio | null;
}

const CX = 100;
const CY = 100;
const R_OUTER = 88;
const R_INNER = 64;
const R_SEGNO = 76;
const CIRC_OUTER = 2 * Math.PI * R_OUTER;
const CIRC_INNER = 2 * Math.PI * R_INNER;
const CIRC_SEGNO = 2 * Math.PI * R_SEGNO;

function riduciMoto() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

export default function RadialGauge({
  segments,
  budget,
  size = 240,
  centerLabel,
  centerSub,
  orologio = null,
}: Props) {
  const [mounted, setMounted] = useState(riduciMoto);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const pct = budget > 0 ? Math.min(total / budget, 1) : 0;
  const overBudget = budget > 0 && total > budget;
  const pink = accent("pink", "#ff2ecb");
  const green = accent("green", "#39ff88");
  const cyan = accent("cyan", "#00e5ff");
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (riduciMoto()) {
      setMounted(true);
      return;
    }
    rafRef.current = requestAnimationFrame(() => setMounted(true));
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const visibili = segments.filter((s) => s.value > 0);
  const gap = visibili.length > 1 ? 0.014 : 0;
  let cursor = 0;
  const outer = visibili.map((seg) => {
    const fraction = total > 0 ? (seg.value / total) * (1 - gap * visibili.length) : 0;
    const start = cursor;
    cursor += fraction + gap;
    return { ...seg, start, fraction };
  });

  const innerColor = overBudget ? pink : green;
  const innerFrac = mounted ? pct : 0;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 200 200" width={size} height={size} className="-rotate-90 overflow-visible">
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke="currentColor"
          className="text-black/5 dark:text-white/10"
          strokeWidth="11"
        />
        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="none"
          stroke="currentColor"
          className="text-black/5 dark:text-white/10"
          strokeWidth="11"
        />

        {outer.map((seg, i) => (
          <circle
            key={seg.id}
            cx={CX}
            cy={CY}
            r={R_OUTER}
            fill="none"
            stroke={seg.color}
            strokeWidth="11"
            strokeLinecap="butt"
            strokeDasharray={CIRC_OUTER}
            strokeDashoffset={mounted ? CIRC_OUTER * (1 - seg.fraction) : CIRC_OUTER}
            style={{
              transform: `rotate(${seg.start * 360}deg)`,
              transformOrigin: "100px 100px",
              transition: riduciMoto()
                ? undefined
                : `stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1) ${i * 0.08}s`,
            }}
          />
        ))}

        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="none"
          stroke={innerColor}
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={CIRC_INNER}
          strokeDashoffset={CIRC_INNER * (1 - innerFrac)}
          className={overBudget ? "gauge-overflow-pulse" : undefined}
          style={{
            filter: `drop-shadow(0 0 5px ${innerColor}99)`,
            transition: riduciMoto() ? undefined : "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)",
          }}
        />

        {orologio &&
          orologio.programmati.map((i) => {
            if (orologio.passi <= 0) return null;
            const largo = CIRC_SEGNO / orologio.passi;
            const a = Math.max(2, largo * 0.16);
            const g = Math.max(1.5, largo * 0.08);
            return (
              <circle
                key={`p-${i}`}
                cx={CX}
                cy={CY}
                r={R_SEGNO}
                fill="none"
                stroke={green}
                strokeWidth="3.5"
                strokeLinecap="butt"
                strokeDasharray={`${a} ${g} ${a} ${g} ${a} ${CIRC_SEGNO}`}
                opacity={0.9}
                style={{
                  transform: `rotate(${(i / orologio.passi) * 360}deg)`,
                  transformOrigin: "100px 100px",
                }}
              />
            );
          })}

        {orologio && orologio.oggi != null && orologio.passi > 0 && (
          <line
            x1={CX + R_INNER - 9}
            y1={CY}
            x2={CX + R_INNER + 9}
            y2={CY}
            stroke={cyan}
            strokeWidth="2.4"
            strokeLinecap="round"
            style={{
              transform: `rotate(${((orologio.oggi + 0.5) / orologio.passi) * 360}deg)`,
              transformOrigin: "100px 100px",
            }}
          />
        )}
      </svg>

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

export function ritmo(
  speso: number,
  budget: number,
  oggi: number | null,
  passi: number
): "in anticipo" | "in linea" | "sotto ritmo" | null {
  if (oggi == null || budget <= 0 || passi <= 0) return null;
  const tempo = (oggi + 1) / passi;
  const spesa = speso / budget;
  if (spesa > tempo + 0.08) return "in anticipo";
  if (spesa < tempo - 0.08) return "sotto ritmo";
  return "in linea";
}
