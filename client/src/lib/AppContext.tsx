import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { clearApiKey, setApiKey as persistApiKey } from "./realApi";
import type { Card, Category, Transaction, User } from "./types";

interface AppState {
  user: User | null;
  categories: Category[];
  cards: Card[];
  transactions: Transaction[];
  loading: boolean;
  authError: boolean;
  effectiveTheme: "light" | "dark";
  refresh: () => Promise<boolean>;
  refreshTransactions: () => Promise<void>;
  setTheme: (t: User["theme"]) => Promise<void>;
  setBudget: (amount: number) => Promise<void>;
  login: (apiKey: string) => Promise<boolean>;
  logout: () => void;
}

const AppCtx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
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
      setAuthError(false);
      return true;
    } catch {
      setUser(null);
      setAuthError(true);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = useCallback(
    async (apiKey: string) => {
      persistApiKey(apiKey);
      const ok = await refresh();
      if (!ok) clearApiKey();
      return ok;
    },
    [refresh]
  );

  const logout = useCallback(() => {
    clearApiKey();
    setUser(null);
    setCategories([]);
    setCards([]);
    setTransactions([]);
    setAuthError(true);
  }, []);

  const effectiveTheme: "light" | "dark" = useMemo(() => {
    if (!user || user.theme === "system") return systemDark ? "dark" : "light";
    return user.theme;
  }, [user, systemDark]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", effectiveTheme === "dark");
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
    authError,
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
