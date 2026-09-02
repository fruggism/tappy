# tappy

Tappy è un piccolo servizio per registrare le proprie spese, pensato per essere
usato sia da un'app **Comandi Rapidi (Shortcuts)** su iPhone sia da una
semplice pagina web. Ogni utente ha un token personale e vede **solo le
proprie spese**: tutte le query nel backend filtrano sempre per `user_id`.

## Setup

1. Crea un database Postgres e imposta `DATABASE_URL` (copia `.env.example` in `.env`).
2. Installa le dipendenze e crea le tabelle:

   ```
   npm install
   npm run migrate
   ```

3. Crea un utente e ottieni il suo token (mostrato una sola volta):

   ```
   npm run create-user -- "Mario Rossi"
   ```

4. Avvia il server:

   ```
   npm start
   ```

La pagina web è disponibile su `/` (inserisci il token per vedere le tue spese).

## API

Tutte le rotte richiedono l'header `Authorization: Bearer <token>` (o, in
alternativa, `?token=...` come query string, comodo per URL da Comandi Rapidi).

- `POST /api/expenses` — body JSON `{ "amount": 12.5, "description": "Pranzo", "category": "cibo" }`
- `GET /api/expenses` — elenco delle proprie spese (più recenti prima)
- `GET /api/expenses/summary` — totale e numero di spese del mese corrente
- `DELETE /api/expenses/:id` — elimina una propria spesa

## Collegare Comandi Rapidi (Shortcuts)

Crea un nuovo Comando Rapido su iPhone con questi passi:

1. **Chiedi input** → "Quanto hai speso?" (numero) → salva in variabile `Importo`.
2. **Chiedi input** → "Per cosa?" (testo, opzionale) → variabile `Descrizione`.
3. Aggiungi l'azione **"Ottieni contenuto URL"** (Get Contents of URL):
   - URL: `https://<il-tuo-dominio>/api/expenses`
   - Metodo: `POST`
   - Intestazioni (Headers): `Authorization: Bearer <IL_TUO_TOKEN>`, `Content-Type: application/json`
   - Corpo (Body, tipo JSON):
     ```json
     { "amount": Importo, "description": Descrizione }
     ```
4. (Opzionale) Aggiungi **"Mostra notifica"** con il risultato per conferma.

Puoi anche aggiungere Comandi Rapidi in sola lettura, ad esempio uno che chiama
`GET /api/expenses/summary` e mostra il totale del mese come notifica.

Ogni persona che userà il comando deve avere il proprio token (creato con
`npm run create-user`): così ognuno registra e vede solo le proprie spese.
