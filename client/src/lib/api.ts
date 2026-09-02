// FASE 1: l'app usa dati mock locali (localStorage) per sviluppare e finalizzare la UI
// senza dipendere dal backend. FASE 2 collegherà queste stesse funzioni alle tabelle reali:
// per farlo basterà cambiare USE_MOCK a false (il backend Express+SQLite è già pronto in server/).
import { mockApi, API_BASE as MOCK_BASE } from "./mockApi";
import { realApi, API_BASE as REAL_BASE } from "./realApi";

const USE_MOCK = true;

export const api = USE_MOCK ? mockApi : realApi;
export const API_BASE = USE_MOCK ? MOCK_BASE : REAL_BASE;
