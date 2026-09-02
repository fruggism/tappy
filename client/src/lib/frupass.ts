// Identità Fru Pass lato client.
//
// tappy fa parte dell'ecosistema Fru Pass: l'utente si autentica con il suo
// codice FRU-XXXX-XXXX, lo stesso che usa in tutte le altre app dell'hub.
// La verifica non avviene qui né su Airtable, ma presso l'endpoint condiviso
// dell'ecosistema — noi lo interroghiamo passando dalla nostra funzione
// /api/auth/*, che al primo accesso crea anche l'utente tappy.

const BASE = import.meta.env.VITE_API_URL || "";

// Chiave di sessione: convenzione dell'ecosistema, `<nome-app>_frupass`.
const SESSION_KEY = "tappy_frupass";

export interface FruPassProfile {
  code: string;
  name: string;
  username: string;
}

/** Forma canonica: maiuscolo, senza spazi. I trattini fanno parte del formato. */
export function canonicalCode(code: string): string {
  return code.trim().toUpperCase().replace(/\s+/g, "");
}

/**
 * Maschera per l'input: accetta quello che l'utente digita (con o senza
 * "FRU-", con o senza trattini) e restituisce FRU-XXXX-XXXX man mano.
 */
export function formatCodeInput(raw: string): string {
  let body = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (body.startsWith("FRU")) body = body.slice(3);
  body = body.slice(0, 8);
  if (body.length <= 4) return `FRU-${body}`;
  return `FRU-${body.slice(0, 4)}-${body.slice(4)}`;
}

export function isCompleteCode(code: string): boolean {
  return /^FRU-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(canonicalCode(code));
}

// ---------- sessione locale ----------

export function readSession(): FruPassProfile | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const profile = JSON.parse(raw);
    return profile && typeof profile.code === "string" ? profile : null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function saveSession(profile: FruPassProfile) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

// ---------- verifica presso l'ecosistema ----------

/** Errore di rete/servizio: il codice NON è da considerarsi invalido. */
export class FruPassUnreachable extends Error {}

async function callAuth(code: string, action: "login" | "refresh"): Promise<FruPassProfile> {
  let res: Response;
  try {
    res = await fetch(`${BASE}/api/auth/${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: canonicalCode(code) }),
    });
  } catch {
    // Nemmeno la nostra API risponde: backend spento, o nessuna rete.
    throw new FruPassUnreachable("Impossibile contattare il server");
  }

  if (res.status === 401) throw new Error("Codice non riconosciuto");

  if (!res.ok) {
    // I due casi vanno distinti, o si passa il tempo a cercare un guasto
    // dell'ecosistema che non c'è: 503 è l'unico che il nostro backend
    // restituisce quando è davvero Fru Pass a non rispondere. Tutto il
    // resto è un problema nostro — funzione che non parte, rotta non
    // instradata, errore interno — e va detto com'è.
    if (res.status === 503) {
      throw new FruPassUnreachable("Fru Pass non risponde, riprova tra poco");
    }
    const dettaglio = await res
      .json()
      .then((d) => d?.error)
      .catch(() => null);
    throw new FruPassUnreachable(
      dettaglio ? `Errore del server: ${dettaglio}` : `Errore del server (${res.status})`
    );
  }

  const data = await res.json();
  return data.profile as FruPassProfile;
}

export const verifyFruPass = (code: string) => callAuth(code, "login");
export const refreshFruPass = (code: string) => callAuth(code, "refresh");

// ---------- arrivo dall'hub ----------

/**
 * L'hub apre le app passando il codice nell'hash: `https://tappy…/#code=FRU-…`.
 * In quel caso l'utente è già identificato e NON deve rivedere il login.
 * Leggiamo il codice e ripuliamo subito l'URL, così non resta nella
 * cronologia né finisce condiviso per sbaglio.
 */
export function takeCodeFromHash(): string | null {
  const match = window.location.hash.match(/code=([A-Za-z0-9-]+)/);
  if (!match) return null;
  window.history.replaceState(null, "", window.location.pathname + window.location.search);
  return canonicalCode(match[1]);
}
