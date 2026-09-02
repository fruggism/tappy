# tappy — guida di coordinamento

Questo documento non spiega *come funziona* tappy (per quello ci sono
[`README.md`](./README.md) e [`GUIDE.md`](./GUIDE.md)): spiega **chi fa cosa**.
È la guida operativa del coordinatore e degli agent che lavorano al progetto.

Regola d'oro: **le idee entrano dal coordinatore, escono come task assegnati a
un solo agent proprietario.** Nessun agent tocca file di proprietà di un altro
senza passare da qui.

---

## 1. Gli agent e i loro confini

| Agent | Ruolo | File di sua proprietà | Non tocca mai |
|---|---|---|---|
| **UI Expert** | Design, non codice di produzione. Definisce layout, gerarchia visiva, micro-interazioni, palette, copy. Consegna spec + mockup, non PR sull'app. | `design/` (spec, mockup, note), `tailwind.config.js` (proposte di palette) | tutto `src/` |
| **UI Developer** | Implementa le spec dell'UI Expert. Componenti, viste, grafici SVG, animazioni, stato locale. | `client/src/views/`, `client/src/components/`, `client/src/index.css`, `client/src/App.tsx` | `client/src/lib/*Api.ts`, `server/` |
| **Backend & Deploy** | Server Express/SQLite, schema, rotte, autenticazione, hosting, sincronizzazione multi-dispositivo, migrazione dal mock ai dati reali. | `server/`, `client/src/lib/realApi.ts`, `client/src/lib/api.ts`, `client/.env*`, config di deploy | viste e componenti |
| **Shortcuts (iPhone)** | Comando Rapido Apple Pay: parsing della notifica, POST al webhook, onboarding dell'utente, sezione "Apple Pay Shortcut" in Impostazioni (solo la parte funzionale). | `shortcuts/` (documentazione + file del comando), contratto del webhook | schema DB, layout delle viste |

**Zone condivise** (serve accordo esplicito del coordinatore prima di
modificarle, perché rompono tutti):

- `client/src/lib/types.ts` — il modello dati. Cambiarlo tocca client, server e webhook.
- `client/src/lib/api.ts` — l'interfaccia comune fra `mockApi` e `realApi`.
- `server/src/db.ts` — lo schema.

---

## 2. Il contratto che tiene tutto insieme

Il progetto regge perché `mockApi` e `realApi` espongono **la stessa identica
interfaccia**, e lo switch è una riga sola:

```ts
// client/src/lib/api.ts
const USE_MOCK = true;
export const api = USE_MOCK ? mockApi : realApi;
```

Conseguenze operative, valide per tutti:

1. L'UI Developer programma **solo contro `api`**, mai contro `fetch` diretto.
   Così può lavorare col mock mentre il backend cambia sotto.
2. Chi aggiunge un metodo all'API lo aggiunge **in entrambe** le
   implementazioni nella stessa PR, altrimenti il mock si rompe.
3. Chi cambia `types.ts` apre un task esplicito al coordinatore, che avvisa
   gli altri tre agent prima del merge.

---

## 3. Come io instrado un'idea

Quando mi proponi un'idea la classifico così, e questo determina l'agent:

- **"Si vede"** (schermata nuova, grafico, layout, animazione, copy)
  → UI Expert per la spec → UI Developer per l'implementazione. Due task in
  sequenza, mai in parallelo: il developer parte solo quando la spec esiste.
- **"Si salva / si sincronizza / va online"** (nuovi dati, nuove rotte,
  hosting, backup, più dispositivi, login) → Backend & Deploy.
- **"Parte dall'iPhone"** (notifiche, automazioni, Comandi Rapidi, widget)
  → Shortcuts.
- **Idea che tocca due o tre di questi** → la spezzo io in task per agent, con
  l'ordine di esecuzione e il contratto (tipi/rotte) fissato **prima** che
  qualcuno inizi.

Quello che ricevi da me per ogni idea: *cosa* si costruisce, *chi* lo fa,
*in che ordine*, e *cosa serve decidere prima* (se serve).

---

## 4. Workflow

- **Branch**: uno per task, `claude/<area>-<slug>`; niente commit diretti su `main`.
- **Un task = un agent = un'area**. Se un task ha bisogno di toccare due aree,
  è due task.
- **Fatto significa**: `npm run lint` e `npm run build` puliti in `client/`;
  provato a mano con `USE_MOCK = true`; e — se il task tocca `realApi` o il
  server — provato anche con `USE_MOCK = false` e il server acceso.
- **Niente dipendenze nuove senza il mio ok.** Il progetto è deliberatamente
  leggero: nessuna libreria di charting, nessuna libreria di animazione, i
  grafici sono SVG/CSS scritti a mano. Vale ancora.
- **Regressioni visive**: chi tocca `Andamento.tsx` (767 righe, il file più
  delicato) descrive nella PR quali dei sette blocchi ha toccato — gauge,
  confronto, proiezione, anelli categoria, sparkline, in evidenza, macchina
  del tempo.

---

## 5. Stato del progetto e priorità

| Fase | Stato | Proprietario |
|---|---|---|
| 1 — UI su dati mock | ✅ fatta | UI Expert + UI Developer |
| 2 — collegamento ai dati reali | ⏳ server pronto, client ancora su mock | Backend & Deploy |
| 3 — Comando Rapido + vista di dettaglio | ❌ da fare | Shortcuts + UI Developer |
| 4 — integrazione fru-pass | 🆕 pianificata | Backend & Deploy (guida, §6) |

Ordine consigliato: **la Fase 2 sblocca tutto il resto.** Il Comando Rapido
non ha senso finché il client legge dal `localStorage`, e la vista di
dettaglio è più veloce da fare quando i dati sono già veri. Quindi:

1. Backend & Deploy: `USE_MOCK = false`, hosting del server, API key gestita
   dal client, sync fra dispositivi.
2. Shortcuts: Comando Rapido reale + sezione Impostazioni con URL e API key
   copiabili (oggi placeholder disabilitato).
3. UI Expert → UI Developer: vista di dettaglio del singolo movimento.

---

## 6. Integrazione fru-pass

Guida ricevuta. Fru Pass è **solo identità**: un endpoint pubblico condiviso
che verifica un codice `FRU-XXXX-XXXX` e restituisce un `profile`
(`code`, `name`, `username`). I dati dell'app restano nostri, associati a
`profile.code`. Questo cambia tre cose in tappy — chi è l'utente, dove gira
il backend, e come si veste l'app.

### 6.1 I tre nodi da sciogliere (decisioni, non task)

**a) L'identità passa a `profile.code`.** Oggi `users.api_key` è insieme
login e chiave del webhook. Con Fru Pass il login è il codice, e l'api key
resta *solo* come segreto del webhook Apple Pay — non la si mostra più come
"credenziale d'accesso" ma come token dell'automazione. Il codice Fru Pass
non va mai messo nel Comando Rapido al posto della api key: è la credenziale
dell'intero ecosistema, non di tappy.
→ `users` prende una colonna `frupass_code` (unica); il seed dell'utente di
default resta solo per lo sviluppo locale.

**b) Il deploy. → Risolto, vedi §7:** si va su Netlify Functions + Airtable.
Contesto originale: l'attuale server Express+SQLite non è deployabile come richiesto.
La guida presuppone un sito Netlify. SQLite su Netlify non persiste. Serve
portare le rotte a Netlify Functions con uno storage gestito (Firebase o una
base Airtable nostra, come suggerisce §5 della guida) — oppure ospitare il
server Express altrove e mettere su Netlify solo il client. **La seconda è
più economica** (il codice server esiste già e funziona), ma richiede un
host con disco persistente. Decisione mia, da confermare con te: client su
Netlify + server Express su host separato, con la migrazione a Functions
rimandata solo se l'host dà problemi.

**c) Conflitto di stile, ed è il punto più delicato.** Fru Pass impone
palette "spaziale/cyber" (`#06070f`, ciano/magenta/gold), font Orbitron +
Space Grotesk, header e footer fissi con logo Fru Pass, card `20px`,
bottoni `12px`. Tappy oggi è **l'opposto dichiarato**: minimale Apple, font
di sistema, accenti fluorescenti. I due standard non si sommano da soli.
Le opzioni sono tre e la scelta è tua, non degli agent:
1. **Conformità piena** — tappy si riveste da app dell'ecosistema. Coerente
   nell'hub, ma butta via l'identità visiva costruita in Fase 1.
2. **Guscio conforme, cuore tappy** — login, header e footer esattamente
   secondo lo standard Fru Pass; le tre schermate interne restano Apple-
   minimali. È il compromesso che la guida stessa rende possibile ("cambiando
   solo il contenuto centrale con la tua funzionalità"). **È la mia
   raccomandazione.**
3. **Deroga** — si chiede all'amministratore di accettare tappy com'è, con il
   solo login conforme. Va negoziato fuori dal codice.

Il resto della sezione assume l'opzione 2. Se scegli la 1, il task UI
diventa molto più grosso e va rifatta anche la palette in
`tailwind.config.js`.

### 6.2 Assegnazione dei task

| # | Task | Agent | Dipende da |
|---|---|---|---|
| F0 | Scelta dell'opzione di stile (§6.1c) e dell'host (§6.1b) | **tu** | — |
| F1 | Client Fru Pass: `verifyFruPass()`, login/refresh, sessione `tappy_frupass` in `localStorage`, **auto-login da `#code=`**, logout | Backend & Deploy | F0 |
| F2 | `users.frupass_code`, rotte legate al codice invece che alla api key, api key declassata a solo-webhook | Backend & Deploy | F1 |
| F3 | Deploy: client su Netlify, server sull'host scelto, `VITE_API_URL`, `USE_MOCK = false` | Backend & Deploy | F2 |
| F4 | Spec di login/header/footer in stile Fru Pass innestati su tappy: cosa resta neon-Apple e cosa diventa cyber, e come non stonano fra loro | UI Expert | F0 |
| F5 | Implementazione di F4: schermata login (campo unico, placeholder `FRU-••••-••••`), header fisso (logo Fru Pass → home → toggle giorno/notte), footer fisso con versione, `viewport-fit=cover` + `env(safe-area-inset-*)` | UI Developer | F4, F1 |
| F6 | Sezione "Apple Pay Shortcut" attiva: URL webhook + api key copiabili, ora che l'utente è identificato | Shortcuts | F2, F3 |
| F7 | Comando Rapido reale (parsing notifica → POST al webhook) | Shortcuts | F6 |

Il toggle giorno/notte manuale richiesto dalla guida **c'è già**
(`AppContext.tsx`, chiaro/scuro/sistema): F5 lo espone nell'header, non lo
riscrive.

### 6.3 Vincoli non negoziabili per chiunque tocchi questa parte

- Nessuna credenziale dell'ecosistema (token Airtable, base id) entra in
  questo repository. La verifica del codice passa **solo** dall'endpoint
  `https://frupass-user.netlify.app/.netlify/functions/api`.
- Chiave di sessione locale: `tappy_frupass`. Nome app nell'ecosistema:
  `tappy`, minuscolo.
- L'auto-login da `#code=` è obbligatorio e va testato: la guida segnala che
  è il passaggio più spesso dimenticato. L'URL va ripulito con
  `history.replaceState` subito dopo la lettura.
- Il `refresh` all'avvio non deve bloccare la UI: si mostra la home con il
  profilo salvato e si invalida la sessione solo se la verifica fallisce.
- L'ordine è quello della tabella: **F1 prima di tutto**, perché senza
  identità reale né il deploy né il Comando Rapido hanno un utente a cui
  attaccare i dati.

---

## 7. Stato delle branch (fotografia al 2026-09-02)

Due agent hanno già lavorato in parallelo, **senza contratto condiviso**, e i
risultati collidono. Questa sezione è il verdetto: cosa si tiene, cosa si
riparte.

### `claude/app-deployment-sync-agzd2h` — Backend & Deploy ✅ **linea principale**

Sostituisce Express+SQLite con **Netlify Functions + Airtable**, elimina
`server/`, aggiunge `netlify.toml`, `scripts/seed-user.js`, e mette
`USE_MOCK = false`. Riusa le stesse rotte e lo stesso modello dati del server
originale, quindi il client non è stato stravolto: `realApi.ts` e
`AppContext.tsx` cambiano poco. È coerente col progetto e con il vincolo
Netlify della guida Fru Pass, e risolve da sola il nodo §6.1b — **adottiamo
questa, non l'host separato che avevo ipotizzato.**

**Da correggere prima del merge** (task per Backend & Deploy):
- Usa un header `x-frupas-code` e cerca l'utente **direttamente su Airtable**
  per codice. Ma il codice Fru Pass non è nostro da validare: la verifica
  deve passare dall'endpoint condiviso
  (`POST .../functions/api`, `action: "login"` / `"refresh"`), come impone
  §1 della guida. Airtable resta solo per i *dati* di tappy, indicizzati su
  `profile.code`.
- Il fallback `?code=...` in query string espone il codice dell'intero
  ecosistema negli URL e nei log. Va rimosso: il Comando Rapido usa la sua
  api key sul webhook, non il codice Fru Pass (§6.1a).
- Manca tutto il lato client di F1: schermata di login, sessione
  `tappy_frupass`, auto-login da `#code=`.

### `claude/comandi-rapidi-tappy-fweyvr` — Shortcuts ❌ **da rifare**

Ha costruito un **secondo backend indipendente** nella radice del repo
(Express + Postgres, `src/server.js`, `migrations/001_init.sql`) più una
`public/index.html` propria, ignorando `client/` e `server/` esistenti. Il
suo modello dati è un'altra app: `expenses(amount, description, category)` —
niente `my_share`, niente spese divise, niente `cards`, niente
`is_income`, niente budget. E introduce un terzo schema di autenticazione
(codici a 8 caratteri hashati SHA-256), diverso sia dall'api key sia da Fru
Pass. Al momento del merge collide con l'altra branch su `package.json`,
`.env.example`, `.gitignore` e `README.md`, tutti in radice.

Non è codice da recuperare: è la stessa app riscritta in piccolo. Si tiene
solo l'**idea** — token dedicato per i Comandi Rapidi e normalizzazione del
codice in input — e si riparte **dalla branch di deploy**, contribuendo solo
il Comando Rapido e la sezione Impostazioni (task F6/F7). Il webhook
`/api/webhook/applepay` esiste già ed è quello il punto di ingresso.

### Ordine di merge

1. Correzioni Fru Pass su `app-deployment-sync-agzd2h` (auth vera + F1 client).
2. Merge su `main`. Da qui in poi **tutte le branch ripartono da `main`.**
3. UI Expert (F4) → UI Developer (F5) sul guscio Fru Pass.
4. Shortcuts riparte da zero su `main` per F6/F7.

### La lezione, che vale come regola

Le due branch sono nate in parallelo senza che nessuno fissasse prima
l'autenticazione e il modello dati — e hanno prodotto tre schemi di auth
diversi e due backend. Da adesso: **nessun agent apre una branch che tocca
`types.ts`, `db`/storage o l'autenticazione senza che il contratto sia
scritto qui prima.** È esattamente il ruolo delle "zone condivise" di §1.
