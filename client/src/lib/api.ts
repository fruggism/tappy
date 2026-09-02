// L'app parla con le Netlify Functions in netlify/functions/ (dati su Airtable).
// mockApi resta disponibile per sviluppare la UI offline, senza backend.
import { mockApi, API_BASE as MOCK_BASE } from "./mockApi";
import { realApi, API_BASE as REAL_BASE } from "./realApi";

// Esportata perché l'avvio dell'app deve saperlo: con i dati finti non c'è
// nessun ecosistema da interrogare, quindi la porta Fru Pass non si apre
// nemmeno — si entra e basta (vedi AppContext).
export const USE_MOCK = false;

export const api = USE_MOCK ? mockApi : realApi;
export const API_BASE = USE_MOCK ? MOCK_BASE : REAL_BASE;
