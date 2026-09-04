import { useEffect, useId, useRef, useState } from "react";
import { accent } from "../lib/accent";
import { formattaGiorno } from "../lib/piani";

export interface GaugeSegment {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface VocePrevista {
  i: number;
  nome: string;
  importo: number;
  date: string;
}

/** Settimana o mese: l'anello interno è anche un orologio. Giorno: null. */
export interface Orologio {
  passi: number;
  oggi: number | null;
  programmati: VocePrevista[];
  etichette: string[];
}

export type Scelta =
  | { tipo: "categoria"; nome: string; importo: number; pct: number; colore: string }
  | { tipo: "previsto"; voci: VocePrevista[] };

interface Props {
  segments: GaugeSegment[];
  budget: number;
  perDay: number;
  size?: number;
  centerLabel: string;
  orologio?: Orologio | null;
}

const CX = 100;
const CY = 100;
const R_OUTER = 96;
const SW_OUTER = 6;
const R_INNER = 74;
const SW_INNER = 7;
const CIRC_INNER = 2 * Math.PI * R_INNER;

function riduciMoto() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

function polo(r: number, frac: number): [number, number] {
  const a = -Math.PI / 2 + frac * 2 * Math.PI;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function arco(r: number, da: number, a: number, orario = true): string {
  let delta = a - da;
  if (delta <= 0) delta += 1;
  const [x0, y0] = polo(r, da);
  const [x1, y1] = polo(r, da + delta);
  const large = delta > 0.5 ? 1 : 0;
  const sweep = orario ? 1 : 0;
  const xa = orario ? x0 : x1;
  const ya = orario ? y0 : y1;
  const xb = orario ? x1 : x0;
  const yb = orario ? y1 : y0;
  return `M ${xa.toFixed(2)} ${ya.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${xb.toFixed(2)} ${yb.toFixed(2)}`;
}

function DialGiorni({
  orologio,
  rosso,
  onPrevisto,
}: {
  orologio: Orologio;
  rosso: string;
  onPrevisto: (i: number) => void;
}) {
  const passi = orologio.passi;
  const R_NUM = R_INNER - 14;
  const rBadge = Math.min(7.4, (Math.PI * R_NUM) / passi - 0.35);
  const fs = Math.min(passi > 14 ? 6.2 : 8.2, rBadge * 1.2);
  const rPunto = R_INNER + SW_INNER / 2 + 4;
  const giorniP = [...new Set(orologio.programmati.map((p) => p.i))];
  return (
    <g>
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
            style={{ pointerEvents: "none" }}
          />
        );
      })}
      {giorniP.map((i) => {
        if (i === orologio.oggi) return null;
        const [x, y] = polo(rPunto, i / passi);
        return (
          <g key={`p-${i}`}>
            <circle
              cx={x}
              cy={y}
              r="8"
              fill="transparent"
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                onPrevisto(i);
              }}
            />
            <circle cx={x} cy={y} r="2.2" fill={rosso} style={{ pointerEvents: "none" }} />
          </g>
        );
      })}
      {orologio.etichette.map((lab, i) => {
        const [x, y] = polo(R_NUM, i / passi);
        const oggi = orologio.oggi === i;
        if (oggi) {
          return (
            <g key={`n-${i}`} style={{ pointerEvents: "none" }}>
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
            style={{ pointerEvents: "none" }}
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
  perDay,
  size = 252,
  centerLabel,
  orologio = null,
}: Props) {
  const uid = useId().replace(/:/g, "");
  const [mounted, setMounted] = useState(riduciMoto);
  const [centro, setCentro] = useState<Scelta | null>(null);
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  const pct = budget > 0 ? Math.min(total / budget, 1) : 0;
  const pctPiena = budget > 0 ? total / budget : 0;
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
  const gap = visibili.length > 1 ? 0.012 : 0;
  let cursor = 0;
  const outer = visibili.map((seg) => {
    const fraction = total > 0 ? (seg.value / total) * (1 - gap * visibili.length) : 0;
    const start = cursor;
    cursor += fraction + gap;
    return { ...seg, start, fraction };
  });

  const innerColor = overBudget ? pink : green;
  const innerFrac = mounted ? pct : 0;
  const [bx, by] = polo(R_INNER, Math.min(innerFrac, 0.995));
  const pctTesto = budget > 0 ? `${Math.round(pctPiena * 100)}%` : "";

  function scegliCat(seg: (typeof outer)[number]) {
    if (centro?.tipo === "categoria" && centro.nome === seg.label) {
      azzera();
      return;
    }
    setCentro({
      tipo: "categoria",
      nome: seg.label,
      importo: seg.value,
      pct: total > 0 ? (seg.value / total) * 100 : 0,
      colore: seg.color,
    });
  }

  function scegliPrevisto(i: number) {
    const voci = orologio?.programmati.filter((p) => p.i === i) ?? [];
    if (!voci.length) return;
    if (centro?.tipo === "previsto" && centro.voci[0]?.i === i) {
      azzera();
      return;
    }
    setCentro({ tipo: "previsto", voci });
  }

  function azzera() {
    setCentro(null);
  }

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="overflow-visible"
        onPointerDown={azzera}
      >
        <defs>
          {outer.map((seg) => {
            const mid = (seg.start + seg.fraction / 2) % 1;
            const capovolgi = mid > 0.25 && mid < 0.75;
            return (
              <path
                key={`tp-${seg.id}`}
                id={`${uid}-${seg.id}`}
                d={arco(R_OUTER, seg.start, seg.start + seg.fraction, !capovolgi)}
                fill="none"
              />
            );
          })}
        </defs>

        <circle
          cx={CX}
          cy={CY}
          r={R_OUTER}
          fill="none"
          stroke="currentColor"
          className="text-black/5 dark:text-white/10"
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
          <g key={seg.id}>
            <path
              d={arco(R_OUTER, seg.start, seg.start + (mounted ? seg.fraction : 0.001))}
              fill="none"
              stroke="transparent"
              strokeWidth="16"
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation();
                scegliCat(seg);
              }}
            />
            <path
              d={arco(R_OUTER, seg.start, seg.start + (mounted ? seg.fraction : 0.001))}
              fill="none"
              stroke={seg.color}
              strokeWidth={SW_OUTER}
              strokeLinecap="butt"
              style={{ pointerEvents: "none" }}
            />
          </g>
        ))}

        {outer.map((seg) => {
          const fs = 5.4;
          const arcoPx = seg.fraction * 2 * Math.PI * R_OUTER;
          if (arcoPx < seg.label.length * fs * 0.62 + 8) return null;
          return (
            <text
              key={`lb-${seg.id}`}
              fontSize={fs}
              fontWeight={600}
              letterSpacing="0.25"
              fill={seg.color}
              strokeLinejoin="round"
              paintOrder="stroke"
              strokeWidth="2.2"
              className="stroke-surface dark:stroke-surface-dark"
              style={{ pointerEvents: "none" }}
            >
              <textPath href={`#${uid}-${seg.id}`} startOffset="50%" textAnchor="middle">
                {seg.label}
              </textPath>
            </text>
          );
        })}

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

        {orologio && orologio.passi > 0 ? (
          <DialGiorni orologio={orologio} rosso={rosso} onPrevisto={scegliPrevisto} />
        ) : null}

        {budget > 0 && mounted && (
          <g style={{ pointerEvents: "none" }}>
            <circle cx={bx} cy={by} r="6.2" fill="#fff" stroke={innerColor} strokeWidth="1.3" />
            <text
              x={bx}
              y={by}
              textAnchor="middle"
              dominantBaseline="central"
              fill={innerColor}
              fontSize={pctTesto.length > 3 ? 4.6 : 5.2}
              fontWeight={700}
              className="tabular-nums"
            >
              {pctTesto}
            </text>
          </g>
        )}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-10">
        <div
          key={
            centro?.tipo === "categoria"
              ? `c-${centro.nome}`
              : centro?.tipo === "previsto"
                ? `p-${centro.voci[0]?.i}`
                : "totale"
          }
          className="flex flex-col items-center animate-gauge-centro"
        >
          {centro?.tipo === "categoria" ? (
            <>
              <span
                className="text-largeTitle font-semibold tracking-tight tabular-nums"
                style={{ color: centro.colore }}
              >
                €{Math.round(centro.importo)}
              </span>
              <span className="text-footnote mt-1 font-medium" style={{ color: centro.colore }}>
                {centro.nome}
              </span>
              <span className="text-caption font-medium text-muted dark:text-muted-dark mt-1">
                {Math.round(centro.pct)}%
              </span>
            </>
          ) : centro?.tipo === "previsto" ? (
            <>
              <span className="text-largeTitle font-semibold tracking-tight tabular-nums">
                €{centro.voci.reduce((s, v) => s + v.importo, 0).toFixed(0)}
              </span>
              <span className="text-footnote text-muted dark:text-muted-dark mt-1 font-medium text-center">
                {centro.voci.map((v) => v.nome).join(", ")}
              </span>
              <span className="text-caption font-medium text-muted dark:text-muted-dark mt-1">
                prevista · {formattaGiorno(centro.voci[0].date)}
              </span>
            </>
          ) : (
            <>
              <span
                className={`text-largeTitle font-semibold tracking-tight tabular-nums ${
                  overBudget ? "text-acc-pink" : ""
                }`}
              >
                {centerLabel}
              </span>
              {budget > 0 && (
                <span className="text-caption text-muted dark:text-muted-dark mt-1.5 tabular-nums">
                  Bdg €{Math.round(budget)}
                </span>
              )}
              <span className="text-caption tabular-nums mt-0.5">
                <span className="text-muted dark:text-muted-dark">€/gg </span>
                <span className="font-medium text-acc-green">€{Math.round(perDay)}</span>
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

