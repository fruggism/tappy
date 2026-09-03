// TEMPORANEO — pannello di misura del layout, da togliere appena risolto.
//
// Esiste perché la pulsantiera resta staccata dal fondo sulla web app
// installata (PWA standalone), e tre correzioni fatte deducendo la causa
// (svh, dvh, fixed) non l'hanno risolta: senza il dispositivo sotto mano si
// tira a indovinare. Qui non si deduce niente, si leggono i numeri veri e si
// guarda quale non torna.
import { useEffect, useState } from "react";

function misura() {
  const vv = window.visualViewport;
  // La safe area non è leggibile da JS: la si fa calcolare al CSS su un
  // elemento di prova e se ne legge l'altezza.
  const sonda = document.createElement("div");
  sonda.style.cssText =
    "position:fixed;bottom:0;left:0;width:0;height:env(safe-area-inset-bottom);visibility:hidden";
  document.body.appendChild(sonda);
  const safeBottom = sonda.getBoundingClientRect().height;
  sonda.remove();

  const nav = document.querySelector("nav");
  const dock = nav?.closest("div.fixed") as HTMLElement | null;
  const r = nav?.getBoundingClientRect();

  return {
    "window.innerHeight": window.innerHeight,
    "documentElement.clientHeight": document.documentElement.clientHeight,
    "body.clientHeight": document.body.clientHeight,
    "screen.height": window.screen.height,
    "window.outerHeight": window.outerHeight,
    "window.screenY": window.screenY,
    "schermo - viewport": window.screen.height - window.innerHeight,
    "visualViewport.height": vv ? Math.round(vv.height) : "assente",
    "visualViewport.offsetTop": vv ? Math.round(vv.offsetTop) : "assente",
    "visualViewport.pageTop": vv ? Math.round(vv.pageTop) : "assente",
    "visualViewport.scale": vv ? vv.scale : "assente",
    "safe-area-inset-bottom": safeBottom,
    "dock.style.bottom": dock ? dock.style.bottom || "(vuoto)" : "dock non trovata",
    "dock position": dock ? getComputedStyle(dock).position : "-",
    "nav.bottom (rect)": r ? Math.round(r.bottom) : "nav non trovata",
    "vuoto sotto la nav": r ? Math.round(window.innerHeight - r.bottom) : "-",
    standalone: window.matchMedia("(display-mode: standalone)").matches,
    devicePixelRatio: window.devicePixelRatio,
  };
}

export default function Diagnostica() {
  const [dati, setDati] = useState<Record<string, unknown>>({});
  useEffect(() => {
    const aggiorna = () => setDati(misura());
    aggiorna();
    const t = setInterval(aggiorna, 500);
    return () => clearInterval(t);
  }, []);

  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-caption uppercase tracking-wide text-muted dark:text-muted-dark">
        Diagnostica layout (temporanea)
      </h2>
      <div className="rounded-xl bg-surface dark:bg-surface-dark p-3 text-footnote tabular-nums">
        {Object.entries(dati).map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 py-0.5">
            <span className="text-muted dark:text-muted-dark">{k}</span>
            <span className="text-ink dark:text-ink-dark shrink-0">{String(v)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
