# tappy

App per registrare live le spese fatte con le carte, con l'obiettivo finale di
ricevere automaticamente i pagamenti Apple Pay via un'automazione di Comandi
Rapidi su iPhone. Stile grafico minimale in linea ad Apple, con dettagli
fluorescenti. I dati sono sincronizzati automaticamente su tutti i
dispositivi da cui accedi con lo stesso codice Fru Pass.

tappy fa parte dell'ecosistema **Fru Pass**: ogni utente è identificato dal
suo codice `FRU-XXXX-XXXX` (non da un account con password), lo stesso che
usa in tutte le altre app dell'hub. Il codice viene verificato dall'endpoint
condiviso dell'ecosistema — noi non lo validiamo e non abbiamo le credenziali
per farlo — e una volta verificato è ciò che lega l'utente alle sue
categorie, carte e transazioni nella **nostra** base Airtable.

## Architettura

```
client/               — React + Vite + Tailwind (l'app vera e propria)
netlify/functions/    — API REST come Netlify Function (Express + Airtable)
```

Tutto vive su **Netlify**: il client (sito statico) e il backend (una
funzione serverless) sono nello stesso deploy. I dati sono su **Airtable**
(vedi [`GUIDE.md`](./GUIDE.md) per lo schema completo delle tabelle).

## Come funziona l'accesso

1. L'utente inserisce il codice `FRU-XXXX-XXXX` (oppure arriva dall'hub, che
   apre l'app come `https://…/#code=FRU-XXXX-XXXX`: in quel caso entra
   diretto, senza vedere la schermata di login).
2. Il client chiama `POST /api/auth/login`; la nostra funzione gira il codice
   all'endpoint condiviso Fru Pass e, solo se torna un profilo valido, crea o
   recupera l'utente su Airtable.
3. Il profilo viene salvato in `localStorage` con chiave `tappy_frupass`, e
   riusato ai successivi avvii. Al riavvio parte in background un
   `POST /api/auth/refresh` che se ne accorge se il codice è stato revocato;
   se invece è l'ecosistema a non rispondere, la sessione resta valida.
4. Le rotte dati viaggiano con l'header `x-frupas-code`. Mai in query string:
   metterebbe la credenziale dell'ecosistema negli URL e nei log.

## Setup rapido

1. **Crea una base Airtable** con le 4 tabelle descritte in `GUIDE.md`
   (`Users`, `Categories`, `Cards`, `Transactions`).
2. **Crea un Personal Access Token** su Airtable (scope `data.records:read`
   e `data.records:write` sulla base creata) — sarà `AIRTABLE_API_KEY`.
   L'ID della base (`appXXXXXXXXXXXXXX`, si trova nell'URL della base o in
   [airtable.com/api](https://airtable.com/api)) sarà `AIRTABLE_BASE_ID`.
3. **Non serve creare utenti a mano.** Al primo accesso con un codice Fru
   Pass valido, tappy crea da sé l'utente su Airtable con le 4 categorie di
   default. Il codice te lo dà l'amministratore dell'ecosistema.
4. **In locale** (`npm run dev` usa la [Netlify CLI](https://docs.netlify.com/cli/get-started/) via `npx`, senza installarla):
   ```bash
   cd client && npm install && cd ..
   npm run dev
   ```
   Apri l'URL stampato (di solito `http://localhost:8888`) e inserisci il
   tuo codice Fru Pass.
5. **In produzione**: collega il repo GitHub a un nuovo sito Netlify (build
   già configurata in `netlify.toml`), imposta `AIRTABLE_API_KEY` e
   `AIRTABLE_BASE_ID` nelle variabili d'ambiente del sito, fai il deploy.
   Apri il dominio Netlify da ogni dispositivo e inserisci lo stesso codice.

## Modello dati

```ts
User { id, code /* codice frupas */, name, theme: "light"|"dark"|"system", monthly_budget, created_at }

Category {
  id, user_id /* = codice frupas del proprietario */, name, color, icon,
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
categorie (nome, colore, budget facoltativo), URL del webhook Apple Pay e
chiave del webhook copiabili, e un pulsante per disconnettersi.

## Il webhook Apple Pay

`POST /api/webhook/applepay` — pensato per un'**automazione** di iPhone
(app Comandi Rapidi → scheda *Automazione*), che scatta da sé alla notifica
di pagamento Apple Pay. Non è un comando rapido da lanciare a mano: l'utente
non fa nulla, la spesa arriva mentre paga.

- **Header** `x-api-key`: la **chiave del webhook**, visibile in
  Impostazioni. È un segreto interno di tappy, generato al primo accesso.
  Non si usa qui il codice Fru Pass: quello è la credenziale dell'intero
  ecosistema e non va copiata dentro un'automazione.
- **Body JSON**:
  ```json
  { "amount": 12.5, "name": "Bar Roma", "card": "Visa", "category": "Leisure" }
  ```
  Solo `amount` e `name` sono obbligatori; `date`/`time`/`note` sono
  opzionali. Categorie e carte non esistenti vengono create automaticamente
  (case-insensitive); se la categoria non corrisponde a nulla la spesa
  finisce in "Altro".

## Stile

Font di sistema Apple, nessuna libreria di charting esterna: i grafici
(`RadialGauge`, `MiniRing`, `Sparkline` in `Andamento.tsx`) sono tutti
SVG/CSS scritti a mano. Palette chiaro/scuro in `client/tailwind.config.js`
(`base`/`surface`/`surface2`/`ink`/`muted`), accenti `neon-green/cyan/pink/
violet/amber`: verde = ok/risparmio, rosa = sforamento/aumento, ciano =
"viaggio nel tempo" attivo.
