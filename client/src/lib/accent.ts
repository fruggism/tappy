// Legge un accento dalla variabile CSS (vedi index.css), così i colori usati
// direttamente in JS (SVG stroke, box-shadow) seguono il tema chiaro/scuro
// invece di restare fissati ai fluo, che su sfondo chiaro non passano il
// contrasto WCAG.
export function accent(
  name: "green" | "pink" | "cyan" | "violet" | "amber" | "over",
  fallback: string
) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--acc-${name}`).trim();
  return v || fallback;
}
