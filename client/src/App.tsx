import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "./lib/AppContext";
import { Dock, Header } from "./components/AppChrome";
import Login from "./views/Login";
import Andamento from "./views/Andamento";
import Movimenti from "./views/Movimenti";
import Impostazioni from "./views/Impostazioni";

type Tab = "andamento" | "movimenti" | "impostazioni";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  {
    id: "andamento",
    label: "Andamento",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M4 19V9m6 10V5m6 14v-7m6 7V3"
      />
    ),
  },
  {
    id: "movimenti",
    label: "Movimenti",
    icon: (
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3 7h18M3 12h18M3 17h10"
      />
    ),
  },
  {
    id: "impostazioni",
    label: "Impostazioni",
    icon: (
      <>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </>
    ),
  },
];

export default function App() {
  const { loading, user, needsLogin } = useApp();
  const [tab, setTab] = useState<Tab>("andamento");
  const mainRef = useRef<HTMLElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  // Il titolo si contrae quando il contenuto scorre sotto l'header: una sentinella
  // di 1px in cima al <main> segna il confine, niente da fare a ogni evento di scroll.
  useEffect(() => {
    const root = mainRef.current;
    const sentinel = sentinelRef.current;
    if (!root || !sentinel) return;
    const obs = new IntersectionObserver(([entry]) => setScrolled(!entry.isIntersecting), {
      root,
      threshold: 1,
    });
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  if (needsLogin) return <Login />;

  // Finché non si sa chi è l'utente si mostra lo spinner, mai il login: chi
  // arriva dall'hub con il codice nell'URL non deve vedere la schermata di
  // accesso comparire e sparire.
  if (loading || !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-acc-green/30 border-t-acc-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-md mx-auto relative bg-base dark:bg-base-dark">
      <Header scrolled={scrolled} />

      {/* pb generoso: sotto ci sono nav e riga della versione, e l'ultima card
          di ogni schermata non deve finirci sotto. */}
      <main
        ref={mainRef}
        className="flex-1 overflow-y-auto px-5 pt-2"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8rem)" }}
      >
        <div ref={sentinelRef} aria-hidden="true" className="h-px w-full" />
        {tab === "andamento" && <Andamento />}
        {tab === "movimenti" && <Movimenti />}
        {tab === "impostazioni" && <Impostazioni />}
      </main>

      <Dock>
        <nav className="rounded-2xl bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-xl flex">
          {TABS.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  active ? "text-acc-green" : "text-muted dark:text-muted-dark"
                }`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                  {t.icon}
                </svg>
                <span className="text-caption font-medium">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </Dock>
    </div>
  );
}
