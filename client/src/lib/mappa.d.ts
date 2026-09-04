// Tipi per mappa.js, che resta JavaScript puro perché il test lo carica in
// un browser vero senza passare da una compilazione.
import type { Map as LeafletMap } from "leaflet";

export const CENTRO_ITALIA: [number, number];
export const ZOOM_ITALIA: number;
export function haDimensioni(elemento: Element): boolean;
export function creaMappa(
  L: typeof import("leaflet"),
  elemento: HTMLElement,
  inquadra: (mappa: LeafletMap) => void
): { mappa: LeafletMap; riallinea: () => void; smonta: () => void };
