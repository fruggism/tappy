import type { Piano } from "./piani";

const prefisso = "tappy_piani_";

function chiave(code: string) {
  return prefisso + code;
}

export function leggiPiani(code: string): Piano[] {
  try {
    const grezzo = localStorage.getItem(chiave(code));
    if (!grezzo) return seme(code);
    const parsed = JSON.parse(grezzo) as Piano[];
    return Array.isArray(parsed) ? parsed : seme(code);
  } catch {
    return seme(code);
  }
}

export function scriviPiani(code: string, piani: Piano[]) {
  localStorage.setItem(chiave(code), JSON.stringify(piani));
}

function seme(code: string): Piano[] {
  const oggi = new Date();
  const y = oggi.getFullYear();
  const m = String(oggi.getMonth() + 1).padStart(2, "0");
  return [
    {
      id: "demo-netflix",
      user_id: code,
      name: "Netflix",
      type: "subscription",
      amount: 12.99,
      price_history: [{ da: `${y - 1}-01-01`, importo: 12.99 }],
      category_id: null,
      card_id: null,
      frequency: "monthly",
      interval_months: null,
      start_date: `${y}-01-15`,
      end_date: null,
      review_date: `${y + 1}-01-15`,
      active: true,
      note: null,
      created_at: new Date().toISOString(),
    },
    {
      id: "demo-iphone",
      user_id: code,
      name: "iPhone",
      type: "installment",
      amount: 79,
      price_history: [{ da: `${y}-01-01`, importo: 79 }],
      category_id: null,
      card_id: null,
      frequency: "monthly",
      interval_months: null,
      start_date: `${y}-${m}-01`.replace(/-\d\d-/, "-01-"),
      end_date: `${y + 1}-01-01`,
      review_date: null,
      active: true,
      note: null,
      created_at: new Date().toISOString(),
    },
  ];
}
