# tappy — guida per chi continua lo sviluppo

Questo documento è pensato per gli agent/sviluppatori che riprenderanno il
progetto (in particolare per collegare il **Comando Rapido iPhone** e
pubblicare l'app). Spiega cosa esiste già, come è organizzato, e cosa manca.

## ⚠️ Dove si trova il codice

Tutto il lavoro fatto finora **non è su questo branch (`main`)**, che
contiene solo questo file. Il codice vive sul branch:

```
claude/sviluppa-questa-idea-9ye66e
```

Prima di continuare, `git checkout` (o merge) di quel branch. Contiene
client, server e uno storico di commit descrittivi di ogni fase.

## Cos'è tappy

App per registrare **live le spese fatte con le carte**, con l'obiettivo
finale di ricevere automaticamente i pagamenti Apple Pay via un'automazione
di Comandi Rapidi su iPhone. Stile grafico minimale in linea ad Apple, con
dettagli fluorescenti (verde neon come colore primario, più ciano/rosa/
viola/ambra per categorie e stati).

## Le tre fasi del progetto

Il lavoro è stato deliberatamente diviso in tre fasi, da fare in questo
ordine:

1. **Fase 1 — UI indipendente dai dati reali** ✅ *completata*.
   Tutta la grafica (le tre schermate, i grafici, le animazioni) è stata
   sviluppata e rifinita usando dati finti generati in `localStorage`, così
   da poter iterare velocemente sul design senza dipendere dal backend.
2. **Fase 2 — collegamento alle tabelle dati utente** ⏳ *backend pronto,
   non ancora collegato al client*. Il server Express + SQLite esiste già
   con tutte le rotte necessarie (vedi sotto), ma il client punta ancora ai
   dati mock.
3. **Fase 3 — Comando Rapido iPhone + vista di dettaglio** ❌ *da fare*.
   È il lavoro che toccherà a chi riprende il progetto: collegare
   l'automazione Apple Pay al webhook, e costruire una vista di dettaglio
   per il singolo movimento (attualmente si apre solo un modale di
   modifica/eliminazione dalla lista Movimenti).

## Struttura del repository

```
client/   — React + Vite + Tailwind (l'app vera e propria)
server/   — Express + SQLite (API REST, già pronte ma non ancora collegate)
```

### Client (`client/`)

- `src/lib/types.ts` — tipi condivisi: `User`, `Category`, `Card`, `Transaction`.
- `src/lib/mockApi.ts` — implementazione "finta" dell'API, backed da
  `localStorage`. Usata in Fase 1.
- `src/lib/realApi.ts` — implementazione vera, fa `fetch` verso il server
  Express (`VITE_API_URL`, default `http://localhost:4000`).
- `src/lib/api.ts` — **punto di switch fra le due**. Contiene:
  ```ts
  const USE_MOCK = true;
  export const api = USE_MOCK ? mockApi : realApi;
  ```
  Per la Fase 2 basta cambiare `USE_MOCK` a `false` (il server deve essere
  in esecuzione). Le due implementazioni hanno **la stessa identica
  interfaccia**, quindi nessun componente va toccato.
- `src/lib/AppContext.tsx` — stato globale React (utente, categorie, carte,
  transazioni, tema) caricato tramite `api`.
- `src/views/Andamento.tsx` — sintesi/andamento spese (vedi sotto).
- `src/views/Movimenti.tsx` — lista movimenti.
- `src/views/Impostazioni.tsx` — impostazioni utente.
- `src/components/RadialGauge.tsx` — il gauge animato principale.
- `src/components/TransactionModal.tsx` — form di aggiunta/modifica movimento.

### Server (`server/`)

- `src/db.ts` — schema SQLite (`users`, `categories`, `cards`,
  `transactions`) e seed di un utente di default con le 4 categorie
  predefinite.
- `src/index.ts` — tutte le rotte REST, **incluso il webhook Apple Pay**
  già pronto (vedi sezione dedicata sotto). `npm run dev` in `server/`
  lo avvia su `:4000` e stampa in console l'API key dell'utente di default.

## Modello dati

```ts
User {
  id, name, api_key, theme: "light"|"dark"|"system",
  monthly_budget: number, created_at
}

Category {
  id, user_id, name, color, icon,
  is_default: 0|1,       // le 4 categorie di base non si eliminano/rinominano
  sort_order: number,
  budget: number | null  // budget mensile dedicato, facoltativo
}

Card { id, user_id, name }

Transaction {
  id, user_id, date, time,
  amount: number,        // importo totale della spesa
  my_share: number,      // quanto è effettivamente a proprio carico (vedi split)
  name: string,          // nome esercente/descrizione
  card_id, category_id,
  source: "manual" | "applepay",
  is_income: 0 | 1,
  note, created_at
}
```

**Categorie predefinite**: "Spesa", "Macchina", "Leisure", "Altro" — quest'ultima
è il fallback quando una spesa non ha (o perde) una categoria valida, e non
si può rinominare/eliminare. Ogni utente può aggiungerne altre, con colore
a scelta e budget mensile facoltativo.

**Spese divise**: `amount` è l'importo pagato realmente (es. alla cassa),
`my_share` è la quota di propria competenza. Nel form di inserimento questo
si gestisce in due modalità: "Parti uguali" (si indica in quante persone e
si calcola da sé) oppure "Il mio importo" (si scrive direttamente la quota).

**Budget**: `monthly_budget` dell'utente è il budget generale; ogni
categoria può averne uno proprio e facoltativo (`Category.budget`). In
tutte le viste, un budget mensile viene scalato al periodo selezionato con
la stessa formula: giornaliero = `budget / giorni_nel_mese`, settimanale =
`(budget / giorni_nel_mese) * 7`.

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
categorie (nome, colore, budget facoltativo), e una sezione "Apple Pay
Shortcut" attualmente segnaposto (etichettata "Fase 3") che mostrerà l'URL
del webhook e l'API key una volta collegato il backend reale.

## Il webhook Apple Pay (già pronto lato server)

`POST /api/webhook/applepay` — pensato per essere chiamato da
un'automazione Comandi Rapidi "Alla ricezione di una notifica" filtrata su
Apple Pay.

- **Header** `x-api-key`: l'API key dell'utente (stampata in console al
  primo avvio del server, o leggibile dalla tabella `users`).
- **Body JSON**:
  ```json
  { "amount": 12.5, "name": "Bar Roma", "card": "Visa", "category": "Leisure", "date": "2026-09-02", "time": "18:30", "note": "opzionale" }
  ```
  Solo `amount` e `name` sono obbligatori. `card` e `category` vengono
  create automaticamente se non esistono già (case-insensitive); se
  `category` non corrisponde a nulla, la spesa finisce in "Altro". Se
  `date`/`time` non sono forniti si usa l'istante corrente.
- Risposta: la `Transaction` creata, con `source: "applepay"`.

**Cosa manca per la Fase 3**: il Comando Rapido vero e proprio (estrarre
importo/esercente dal testo della notifica Apple Pay e fare la POST), il
collegamento reale mostrato in Impostazioni (URL + API key copiabili, oggi
sono un placeholder disabilitato), e la vista di dettaglio del singolo
movimento (oggi c'è solo il modale di modifica).

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
