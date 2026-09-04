// L'avvio della mappa, in JavaScript puro perché è la parte che va provata
// con Leaflet vero (vedi tests/mappa.test.mjs) e non deve passare da una
// compilazione solo per essere testabile.
//
// Il punto delicato è uno: `fitBounds` su un contenitore che non ha ancora
// altezza non solleva errori, ma lascia lo zoom a `null`, e senza zoom
// Leaflet non chiede nemmeno una tessera — la mappa resta una superficie
// vuota. È successo davvero, aprendo «Dove ho speso»: il pannello monta la
// mappa prima che il layout gli abbia dato un'altezza.
//
// Quindi: prima una vista sicura, che vale sempre, poi l'inquadratura giusta
// quando il contenitore ha dimensioni vere.

/** Centro e zoom di ripiego: l'Italia, per un contenitore di forma qualsiasi. */
export const CENTRO_ITALIA = [42.0, 12.5];
export const ZOOM_ITALIA = 5;

/** Vero se l'elemento ha una superficie su cui si possa disegnare. */
export function haDimensioni(elemento) {
  return elemento.clientWidth > 0 && elemento.clientHeight > 0;
}

/**
 * Crea la mappa e la tiene allineata alle dimensioni del contenitore.
 *
 * @param L la libreria Leaflet
 * @param elemento il contenitore
 * @param inquadra funzione che riceve la mappa e decide cosa mostrare; viene
 *   chiamata appena il contenitore ha dimensioni, e a ogni cambio successivo
 *   (rotazione dello schermo, tastiera che si apre).
 * @returns { mappa, smonta }
 */
export function creaMappa(L, elemento, inquadra) {
  const mappa = L.map(elemento, { zoomControl: false, attributionControl: true });
  // Una vista valida prima di ogni altra cosa: da qui in poi la mappa ha
  // sempre uno zoom, quindi carica tessere qualunque cosa succeda dopo.
  mappa.setView(CENTRO_ITALIA, ZOOM_ITALIA);

  let inquadrata = false;
  const allinea = () => {
    if (!haDimensioni(elemento)) return;
    // Leaflet ha memorizzato la dimensione di quando è nato: se il pannello
    // era ancora chiuso, quella memoria è sbagliata e va rifatta.
    mappa.invalidateSize({ animate: false });
    if (!inquadrata) {
      inquadrata = true;
      inquadra(mappa);
    }
  };

  allinea();

  const osservatore =
    typeof ResizeObserver === "function" ? new ResizeObserver(allinea) : null;
  osservatore?.observe(elemento);

  return {
    mappa,
    riallinea: allinea,
    smonta() {
      osservatore?.disconnect();
      mappa.remove();
    },
  };
}
