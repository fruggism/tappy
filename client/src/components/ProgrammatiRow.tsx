import { useEffect, useRef, useState } from "react";

function useCountUp(value: number, duration = 700) {
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);
  useEffect(() => {
    const from = prev.current;
    const to = value;
    if (from === to) return;
    const start = performance.now();
    let raf = 0;
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

/** Avviso in sintesi: previsto nel periodo, fuori dal totale della gauge. */
export default function ProgrammatiRow({ totale }: { totale: number }) {
  const animated = useCountUp(totale);
  if (totale <= 0) return null;
  return (
    <div className="w-full flex justify-between text-callout px-1">
      <span className="text-muted dark:text-muted-dark">Spese previste</span>
      <span className="font-semibold tabular-nums text-acc-green/80">
        €{animated.toFixed(0)}
        <span className="text-footnote font-normal text-muted dark:text-muted-dark"> · non nel totale</span>
      </span>
    </div>
  );
}
