// L'app parla con le Netlify Functions in netlify/functions/ (dati su Airtable).
// mockApi resta disponibile per sviluppare la UI offline, senza backend.
import { mockApi, API_BASE as MOCK_BASE } from "./mockApi";
import { realApi, API_BASE as REAL_BASE } from "./realApi";

const USE_MOCK = false;

export const api = USE_MOCK ? mockApi : realApi;
export const API_BASE = USE_MOCK ? MOCK_BASE : REAL_BASE;
