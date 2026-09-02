import type { Card, Category, Transaction, User } from "./types";

// In produzione client e API stanno sullo stesso dominio Netlify (redirect
// /api/* -> funzione), quindi non serve un URL assoluto. VITE_API_URL resta
// utile solo per puntare a un deploy diverso in fase di sviluppo/debug.
const BASE = import.meta.env.VITE_API_URL || "";

const FRUPAS_CODE_STORAGE_KEY = "tappy_frupas_code";

export function getFrupasCode(): string | null {
  return localStorage.getItem(FRUPAS_CODE_STORAGE_KEY);
}

export function setFrupasCode(code: string) {
  localStorage.setItem(FRUPAS_CODE_STORAGE_KEY, code.trim());
}

export function clearFrupasCode() {
  localStorage.removeItem(FRUPAS_CODE_STORAGE_KEY);
}

async function req<T>(path: string, options: RequestInit = {}): Promise<T> {
  const frupasCode = getFrupasCode();
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(frupasCode ? { "x-frupas-code": frupasCode } : {}),
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export const realApi = {
  me: () => req<User>("/api/me"),
  updateMe: (data: Partial<Pick<User, "theme" | "monthly_budget" | "name">>) =>
    req<User>("/api/me", { method: "PATCH", body: JSON.stringify(data) }),

  categories: () => req<Category[]>("/api/categories"),
  createCategory: (data: { name: string; color: string; icon?: string; budget?: number | null }) =>
    req<Category>("/api/categories", { method: "POST", body: JSON.stringify(data) }),
  updateCategory: (id: string, data: Partial<Pick<Category, "name" | "color" | "icon" | "budget">>) =>
    req<Category>(`/api/categories/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteCategory: (id: string) => req<void>(`/api/categories/${id}`, { method: "DELETE" }),

  cards: () => req<Card[]>("/api/cards"),
  createCard: (name: string) =>
    req<Card>("/api/cards", { method: "POST", body: JSON.stringify({ name }) }),

  transactions: (params?: { from?: string; to?: string }) => {
    const qs = params
      ? "?" +
        Object.entries(params)
          .filter(([, v]) => v)
          .map(([k, v]) => `${k}=${v}`)
          .join("&")
      : "";
    return req<Transaction[]>(`/api/transactions${qs}`);
  },
  createTransaction: (
    data: Partial<Transaction> & { amount: number; name: string }
  ) => req<Transaction>("/api/transactions", { method: "POST", body: JSON.stringify(data) }),
  updateTransaction: (id: string, data: Partial<Transaction>) =>
    req<Transaction>(`/api/transactions/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  deleteTransaction: (id: string) =>
    req<void>(`/api/transactions/${id}`, { method: "DELETE" }),
};

export { BASE as API_BASE };
