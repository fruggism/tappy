# tappy

App per registrare live le spese fatte con le carte, con integrazione Apple Pay via Comandi Rapidi (Shortcuts) su iPhone.

## Struttura

- `server/` — API Express + SQLite (utenti, categorie, carte, movimenti, webhook Apple Pay)
- `client/` — App React + Vite + Tailwind (Andamento, Movimenti, Impostazioni)

## Avvio in locale

```bash
cd server && npm install && npm run dev   # http://localhost:4000
cd client && npm install && npm run dev   # http://localhost:5173
```

Al primo avvio il server crea automaticamente un utente di default con le categorie
"Spesa", "Macchina", "Leisure", "Altro" e stampa in console la sua API key.

## Integrazione Apple Pay (Comandi Rapidi)

1. Crea un'automazione "Alla ricezione di una notifica" filtrata su Apple Pay.
2. Nel comando rapido, estrai importo, nome esercente e (se disponibile) categoria/carta dal testo della notifica.
3. Invia una richiesta **POST** a `http://<host>:4000/api/webhook/applepay` con:
   - Header `x-api-key`: la chiave visibile nella sezione Impostazioni dell'app.
   - Corpo JSON: `{"amount": 12.5, "name": "Bar Roma", "card": "Visa", "category": "Leisure"}`

Categorie e carte non esistenti vengono create automaticamente; se la categoria non
corrisponde a nessuna esistente la spesa finisce in "Altro".

## Funzionalità principali

- **Andamento**: gauge animato (non un semplice grafico a ciambella) che mostra quanto
  budget è stato consumato nel periodo selezionato (giornaliero/mensile), con KPI di
  spesa media al giorno e barre per categoria.
- **Movimenti**: lista dei movimenti (da Apple Pay o manuali) con filtro per categoria e
  ordinamento per data/importo; supporto a entrate e spese divise con altre persone
  (quota di propria competenza).
- **Impostazioni**: tema chiaro/scuro/sistema (persistito), budget mensile (da cui si
  derivano l'equivalente settimanale e giornaliero), gestione categorie personalizzate,
  istruzioni e API key per lo Shortcut Apple Pay.

Stile minimale in linea con Apple, con dettagli fluorescenti per categorie e stati attivi.
