// Vocabolario haptic dell'app. Un solo punto in cui i pattern sono definiti,
// così restano coerenti fra le schermate. Su desktop `navigator.vibrate` non
// esiste e le chiamate diventano no-op silenziose.

export const HAPTIC = {
  /** Cambio di periodo durante il trascinamento: secco e leggero. */
  tick: 8,
  /** Rilascio e aggancio: un po' più pieno, conferma che ci si è fermati lì. */
  snap: 14,
  /** Limite raggiunto: il doppio colpo del "oltre non si va". */
  limit: [6, 40, 6],
  /** Ritorno al periodo corrente: un colpo solo, più lungo. */
  home: 22,
  /** Spesa registrata. */
  saved: 12,
  /** Si è appena entrati in un periodo fuori budget: l'unico haptic che porta una notizia. */
  overBudget: [10, 60, 10],
} as const;

function motionReduced() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/**
 * Chi riduce il movimento spesso riduce anche gli stimoli: in quel caso l'haptic tace.
 */
export function haptic(pattern: number | readonly number[]) {
  if (motionReduced()) return;
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(pattern as number | number[]);
  } catch {
    // Alcuni browser lanciano se la pagina non ha ancora ricevuto un'interazione.
  }
}
