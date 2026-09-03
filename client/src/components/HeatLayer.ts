// Livello heatmap disegnato a mano su canvas, montato dentro Leaflet.
//
// Perché non una libreria: di Leaflet ci serve la mappa (tessere, pan, zoom,
// proiezione), che è il pezzo che non ha senso riscrivere. La heatmap invece
// è una manciata di gradienti radiali, e scriverla ci lascia la palette di
// tappy invece del blu-rosso generico che portano gli strati heat già fatti.
import L from "leaflet";

export interface PuntoCaldo {
  lat: number;
  lon: number;
  /** Quanto pesa il punto: la quota a proprio carico della spesa. */
  peso: number;
}

// Dal freddo al caldo nel linguaggio dell'app: ciano dove si è passati poco,
// rosa dove si è speso di più. Le fermate stanno sull'intensità cumulata, non
// sull'importo: due caffè vicini scaldano quanto una spesa media.
const FERMATE: [number, [number, number, number]][] = [
  [0.0, [0, 229, 255]],
  [0.45, [57, 255, 136]],
  [0.75, [255, 207, 77]],
  [1.0, [255, 46, 203]],
];

/** Tabella di 256 colori, calcolata una volta sola invece che per pixel. */
function tabellaColori() {
  const tabella = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) {
    const t = i / 255;
    let a = FERMATE[0];
    let b = FERMATE[FERMATE.length - 1];
    for (let k = 0; k < FERMATE.length - 1; k++) {
      if (t >= FERMATE[k][0] && t <= FERMATE[k + 1][0]) {
        a = FERMATE[k];
        b = FERMATE[k + 1];
        break;
      }
    }
    const span = b[0] - a[0] || 1;
    const f = (t - a[0]) / span;
    tabella[i * 4 + 0] = a[1][0] + (b[1][0] - a[1][0]) * f;
    tabella[i * 4 + 1] = a[1][1] + (b[1][1] - a[1][1]) * f;
    tabella[i * 4 + 2] = a[1][2] + (b[1][2] - a[1][2]) * f;
    // I punti freddi restano semitrasparenti, o la mappa sotto sparisce.
    tabella[i * 4 + 3] = Math.min(255, i * 1.6);
  }
  return tabella;
}

const COLORI = tabellaColori();

export class HeatLayer extends L.Layer {
  private punti: PuntoCaldo[];
  private canvas?: HTMLCanvasElement;
  private raggio: number;

  constructor(punti: PuntoCaldo[], opzioni: { raggio?: number } = {}) {
    super();
    this.punti = punti;
    this.raggio = opzioni.raggio ?? 26;
  }

  setPunti(punti: PuntoCaldo[]) {
    this.punti = punti;
    this.disegna();
  }

  onAdd(map: L.Map): this {
    this.canvas = L.DomUtil.create("canvas", "leaflet-layer") as HTMLCanvasElement;
    this.canvas.style.pointerEvents = "none";
    map.getPanes().overlayPane.appendChild(this.canvas);

    map.on("moveend zoomend resize", this.disegna, this);
    // Durante il trascinamento il canvas resterebbe indietro rispetto alle
    // tessere: si nasconde e ricompare a movimento finito, invece di mostrare
    // una heatmap sfasata rispetto alla mappa.
    map.on("movestart zoomstart", this.nascondi, this);
    this.disegna();
    return this;
  }

  onRemove(map: L.Map): this {
    map.off("moveend zoomend resize", this.disegna, this);
    map.off("movestart zoomstart", this.nascondi, this);
    this.canvas?.remove();
    this.canvas = undefined;
    return this;
  }

  private nascondi = () => {
    if (this.canvas) this.canvas.style.opacity = "0";
  };

  private disegna = () => {
    const map = this._map;
    const canvas = this.canvas;
    if (!map || !canvas) return;

    const dimensione = map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = dimensione.x * dpr;
    canvas.height = dimensione.y * dpr;
    canvas.style.width = `${dimensione.x}px`;
    canvas.style.height = `${dimensione.y}px`;

    // Il canvas copre la finestra, non il mondo: si riposiziona sull'angolo
    // in alto a sinistra della vista corrente a ogni ridisegno.
    const angolo = map.containerPointToLayerPoint([0, 0]);
    L.DomUtil.setPosition(canvas, angolo);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, dimensione.x, dimensione.y);

    const massimo = Math.max(...this.punti.map((p) => p.peso), 1);

    // Primo passaggio: intensità in scala di grigi, sommando i gradienti.
    for (const punto of this.punti) {
      const p = map.latLngToContainerPoint([punto.lat, punto.lon]);
      if (p.x < -this.raggio || p.y < -this.raggio) continue;
      if (p.x > dimensione.x + this.raggio || p.y > dimensione.y + this.raggio) continue;

      const intensita = 0.25 + 0.75 * Math.min(punto.peso / massimo, 1);
      const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, this.raggio);
      g.addColorStop(0, `rgba(0,0,0,${intensita})`);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(p.x, p.y, this.raggio, 0, Math.PI * 2);
      ctx.fill();
    }

    // Secondo passaggio: l'intensità accumulata diventa colore.
    const immagine = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const dati = immagine.data;
    for (let i = 0; i < dati.length; i += 4) {
      const alpha = dati[i + 3];
      if (alpha === 0) continue;
      const j = alpha * 4;
      dati[i] = COLORI[j];
      dati[i + 1] = COLORI[j + 1];
      dati[i + 2] = COLORI[j + 2];
      dati[i + 3] = COLORI[j + 3];
    }
    ctx.putImageData(immagine, 0, 0);
    canvas.style.opacity = "1";
  };
}
