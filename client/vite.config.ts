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
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(`${data} \u00b7 v${process.env.BUILD_NUMBER || 1}`),
  },
})
