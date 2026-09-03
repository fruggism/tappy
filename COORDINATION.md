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
| **Automazioni (iPhone)** | L'**automazione** Apple Pay (non un comando rapido da lanciare a mano): trigger, estrazione di importo ed esercente, POST al webhook, onboarding dell'utente, sezione "Automazione Apple Pay" in Impostazioni (solo la parte funzionale). | `shortcuts/` (documentazione + file dell'automazione), contratto del webhook | schema DB, layout delle viste |

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
- **"Parte dall'iPhone"** (notifiche, automazioni, widget) → Automazioni.
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
  **Unica eccezione, decisa e motivata: Leaflet** (più un piccolo strato
  heat) per la mappa della Fase 5. La regola nasce per non appesantire i
  *grafici*; una mappa è un'altra cosa, e riscrivere proiezione, tessere e
  pinch-zoom non è tenere il progetto leggero — è rifare peggio. Non è un
  precedente per le altre viste: i grafici restano SVG a mano.
- **Regressioni visive**: chi tocca `Andamento.tsx` (767 righe, il file più
  delicato) descrive nella PR quali dei sette blocchi ha toccato — gauge,
  confronto, proiezione, anelli categoria, sparkline, in evidenza, macchina
  del tempo.

---

## 5. Stato del progetto e priorità

| Fase | Stato | Proprietario |
|---|---|---|
| 1 — UI su dati mock | ✅ fatta | UI Expert + UI Developer |
| 2 — collegamento ai dati reali | ✅ funzionante in locale: accesso Fru Pass verificato con un codice vero, dati su Airtable | Backend & Deploy |
| 3 — automazione + vista di dettaglio | ⏳ dettaglio fatto; l'automazione aspetta il deploy | Automazioni + UI Developer |
| 4 — integrazione fru-pass | 🆕 pianificata, F0 chiuso | Backend & Deploy (§6) |

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

### 6.1 I tre nodi — tutti decisi

**a) L'identità passa a `profile.code`.** Oggi `users.api_key` è insieme
login e chiave del webhook. Con Fru Pass il login è il codice, e l'api key
resta *solo* come segreto del webhook Apple Pay — non la si mostra più come
"credenziale d'accesso" ma come token dell'automazione. Il codice Fru Pass
non va mai messo nel Comando Rapido al posto della api key: è la credenziale
dell'intero ecosistema, non di tappy.
→ `users` prende una colonna `frupass_code` (unica); il seed dell'utente di
default resta solo per lo sviluppo locale.

**b) Il deploy. → DECISO: Netlify + Airtable.**
La guida presuppone un sito Netlify e SQLite lì non persiste. Il backend
diventa Netlify Functions con i dati su Airtable (la strada che la branch
`app-deployment-sync-agzd2h` ha già imboccato, vedi §7): un solo deploy per
client e API, niente host separato da mantenere. Il vecchio
`server/` Express+SQLite viene ritirato. Le credenziali Airtable sono
**nostre**, stanno nelle env var di Netlify e non entrano mai nel repo — e
non hanno nulla a che vedere con l'Airtable dell'ecosistema Fru Pass, che
non dobbiamo toccare.

**c) Conflitto di stile. → DECISO: si tiene lo stile tappy.**
Fru Pass impone palette "spaziale/cyber" (`#06070f`, ciano/magenta/gold),
font Orbitron + Space Grotesk, card `20px`, bottoni `12px`. Tappy è
l'opposto: minimale Apple, font di sistema, accenti fluorescenti.
**Vince tappy**: la palette `base/surface/surface2/ink/muted` e gli accenti
`neon-*` di `tailwind.config.js` restano, i font di sistema restano, i
grafici SVG restano. Niente Orbitron, niente `--foil`, niente `#06070f`.

Di Fru Pass si adotta **solo ciò che è funzionale**, ridisegnato nel
linguaggio visivo di tappy:

| Requisito della guida | Come lo facciamo |
|---|---|
| Login con un solo campo, placeholder `FRU-••••-••••` | sì, ma card `rounded-2xl bg-surface`, font di sistema, accento `neon-green` |
| Auto-login da `#code=` | sì, identico — è logica, non stile |
| Sessione `tappy_frupass` in `localStorage` | sì, identico |
| Header fisso: logo Fru Pass → home → toggle giorno/notte | sì, con il logo Fru Pass come unico elemento "ospite"; resto in stile tappy |
| Footer fisso con logo Fru Pass + versione | sì, stessa logica |
| `viewport-fit=cover` + `env(safe-area-inset-*)` | sì — in parte già presente |
| Palette cyber, Orbitron, `--foil`, raggi/ombre dell'ecosistema | **no** |
| Nessuna credenziale dell'ecosistema nel repo | sì, tassativo |

✅ **Deroga confermata dal proprietario del progetto.** Va comunicata
all'amministratore Fru Pass alla consegna: il punto per punto di cosa è
conforme e cosa è in deroga sta in `RELEASE-HUB.md` §2 (sul branch di
deploy). Se venisse negata, il fallback è il "guscio conforme, cuore tappy"
— un rifacimento del solo task F5, non dell'app.

**Logo Fru Pass e URL dell'hub**: rinviati alla consegna, come deciso. Nel
codice sono due costanti e un file segnaposto; la procedura per sostituirli
è in `RELEASE-HUB.md` §1. Non bloccano F5.

**Nome utente**: non serve. L'identità che conta è il codice Fru Pass, che
è mostrato in Impostazioni → Accesso.

### 6.2 Assegnazione dei task

| # | Task | Agent | Dipende da |
|---|---|---|---|
| F0 | ~~Scelta stile e host~~ — **decisi**: stile tappy, deploy Netlify + Airtable | ✅ fatto | — |
| F1 ✅ | *Fatto e verificato in locale con un codice Fru Pass reale.* (`claude/app-deployment-sync-agzd2h`). Client Fru Pass: `verifyFruPass()`, login/refresh, sessione `tappy_frupass` in `localStorage`, **auto-login da `#code=`**, logout | Backend & Deploy | F0 |
| F2 | `users.frupass_code`, rotte legate al codice invece che alla api key, api key declassata a solo-webhook | Backend & Deploy | F1 |
| F3 ⬅ **prossimo** | Deploy: client + Netlify Functions su Netlify, dati su Airtable, variabili `AIRTABLE_*` in Site configuration, `USE_MOCK = false` | Backend & Deploy | F2 |
| F4 ✅ | *Fatto* (`claude/ui-expert-f4-frupass`, `design/F4-login-header-footer.md` + mockup). Spec di login, header e footer **nel linguaggio visivo tappy**: dove sta il logo Fru Pass senza rompere la palette, come si veste il campo codice, come sta il toggle nell'header | UI Expert | F0 |
| F5 ✅ | *Fatto* (sul branch di deploy). Implementazione di F4: schermata login (campo unico, placeholder `FRU-••••-••••`), header fisso (logo Fru Pass → home → toggle giorno/notte), footer fisso con versione, `viewport-fit=cover` + `env(safe-area-inset-*)` | UI Developer | F4, F1 |
| F6 | Sezione "Apple Pay Shortcut" attiva: URL webhook + api key copiabili, ora che l'utente è identificato | Shortcuts | F2, F3 |
| F7 | **Automazione** iPhone reale (Comandi Rapidi → Automazione: scatta al pagamento, estrae importo ed esercente, POST al webhook). Non è un comando rapido da lanciare a mano: va su "Esegui immediatamente" senza conferma, e il trigger disponibile dipende dalla versione di iOS — prima cosa da verificare sull'iPhone | Shortcuts | F6 |

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


---

## 8. Fase 5 — dove ho speso (posizione e mappa)

Idea: l'automazione registra **anche la posizione** al momento del pagamento
Apple Pay; in Movimenti un'icona a mappa apre una **heatmap su OpenStreetMap**
dei luoghi in cui si è speso, filtrabile per giorno / mese / anno.

### 8.1 Le decisioni da prendere prima di scrivere codice

**a) Il modello dati cambia — è zona condivisa.**
`Transaction` prende `lat: number | null` e `lon: number | null` (e nient'altro:
niente indirizzo, niente nome del posto — si ricavano dalla mappa e ci
risparmiano una dipendenza da un servizio di geocoding). Ricade su
`types.ts`, sulla tabella `Transactions` di Airtable (due campi `Number` con
almeno 5 decimali), sul webhook, su `mockApi`, e sugli script
`check-airtable`/`doctor` che validano lo schema. **Il contratto si fissa
qui prima che qualcuno cominci**, come da §1.

**b) Serve una libreria, e il progetto ne vieta di nuove.**
Una mappa non è un grafico: tessere, pan, zoom e proiezione scritti a mano
sono riscrivere Leaflet peggio di Leaflet. Le opzioni:

1. **Leaflet + un piccolo strato heat** (~45 KB gzip), installati da npm e
   serviti dal nostro deploy. Standard, accessibile, e ci mette un pomeriggio.
   **È la mia raccomandazione**, come eccezione dichiarata alla regola:
   la regola nasce per non appesantire i *grafici*, che restano SVG a mano.
2. **Canvas a mano sopra le tessere OSM** prese per URL. Nessuna dipendenza,
   ma ~300 righe fra proiezione Web Mercator, cache delle tessere e gesto di
   pan/zoom, e una resa peggiore. Costa più di quanto risparmia.

La scelta è del proprietario: cambia la regola §4 «niente dipendenze nuove».

**c) Le tessere OSM hanno una policy d'uso.** I server pubblici di
OpenStreetMap sono gratuiti ma per usi leggeri, e chiedono
l'attribuzione visibile. Per un'app personale va bene; l'attribuzione non è
opzionale e va messa nella mappa.

**d) La posizione di ogni pagamento è un dato sensibile.** Sta nella nostra
base Airtable, sotto il codice Fru Pass dell'utente. Due conseguenze di
progetto, non facoltative: la registrazione della posizione dev'essere
**disattivabile** (l'automazione funziona anche senza: `lat`/`lon` restano
vuoti e la mappa mostra solo il resto), e dal dettaglio di un movimento si
deve poter **cancellare la sola posizione**.

**e) Il rischio vero è l'automazione, non la mappa.** Un'automazione che
scatta in background potrebbe non riuscire a leggere la posizione, o
richiedere un permesso che in background non viene concesso. **Va verificato
sull'iPhone prima di costruire il resto**: se lì non funziona, la mappa
resta senza dati e avremmo costruito una vista vuota.

### 8.2 Assegnazione

| # | Task | Agent | Dipende da |
|---|---|---|---|
| G0 ✅ | ~~Scelta sulla libreria~~ — **decisa: Leaflet + strato heat**, eccezione registrata in §4 | fatto | — |
| G1 ⏳ **a metà, tocca a te** | Lanciata a mano la posizione arriva; resta da provare con un pagamento vero, a telefono bloccato — | **Verifica sull'iPhone**: l'automazione riesce a leggere la posizione quando scatta da sé? Solo questo, prima di tutto il resto | Automazioni | — |
| G2 ✅ | *Fatto.* `lat`/`lon` in `types.ts`, nella tabella `Transactions`, nel webhook, in `mockApi` e negli script di verifica dello schema | Backend & Deploy | G1 |
| G3 | L'automazione manda `lat`/`lon` al webhook, con l'opzione di non mandarli | Automazioni | G1, G2 |
| G4 ✅ | *Fatto* (`design/G4-mappa.md`). Spec della vista mappa: come si entra da Movimenti, il selettore di periodo (giorno/mese/anno), la resa della heatmap nei due temi, lo stato vuoto («nessun movimento con posizione in questo periodo»), l'attribuzione OSM, e come si cancella una posizione | UI Expert | G0 |
| G5 ✅ | *Fatto.* Implementazione della vista mappa, con Leaflet caricato solo all'apertura | UI Developer | G4, G2 |

**Attenzione a una collisione**: il pacchetto grafico in lavorazione riscrive
buona parte di `Movimenti.tsx` (controlli, chip, raggruppamento per giorno).
La mappa deve quindi vivere in una vista propria (`views/Mappa.tsx`) e
toccare `Movimenti.tsx` per la sola icona di ingresso: una riga, non un
intreccio. Chi implementa G5 lo rispetti, o i due lavori si scontrano.

**G1 prima di tutto**: è l'unico punto che può far cadere l'intera idea, e
costa mezz'ora. Costruire mappa e schema prima di sapere se l'iPhone
collabora sarebbe il modo più caro di scoprirlo.


---

## 9. Cosa resta prima di passare all'hub

Fotografia al momento del deploy su un sito Netlify dedicato.

**Fatto e verificato:**

- accesso Fru Pass con codice reale, dati su Airtable, auto-login dall'hub;
- header, dock e schermata di accesso (F5);
- vista di dettaglio del movimento, con rimozione della posizione;
- mappa "Dove ho speso" con heatmap, filtrabile per giorno/mese/anno;
- strumenti di verifica dell'ambiente (`doctor`, `check-airtable`, `setup-env`).

**Resta, e dipende da altri:**

| Cosa | Da chi | Note |
|---|---|---|
| L'automazione vera (F7 + G3) | tu, dopo il deploy | contratto e istruzioni in `shortcuts/AUTOMAZIONE.md`; restano due verifiche sull'iPhone |
| Il pacchetto grafico (token tipografici, contrasto, `SpendingClock`, controlli di Movimenti) | il developer grafico | vedi `ERRATA-implementazione-UI.md` |
| Logo Fru Pass e URL dell'hub | l'amministratore | `RELEASE-HUB.md` §1 |

**Un difetto noto e non ancora corretto**: `#39ff88` su fondo chiaro sta a
1.4:1, sotto ogni soglia di leggibilità, e compare anche nel codice di F5
(il `py` del wordmark, l'anello di focus del campo codice). La correzione è
il §2 del pacchetto grafico, che introduce una variante accessibile
dell'accento: **non va fatta due volte**, o i due lavori si scontrano su
`tailwind.config.js` e `index.css`. Se il pacchetto non arriva, la si fa a
parte — ma non prima di saperlo.


---

## 10. Mappa dei branch (dopo il riordino)

Fotografia dopo la revisione e l'integrazione del pacchetto grafico.

**Vivo:**

| Branch | Cosa contiene |
|---|---|
| `main` | tutto: backend Netlify+Airtable, accesso Fru Pass, header e dock, mappa, dettaglio del movimento, pacchetto grafico, documentazione |

Non ci sono più branch di lavoro aperti: tutto ciò che era in corso è stato
verificato e mergiato.

**Archiviati** — conservati per lo storico, non da riprendere:

| Branch | Perché è archiviato |
|---|---|
| `archivio/ui-expert-f4-frupass` | la spec F4; i suoi file sono su `main`, il commit no |
| `archivio/comandi-rapidi-tappy-fweyvr` | il secondo backend indipendente (Express+Postgres) di §7: modello dati incompatibile, mai integrato |
| `archivio/sviluppa-questa-idea-9ye66e` | primo tentativo del pacchetto grafico, sulla base sbagliata; rifatto su quella giusta e integrato |

**Da eliminare a mano** (le credenziali di questa sessione possono creare
branch ma non cancellarli, e nemmeno pubblicare tag):

```
claude/app-deployment-sync-agzd2h
claude/tappy-project-coordination-sbsfnx
claude/ui-package-on-deployment-sync
claude/ui-expert-f4-frupass
claude/comandi-rapidi-tappy-fweyvr
claude/sviluppa-questa-idea-9ye66e
export-frupass
```

I primi quattro e `export-frupass` sono interamente dentro `main`: si
cancellano senza perdere niente. Gli ultimi due hanno commit propri, ma sono
già copiati sotto `archivio/`.

Dal Mac: `git push origin --delete <nome>` per ognuno, oppure dalla pagina
[Branches](https://github.com/fruggism/tappy/branches) del repository.
