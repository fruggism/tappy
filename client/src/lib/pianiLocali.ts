import type { Piano } from "./piani";

const prefisso = "tappy_piani_";

function chiave(code: string) {
  return prefisso + code;
}

export function leggiPiani(code: string): Piano[] {
  try {
    const grezzo = localStorage.getItem(chiave(code));
    if (!grezzo) return [];
    const parsed = JSON.parse(grezzo) as Piano[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function scriviPiani(code: string, piani: Piano[]) {
  localStorage.setItem(chiave(code), JSON.stringify(piani));
}

export function creaPiano(
  code: string,
  dati: Omit<Piano, "id" | "user_id" | "created_at">
): Piano {
  const piano: Piano = {
    ...dati,
    id: crypto.randomUUID(),
    user_id: code,
    created_at: new Date().toISOString(),
  };
  scriviPiani(code, [...leggiPiani(code), piano]);
  return piano;
}

export function aggiornaPiano(code: string, piano: Piano) {
  scriviPiani(
    code,
    leggiPiani(code).map((p) => (p.id === piano.id ? piano : p))
  );
}

export function eliminaPiano(code: string, id: string) {
  scriviPiani(
    code,
    leggiPiani(code).filter((p) => p.id !== id)
  );
}

export function svuotaPianiLocali(code: string) {
  localStorage.removeItem(chiave(code));
}
