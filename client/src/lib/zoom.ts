// Lo zoom con le dita è disattivato ovunque tranne che sulla mappa.
//
// È una scelta deliberata: tappy deve comportarsi come un'app, non come una
// pagina web, e nessuna delle sue schermate ha contenuto che si legga meglio
// ingrandendolo — la mappa sì, ed è l'unica esclusa.
//
// Il meta viewport con `user-scalable=no` non basta: Safari lo ignora da iOS
// 10 proprio per non lasciare che i siti tolgano lo zoom. Ciò che funziona è
// annullare gli eventi `gesture*`, che sono di WebKit e riguardano lo zoom
// **della pagina**. Leaflet non li usa — il suo pinch è costruito sui
// `touchmove` — ma l'esclusione esplicita resta, così se un domani cambiasse
// il modo di ingrandire la mappa continuerebbe a funzionare.

/** Vero se il gesto va annullato: cioè ovunque fuori dalla mappa. */
export function vaImpedito(bersaglio: EventTarget | null): boolean {
  const elemento = bersaglio instanceof Element ? bersaglio : null;
  return !elemento?.closest(".leaflet-container");
}

export function impedisciZoomDelleDita(radice: Document = document) {
  for (const nome of ["gesturestart", "gesturechange", "gestureend"]) {
    radice.addEventListener(
      nome,
      (e) => {
        if (vaImpedito(e.target)) e.preventDefault();
      },
      // passive:false è obbligatorio: senza, preventDefault viene ignorato.
      { passive: false }
    );
  }
}
