export interface User {
  id: string;
  code: string; // codice Fru Pass: identità condivisa in tutto l'ecosistema
  // Segreto interno di tappy, usato SOLO dal webhook Apple Pay. Non è una
  // credenziale d'accesso e non sostituisce mai il codice Fru Pass.
  api_key: string | null;
  name: string;
  theme: "light" | "dark" | "system";
  monthly_budget: number;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string;
  name: string;
  color: string;
  icon: string;
  is_default: 0 | 1;
  sort_order: number;
  // Budget mensile dedicato alla categoria, facoltativo (null = nessun limite specifico).
  budget: number | null;
}

export interface Card {
  id: string;
  user_id: string;
  name: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  date: string;
  time: string | null;
  amount: number;
  my_share: number;
  name: string;
  card_id: string | null;
  category_id: string;
  source: "manual" | "applepay";
  is_income: 0 | 1;
  note: string | null;
  created_at: string;
}
