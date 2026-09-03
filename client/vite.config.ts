import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Versione mostrata nel footer: "data del build · progressivo del giorno".
// Generata qui e non scritta a mano — una versione scritta a mano e' una
// versione sbagliata dopo due deploy.
const oggi = new Date();
const data = [
  oggi.getFullYear(),
  String(oggi.getMonth() + 1).padStart(2, "0"),
  String(oggi.getDate()).padStart(2, "0"),
].join(".");

// https://vite.dev/config/
// Dentro il sito condiviso dell'hub l'app non sta nella radice ma in una
// sottocartella (es. /tappy/): senza questo, gli asset verrebbero cercati
// nella radice del sito e la pagina resterebbe bianca.
// In locale e su un sito dedicato la variabile non serve.
// Percorsi relativi per default: così la stessa build funziona sia alla
// radice di un sito dedicato sia dentro una sottocartella dell'hub, senza
// doverla rifare. VITE_BASE_PATH resta per il caso in cui serva assoluto.
const basePath = process.env.VITE_BASE_PATH || "./";

// Per l'anteprima incapsulata in una pagina sola: mappa e dettaglio vengono
// caricati a richiesta, e dentro un iframe senza server quei file non
// esisterebbero. Non riguarda la build vera, dove il caricamento a richiesta
// e' quello che tiene l'app leggera.
const pezzoUnico = process.env.VITE_SINGLE_FILE === "1";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  build: pezzoUnico
    ? { rollupOptions: { output: { inlineDynamicImports: true } }, cssCodeSplit: false }
    : {},
  define: {
    __APP_VERSION__: JSON.stringify(`${data} \u00b7 v${process.env.BUILD_NUMBER || 1}`),
  },
})
