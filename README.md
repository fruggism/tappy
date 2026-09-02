# tappy

App per registrare live le spese fatte con le carte, con l'obiettivo finale di
ricevere automaticamente i pagamenti Apple Pay via un'automazione di Comandi
Rapidi su iPhone. Stile grafico minimale in linea ad Apple, con dettagli
fluorescenti.

> Il lavoro è diviso in tre fasi: **Fase 1** (UI indipendente dai dati reali)
> è completa; **Fase 2** (collegamento alle tabelle utente) ha il backend
> pronto ma non ancora collegato al client; **Fase 3** (Comando Rapido +
> vista di dettaglio) è da fare. Vedi "Stato del progetto" più sotto, e
> [`GUIDE.md`](./GUIDE.md) per una guida più estesa pensata per chi
> riprende il progetto da zero.

## Struttura

```
client/   — React + Vite + Tailwind (l'app vera e propria)
server/   — Express + SQLite (API REST, pronte ma non ancora collegate)
```

## Avvio in locale

```bash
cd server && npm install && npm run dev   # http://localhost:4000
cd client && npm install && npm run dev   # http://localhost:5173
```

Al primo avvio il server crea automaticamente un utente di default con le
categorie "Spesa", "Macchina", "Leisure", "Altro" e stampa in console la sua
API key. **Nota**: al momento il client non usa questo server (vedi sotto),
quindi per lavorare solo sulla UI basta avviare `client/`.

## Dati: mock vs backend reale

Il client non parla ancora con il server. Usa `src/lib/mockApi.ts`, dati
finti generati e salvati nel `localStorage` del browser, per poter
sviluppare e rifinire la grafica senza dipendere da nulla.

Lo switch è in `client/src/lib/api.ts`:

```ts
const USE_MOCK = true;
export const api = USE_MOCK ? mockApi : realApi;
```

`mockApi` e `realApi` (che chiama il server Express) hanno **la stessa
identica interfaccia**: per passare ai dati veri basta mettere `USE_MOCK` a
`false` (col server in esecuzione), senza toccare nessun componente.

## Modello dati

```ts
User { id, name, api_key, theme: "light"|"dark"|"system", monthly_budget, created_at }

Category {
  id, user_id, name, color, icon,
  is_default,             // le 4 categorie di base non si rinominano/eliminano
  sort_order,
  budget: number | null   // budget mensile dedicato, facoltativo
}

Card { id, user_id, name }

Transaction {
  id, user_id, date, time,
  amount,                 // importo totale della spesa
  my_share,                // quota effettivamente a proprio carico (spese divise)
  name,                    // esercente/descrizione
  card_id, category_id,
  source: "manual" | "applepay",
  is_income, note, created_at
}
```

**Spese divise**: nel form si sceglie tra "Parti uguali" (si indica in
quante persone e la quota si calcola da sola) o "Il mio importo" (si scrive
direttamente la propria quota).

**Budget**: oltre al budget mensile generale dell'utente, ogni categoria può
averne uno proprio, facoltativo. In tutte le viste un budget mensile viene
scalato al periodo selezionato con la stessa formula: giornaliero =
`budget / giorni_del_mese`, settimanale = `(budget / giorni_del_mese) * 7`.

## Le tre schermate

### Andamento
Selettore giornaliero/settimanale/mensile più una **macchina del tempo**:
l'icona a orologio apre un vero selettore di data, e le tab restano
ancorate al giorno scelto (es. si seleziona un giorno di agosto, si passa a
"Mensile" e si vede il totale di agosto, non del mese corrente). Contiene:

- gauge animato principale (anello segmentato per categoria, con punto
  luminoso che percorre l'arco del budget consumato);
- confronto col periodo precedente (mini-barre animate + percentuale, con
  le date dei due periodi messe a confronto);
- proiezione di fine periodo (anello di progresso), solo se il periodo
  selezionato è ancora in corso;
- griglia di anelli animati per categoria (sempre centrata, qualunque sia
  il numero di categorie), con "oltre budget" per chi supera il proprio
  limite dedicato;
- sparkline degli ultimi 14 giorni con tooltip al passaggio del mouse/tocco;
- riquadro "in evidenza" con categoria ed esercente che pesano di più nel
  periodo.

### Movimenti
Lista dei movimenti (da Apple Pay o manuali), filtrabile per categoria e
ordinabile per data/importo. Ogni riga ha un menu a tre puntini con
"Modifica" ed "Elimina". Il pulsante "Registra spesa" apre il modale per
inserire manualmente uscite o entrate.

### Impostazioni
Tema chiaro/scuro/sistema (persistito), budget mensile generale (con
equivalente settimanale/giornaliero calcolato in automatico), gestione
categorie (nome, colore, budget facoltativo), e una sezione "Apple Pay
Shortcut" — oggi un segnaposto etichettato "Fase 3" — che mostrerà URL del
webhook e API key una volta collegato il backend reale.

## Il webhook Apple Pay (già pronto lato server)

`POST /api/webhook/applepay` — pensato per un'automazione Comandi Rapidi
"Alla ricezione di una notifica" filtrata su Apple Pay.

- **Header** `x-api-key`: l'API key dell'utente (stampata in console al
  primo avvio del server).
- **Body JSON**:
  ```json
  { "amount": 12.5, "name": "Bar Roma", "card": "Visa", "category": "Leisure" }
  ```
  Solo `amount` e `name` sono obbligatori; `date`/`time`/`note` sono
  opzionali. Categorie e carte non esistenti vengono create automaticamente
  (case-insensitive); se la categoria non corrisponde a nulla la spesa
  finisce in "Altro".

## Stato del progetto

- ✅ **Fase 1 — UI indipendente dai dati reali**: fatta. Tutte e tre le
  schermate sono rifinite graficamente e testate con dati mock.
- ⏳ **Fase 2 — collegamento alle tabelle utente**: il server è pronto
  (schema, tutte le rotte, webhook incluso) ma il client punta ancora al
  mock. Basta girare `USE_MOCK` a `false` in `client/src/lib/api.ts`.
- ❌ **Fase 3 — Comando Rapido iPhone + vista di dettaglio**: da fare.
  Serve costruire il Comando Rapido vero e proprio (estrarre importo ed
  esercente dalla notifica Apple Pay e fare la POST), attivare la sezione
  "Apple Pay Shortcut" in Impostazioni (oggi disabilitata), e aggiungere
  una vista di dettaglio per il singolo movimento (oggi c'è solo il
  modale di modifica).

## Stile

Font di sistema Apple, nessuna libreria di charting esterna: i grafici
(`RadialGauge`, `MiniRing`, `Sparkline` in `Andamento.tsx`) sono tutti
SVG/CSS scritti a mano. Palette chiaro/scuro in `client/tailwind.config.js`
(`base`/`surface`/`surface2`/`ink`/`muted`), accenti `neon-green/cyan/pink/
violet/amber`: verde = ok/risparmio, rosa = sforamento/aumento, ciano =
"viaggio nel tempo" attivo.
