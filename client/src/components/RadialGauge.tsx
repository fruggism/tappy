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
  /** Numero del giorno da scrivere su ogni tacca (es. "4"). */
  etichette: string[];
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
const R_OUTER = 96;
const R_INNER = 83;
const SW_OUTER = 6;
const SW_INNER = 7;
const CIRC_INNER = 2 * Math.PI * R_INNER;

function riduciMoto() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

/** 0 = mezzanotte in alto, senso orario. */
function polo(r: number, frac: number): [number, number] {
  const a = -Math.PI / 2 + frac * 2 * Math.PI;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function arco(r: number, da: number, a: number): string {
  let delta = a - da;
  if (delta <= 0) delta += 1;
  const [x0, y0] = polo(r, da);
  const [x1, y1] = polo(r, da + delta);
  const large = delta > 0.5 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

function DialGiorni({ orologio, rosso }: { orologio: Orologio; rosso: string }) {
  const passi = orologio.passi;
  const R_NUM = R_INNER - 14;
  const rBadge = Math.min(7.4, (Math.PI * R_NUM) / passi - 0.35);
  const fs = Math.min(passi > 14 ? 6.2 : 8.2, rBadge * 1.2);
  const rPunto = R_INNER + SW_INNER / 2 + 3.2;
  return (
    <g style={{ pointerEvents: "none" }}>
      {Array.from({ length: passi }, (_, i) => {
        const frac = i / passi;
        const [x1, y1] = polo(R_INNER - 4, frac);
        const [x2, y2] = polo(R_INNER + 4, frac);
        const lunga = passi > 14 && i % 5 === 0;
        return (
          <line
            key={`t-${i}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="currentColor"
            className="text-black/25 dark:text-white/35"
            strokeWidth={lunga ? 1.5 : 0.85}
            strokeLinecap="round"
          />
        );
      })}
      {orologio.programmati.map((i) => {
        if (i === orologio.oggi) return null;
        const [x, y] = polo(rPunto, i / passi);
        return <circle key={`p-${i}`} cx={x} cy={y} r="2.1" fill={rosso} />;
      })}
      {orologio.etichette.map((lab, i) => {
        const [x, y] = polo(R_NUM, i / passi);
        const oggi = orologio.oggi === i;
        if (oggi) {
          return (
            <g key={`n-${i}`}>
              <circle cx={x} cy={y} r={rBadge} fill={rosso} />
              <text
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#fff"
                fontSize={fs}
                fontWeight={600}
                className="tabular-nums"
              >
                {lab}
              </text>
            </g>
          );
        }
        return (
          <text
            key={`n-${i}`}
            x={x}
            y={y}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fs}
            className="tabular-nums fill-black/35 dark:fill-white/45"
          >
            {lab}
          </text>
        );
      })}
    </g>
  );
}

export default function RadialGauge({
  segments,
  budget,
  size = 252,
  centerLabel,
  centerSub,
  orologio = null,
}: Props) {
  const [mounted, setMounted] = useState(riduciMoto);
  const [focus, setFocus] = useState<string | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const pct = budget > 0 ? Math.min(total / budget, 1) : 0;
  const overBudget = budget > 0 && total > budget;
  const pink = accent("pink", "#ff2ecb");
  const green = accent("green", "#39ff88");
  const rosso = "#ff3b30";
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
  const gap = visibili.length > 1 ? 0.016 : 0;
  let cursor = 0;
  const outer = visibili.map((seg) => {
    const fraction = total > 0 ? (seg.value / total) * (1 - gap * visibili.length) : 0;
    const start = cursor;
    cursor += fraction + gap;
    return { ...seg, start, fraction };
  });

  const innerColor = overBudget ? pink : green;
  const innerFrac = mounted ? pct : 0;
  const scelto = outer.find((s) => s.id === focus) ?? null;
  const tip = scelto
    ? (() => {
        const [x, y] = polo(R_OUTER + 6, scelto.start + scelto.fraction / 2);
        return { x, y, label: scelto.label, value: scelto.value };
      })()
    : null;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="overflow-visible"
        onPointerDown={() => setFocus(null)}
      >
        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke="currentColor"
          strokeWidth={SW_OUTER}
        />

        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="none"
          stroke="currentColor"
          className="text-black/[0.07] dark:text-white/10"
          strokeWidth={SW_INNER}
        />

        {outer.map((seg) => (
          <path
            key={seg.id}
            d={arco(R_OUTER, seg.start, seg.start + (mounted ? seg.fraction : 0))}
            fill="none"
            stroke={seg.color}
            strokeWidth={SW_OUTER}
            strokeLinecap="butt"
            opacity={focus === seg.id ? 1 : 0.4}
            className="cursor-pointer"
            onPointerDown={(e) => {
              e.stopPropagation();
              setFocus(seg.id);
            }}
            onPointerEnter={() => setFocus(seg.id)}
          />
        ))}

        <circle
          cx={CX}
          cy={CY}
          r={R_INNER}
          fill="none"
          stroke={innerColor}
          strokeWidth={SW_INNER}
          strokeLinecap="round"
          strokeDasharray={CIRC_INNER}
          strokeDashoffset={CIRC_INNER * (1 - innerFrac)}
          transform={`rotate(-90 ${CX} ${CY})`}
          className={overBudget ? "gauge-overflow-pulse" : undefined}
          style={{
            filter: `drop-shadow(0 0 5px ${innerColor}99)`,
            pointerEvents: "none",
            transition: riduciMoto() ? undefined : "stroke-dashoffset 1.1s cubic-bezier(0.22,1,0.36,1)",
          }}
        />

        {orologio && orologio.passi > 0 ? <DialGiorni orologio={orologio} rosso={rosso} /> : null}
      </svg>

      {tip && (
        <div
          className="absolute z-10 pointer-events-none rounded-full bg-ink dark:bg-white text-white dark:text-black text-caption font-medium px-2.5 py-1 tabular-nums shadow-lg"
          style={{
            left: `${(tip.x / 200) * 100}%`,
            top: `${(tip.y / 200) * 100}%`,
            transform: "translate(-50%, -130%)",
          }}
        >
          {tip.label} · €{Math.round(tip.value)} · {total > 0 ? Math.round((tip.value / total) * 100) : 0}%
        </div>
      )}

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
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
