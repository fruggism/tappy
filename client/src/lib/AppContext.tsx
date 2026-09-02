import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, USE_MOCK } from "./api";
import {
  clearSession,
  readSession,
  refreshFruPass,
  saveSession,
  takeCodeFromHash,
  verifyFruPass,
  type FruPassProfile,
} from "./frupass";
import type { Card, Category, Transaction, User } from "./types";

interface AppState {
  user: User | null;
  categories: Category[];
  cards: Card[];
  transactions: Transaction[];
  loading: boolean;
  /** true quando serve mostrare la schermata di login Fru Pass */
  needsLogin: boolean;
  profile: FruPassProfile | null;
  effectiveTheme: "light" | "dark";
  refresh: () => Promise<boolean>;
  refreshTransactions: () => Promise<void>;
  setTheme: (t: User["theme"]) => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
  /** Rifiuta con un errore leggibile se il codice non è valido. */
  login: (frupasCode: string) => Promise<void>;
  logout: () => void;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [profile, setProfile] = useState<FruPassProfile | null>(null);
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  const refreshTransactions = useCallback(async () => {
    setTransactions(await api.transactions());
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [u, c, cd, tx] = await Promise.all([
        api.me(),
        api.categories(),
        api.cards(),
        api.transactions(),
      ]);
      setUser(u);
      setCategories(c);
      setCards(cd);
      setTransactions(tx);
      setNeedsLogin(false);
      return true;
    } catch {
      setUser(null);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  // Avvio: si decide una volta sola chi è l'utente.
  //
  // 1. Se arriviamo dall'hub, il codice è nell'hash dell'URL e l'utente è già
  //    identificato: si entra diretti, senza far vedere il login.
  // 2. Altrimenti si riusa la sessione salvata, mostrando subito la home; il
  //    ri-controllo del codice presso l'ecosistema parte in background e non
  //    blocca nulla — invalida la sessione solo se il codice è stato revocato.
  // 3. Se non c'è né l'uno né l'altra, si mostra il login.
  useEffect(() => {
    let annullato = false;

    // Con i dati finti non esiste identità da verificare: la schermata di
    // accesso resterebbe un muro invalicabile durante lo sviluppo della UI.
    if (USE_MOCK) {
      refresh();
      return;
    }

    (async () => {
      const codeFromHub = takeCodeFromHash();

      if (codeFromHub) {
        try {
          const p = await verifyFruPass(codeFromHub);
          if (annullato) return;
          saveSession(p);
          setProfile(p);
          await refresh();
          return;
        } catch {
          // Codice nell'URL non valido: si ripiega sulla sessione salvata,
          // se c'è, altrimenti sul login.
        }
      }

      const salvata = readSession();
      if (!salvata) {
        if (!annullato) {
          setNeedsLogin(true);
          setLoading(false);
        }
        return;
      }

      setProfile(salvata);
      refresh();

      // Ri-validazione in background: un errore di rete non deve buttare
      // fuori l'utente, solo un codice davvero revocato.
      refreshFruPass(salvata.code)
        .then((p) => {
          if (!annullato) {
            saveSession(p);
            setProfile(p);
          }
        })
        .catch((err) => {
          // Solo un codice davvero revocato invalida la sessione: un
          // FruPassUnreachable (rete giù, ecosistema in manutenzione) si ignora.
          if (annullato) return;
          if (err instanceof Error && err.message === "Codice non riconosciuto") {
            clearSession();
            setProfile(null);
            setUser(null);
            setNeedsLogin(true);
          }
        });
    })();

    return () => {
      annullato = true;
    };
  }, [refresh]);

  // Se l'hub riapre tappy in una scheda già aperta, cambia solo l'hash e la
  // pagina non si ricarica: senza questo il codice resterebbe nell'URL e
  // l'utente vedrebbe ancora la sessione (o il login) di prima.
  useEffect(() => {
    if (USE_MOCK) return;

    const onHashChange = () => {
      const code = takeCodeFromHash();
      if (!code) return;
      verifyFruPass(code)
        .then((p) => {
          saveSession(p);
          setProfile(p);
          setNeedsLogin(false);
          return refresh();
        })
        .catch(() => {
          /* codice non valido nell'URL: si resta com'eravamo */
        });
    };

    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [refresh]);

  const login = useCallback(
    async (frupasCode: string) => {
      const p = await verifyFruPass(frupasCode); // rilancia con messaggio leggibile
      saveSession(p);
      setProfile(p);
      setNeedsLogin(false);
      await refresh();
    },
    [refresh]
  );

  const logout = useCallback(() => {
    clearSession();
    setProfile(null);
    setUser(null);
    setCategories([]);
    setCards([]);
    setTransactions([]);
    setNeedsLogin(true);
    setLoading(false);
  }, []);

  const effectiveTheme: "light" | "dark" = useMemo(() => {
    if (!user || user.theme === "system") return systemDark ? "dark" : "light";
    return user.theme;
  }, [user, systemDark]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");

    // I <meta name="theme-color"> in index.html seguono prefers-color-scheme,
    // che con un toggle manuale non basta più: senza questo, su iPhone la
    // striscia del notch resta del colore del tema di sistema mentre l'app è
    // dell'altro. Si sostituiscono con un solo meta senza media query.
    const colore = effectiveTheme === "dark" ? "#000000" : "#f5f5f7";
    document.querySelectorAll('meta[name="theme-color"][media]').forEach((m) => m.remove());
    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "theme-color");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", colore);
  }, [effectiveTheme]);

  const setTheme = useCallback(async (t: User["theme"]) => {
    const u = await api.updateMe({ theme: t });
    setUser(u);
  }, []);

  const setBudget = useCallback(async (amount: number) => {
    const u = await api.updateMe({ monthly_budget: amount });
    setUser(u);
  }, []);

  const value: AppState = {
    user,
    categories,
    cards,
    transactions,
    loading,
    needsLogin,
    profile,
    effectiveTheme,
    refresh,
    refreshTransactions,
    setTheme,
    setBudget,
    login,
    logout,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
