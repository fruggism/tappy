# tappy — guida per chi continua lo sviluppo

Questo documento spiega com'è organizzato il progetto, come è ospitato, e
lo schema esatto delle tabelle Airtable che fanno da database.

## Architettura

```
client/               — React + Vite + Tailwind, l'app vera e propria
netlify/functions/    — API REST come un'unica Netlify Function (Express)
netlify/functions/lib/airtable.js — layer di accesso dati (legge/scrive su Airtable)
scripts/seed-user.js  — crea un nuovo utente + categorie di default
netlify.toml          — config build/deploy e redirect /api/* -> funzione
```

Non c'è più un server Express separato da tenere acceso: il backend è una
**Netlify Function** (serverless, parte "on demand" a ogni richiesta) che
usa **Airtable** come database al posto di un file SQLite locale — così i
dati sono raggiungibili da qualunque dispositivo, non solo dal computer su
cui gira il server.

## Autenticazione

Ogni utente ha una **chiave personale** (stringa esadecimale generata da
`scripts/seed-user.js`). Il client la salva in `localStorage` dopo il primo
inserimento (schermata "Inserisci la tua chiave personale") e la manda in
ogni richiesta come header `x-api-key`. Il backend risolve l'utente
cercando quella chiave nella tabella `Users` di Airtable — nessuna sessione
lato server, nessuna password: usare la stessa chiave su un altro
dispositivo dà accesso agli stessi dati.

## Schema Airtable

Crea una base Airtable con queste 4 tabelle e questi campi esatti (i nomi
contano: il backend li usa così come sono).

### `Users`
| Campo | Tipo | Note |
|---|---|---|
| `Name` | Single line text | |
| `ApiKey` | Single line text | generata da `seed-user.js`, unica |
| `Theme` | Single line text | `light` / `dark` / `system` |
| `MonthlyBudget` | Number | |
| `CreatedAt` | Single line text | ISO 8601, scritta dal backend |

### `Categories`
| Campo | Tipo | Note |
|---|---|---|
| `UserId` | Single line text | record id di `Users` (es. `recXXXXXXXX`) |
| `Name` | Single line text | |
| `Color` | Single line text | es. `#39ff88` |
| `Icon` | Single line text | |
| `IsDefault` | Checkbox | le 4 categorie di base (non rinominabili/eliminabili) |
| `SortOrder` | Number | |
| `Budget` | Number | facoltativo, lascia vuoto se non usato |

### `Cards`
| Campo | Tipo | Note |
|---|---|---|
| `UserId` | Single line text | record id di `Users` |
| `Name` | Single line text | |

### `Transactions`
| Campo | Tipo | Note |
|---|---|---|
| `UserId` | Single line text | record id di `Users` |
| `Date` | Single line text | `YYYY-MM-DD` |
| `Time` | Single line text | `HH:MM`, facoltativo |
| `Amount` | Number | importo totale della spesa |
| `MyShare` | Number | quota a proprio carico (spese divise) |
| `Name` | Single line text | esercente/descrizione |
| `CardId` | Single line text | record id di `Cards`, facoltativo |
| `CategoryId` | Single line text | record id di `Categories` |
| `Source` | Single line text | `manual` / `applepay` |
| `IsIncome` | Checkbox | |
| `Note` | Single line text | facoltativo |
| `CreatedAt` | Single line text | ISO 8601, scritta dal backend |

I campi `UserId`/`CardId`/`CategoryId` sono testo semplice contenente il
record id Airtable (non "linked record"): il backend li tratta come le
vecchie foreign key SQLite, e questo mantiene semplici le query
(`filterByFormula`).

**Categorie predefinite**: "Spesa", "Macchina", "Leisure", "Altro" —
create da `scripts/seed-user.js` per ogni nuovo utente. "Altro" è il
fallback quando una spesa non ha (o perde) una categoria valida.

## Deploy

1. **Airtable**: crea la base con lo schema sopra. Genera un Personal
   Access Token (airtable.com/create/tokens) con scope `data.records:read`
   e `data.records:write` sulla base — è `AIRTABLE_API_KEY`. L'ID base
   (`appXXXXXXXXXXXXXX`) è `AIRTABLE_BASE_ID`.
2. **Crea il primo utente**: `AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... node scripts/seed-user.js "Nome"`
   (dopo `npm install` nella root del repo). Salva la chiave stampata.
3. **Netlify**: "Add new site" → "Import an existing project" → collega il
   repo GitHub. Netlify legge `netlify.toml` da solo (build command,
   publish dir, redirect `/api/*`). Aggiungi in Site configuration →
   Environment variables: `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID`. Deploy.
4. Apri il dominio Netlify da ogni dispositivo (telefono, computer) e
   inserisci la chiave personale al primo accesso.
5. **Comando Rapido Apple Pay**: usa come URL `https://<tuo-dominio-netlify>/api/webhook/applepay`
   e come header `x-api-key: <chiave personale>` (vedi sezione dedicata in
   Impostazioni nell'app, che mostra URL e chiave pronti da copiare).

## Sviluppo locale

Serve la [Netlify CLI](https://docs.netlify.com/cli/get-started/)
(`npm install -g netlify-cli`) per far girare client + funzione insieme
sulla stessa porta, esattamente come in produzione:

```bash
npm install                    # dipendenze della funzione (root)
cd client && npm install && cd ..
AIRTABLE_API_KEY=... AIRTABLE_BASE_ID=... netlify dev
```

Per lavorare solo sulla UI senza toccare Airtable, in `client/src/lib/api.ts`
metti `USE_MOCK = true`: l'app userà dati finti salvati in `localStorage`
(stessa interfaccia di `realApi`, nessun componente da toccare).

## Le tre schermate

### Andamento
Sintesi con **macchina del tempo**: si sceglie giornaliero/settimanale/
mensile, e con l'icona a orologio si seleziona un giorno preciso nel
passato — l'app ricalcola tutto come se "si fosse in quel giorno" (le tab
giorno/settimana/mese restano ancorate a quella data finché non si torna a
oggi). Contiene: gauge animato (anello segmentato per categoria, non un
grafico a ciambella statico), confronto col periodo precedente (mini-barre
animate), proiezione di fine periodo (anello di progresso, solo se il
periodo è ancora in corso), griglia di anelli per categoria (colorati,
mostrano "oltre budget" se una categoria supera il proprio limite), uno
sparkline degli ultimi 14 giorni con tooltip al passaggio del mouse/tocco,
e infine la categoria/esercente che pesa di più nel periodo.

### Movimenti
Lista dei movimenti (da Apple Pay o manuali), filtrabile per categoria e
ordinabile per data/importo. Ogni riga ha un menu a tre puntini con
"Modifica" ed "Elimina". Il pulsante "Registra spesa" apre lo stesso
modale per inserire manualmente uscite o entrate.

### Impostazioni
Tema (chiaro/scuro/sistema, persistito), budget mensile generale (con
equivalente settimanale/giornaliero mostrato in automatico), gestione
categorie (nome, colore, budget facoltativo), sezione "Apple Pay Shortcut"
con URL webhook e chiave personale copiabili, e pulsante per disconnettersi
(cambia chiave/dispositivo).

## Cosa manca

Il **Comando Rapido iPhone vero e proprio** (estrarre importo ed esercente
dal testo della notifica Apple Pay e fare la POST al webhook) e una
**vista di dettaglio** per il singolo movimento (oggi c'è solo il modale di
modifica/eliminazione dalla lista Movimenti) restano da costruire.

## Convenzioni di stile utili da rispettare

- Font di sistema Apple (`-apple-system` ecc.), niente librerie di
  charting esterne: i grafici sono tutti SVG/CSS fatti a mano per restare
  leggeri e coerenti (`RadialGauge`, `MiniRing`, `Sparkline` in
  `Andamento.tsx`).
- Palette: `base`/`surface`/`surface2`/`ink`/`muted` per chiaro/scuro
  (vedi `client/tailwind.config.js`), accenti `neon-green/cyan/pink/
  violet/amber`. Verde = ok/risparmio, rosa = sforamento/aumento, ciano =
  stato "viaggio nel tempo attivo".
- Tutte le card usano `rounded-2xl bg-surface dark:bg-surface-dark p-4`;
  le animazioni sono leggere (count-up sui numeri, anelli che si
  disegnano al mount, nessuna libreria di animazione esterna).
- Il tema (chiaro/scuro/sistema) è gestito interamente lato client
  (`AppContext.tsx`), non serve altro codice per supportarlo.
