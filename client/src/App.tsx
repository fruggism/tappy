import { useState, type ReactNode } from "react";
import { useApp } from "./lib/AppContext";
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

function ApiKeyGate() {
  const { login } = useApp();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!value.trim() || busy) return;
    setBusy(true);
    setError(null);
    const ok = await login(value.trim());
    setBusy(false);
    if (!ok) setError("Chiave non valida");
  }

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-center">
          tap<span className="text-neon-green">py</span>
        </h1>
        <p className="text-sm text-muted dark:text-muted-dark text-center">
          Inserisci la tua chiave personale per accedere ai tuoi dati (la stessa su tutti i tuoi
          dispositivi).
        </p>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="Chiave personale"
          autoFocus
          className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-neon-green/60 text-center"
        />
        {error && <p className="text-xs text-neon-pink text-center">{error}</p>}
        <button
          onClick={submit}
          disabled={busy}
          className="rounded-xl bg-ink dark:bg-white text-white dark:text-black text-sm font-medium py-2 disabled:opacity-50"
        >
          Accedi
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const { loading, user, authError } = useApp();
  const [tab, setTab] = useState<Tab>("andamento");

  if (authError) return <ApiKeyGate />;

  if (loading || !user) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-neon-green/30 border-t-neon-green animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col max-w-md mx-auto relative">
      <header className="px-5 pt-6 pb-2 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          tap<span className="text-neon-green">py</span>
        </h1>
        <span className="text-xs text-muted dark:text-muted-dark">{user.name}</span>
      </header>

      <main className="flex-1 overflow-y-auto px-5 pb-24 pt-2">
        {tab === "andamento" && <Andamento />}
        {tab === "movimenti" && <Movimenti />}
        {tab === "impostazioni" && <Impostazioni />}
      </main>

      <nav className="absolute bottom-0 left-0 right-0 mx-4 mb-4 rounded-2xl bg-surface/80 dark:bg-surface-dark/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-xl flex">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                active ? "text-neon-green" : "text-muted dark:text-muted-dark"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
                {t.icon}
              </svg>
              <span className="text-[10px] font-medium">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
