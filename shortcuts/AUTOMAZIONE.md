# L'automazione Apple Pay

Come collegare l'iPhone a tappy: al pagamento, l'**automazione** manda la
spesa (e, se vuoi, la posizione) al webhook. Non è un comando rapido da
lanciare a mano — scatta da sé, e tu non tocchi niente.

Serve l'app **deployata**: l'automazione chiama un URL pubblico, e
`localhost` dal telefono non esiste.

## Cosa serve, e dove si trova

In **Impostazioni → Automazione Apple Pay**, dentro l'app, ci sono i due
valori da copiare:

- **URL webhook** — es. `https://tappy.netlify.app/api/webhook/applepay`
- **Chiave del webhook** — un segreto interno di tappy

⚠️ Nell'automazione va la **chiave del webhook**, mai il codice Fru Pass.
Il codice apre tutte le app dell'ecosistema, e un'automazione si può
esportare e condividere con un link.

## La richiesta

`POST` all'URL, con questi header:

```
Content-Type: application/json
x-api-key: <la chiave del webhook>
```

e questo corpo JSON:

```json
{
  "amount": 12.5,
  "name": "Bar Roma",
  "card": "Visa",
  "category": "Leisure",
  "date": "2026-09-03",
  "time": "07:57",
  "note": "",
  "lat": 44.788466,
  "lon": 10.260754
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `amount` | **sì** | importo della spesa, numero (non "12,50 €") |
| `name` | **sì** | esercente |
| `card` | no | se non esiste viene creata |
| `category` | no | se non corrisponde a nulla, la spesa finisce in "Altro" |
| `date` / `time` | no | se mancano si usa l'istante della chiamata |
| `note` | no | |
| `lat` / `lon` | no | dove è avvenuta la spesa; senza, il movimento c'è lo stesso e non compare sulla mappa |

Risposta attesa: **201** con la spesa creata. **401** significa chiave
sbagliata; **400**, che mancano `amount` o `name`.

## Come si costruisce, passo per passo

### Prima: i due valori

Apri tappy → **Impostazioni → Automazione Apple Pay** e copia **URL webhook**
e **chiave del webhook**. Entrambi hanno il pulsante Copia.

### Poi: l'automazione

1. App **Comandi Rapidi** → scheda **Automazione** → **+**.
2. Scegli l'innesco legato ai pagamenti disponibile sul tuo iOS.
3. **«Esegui immediatamente»**, con la richiesta di conferma **disattivata**:
   altrimenti a ogni pagamento l'iPhone chiede il permesso, e l'automatismo
   non serve più a niente.
4. Azioni, nell'ordine:

   **a. Ottieni posizione attuale** — solo se vuoi la mappa.

   **b. Ottieni contenuti dall'URL** — è l'azione che fa tutto. Toccala per
   espanderla e imposta:

   - **URL**: quello copiato da Impostazioni;
   - **Metodo**: `POST`;
   - **Intestazioni**: due righe —
     `Content-Type` → `application/json`
     `x-api-key` → la chiave copiata da Impostazioni;
   - **Corpo richiesta**: `JSON`, e aggiungi i campi:

     | Campo | Tipo | Valore |
     |---|---|---|
     | `amount` | Numero | l'importo della transazione |
     | `name` | Testo | l'esercente |
     | `card` | Testo | la carta (facoltativo) |
     | `category` | Testo | es. `Macchina` (facoltativo) |
     | `lat` | Numero | *Latitudine* dalla posizione ottenuta al passo a |
     | `lon` | Numero | *Longitudine* dalla posizione ottenuta al passo a |

   Per inserire un valore che viene da un'azione precedente, tocca il campo e
   scegli la variabile dal suggerimento sopra la tastiera.

### Tre dettagli che fanno fallire l'invio

1. **`amount` deve essere un numero**, non `12,50 €`. Se la variabile arriva
   come testo con simbolo e virgola, mettici prima un'azione **Sostituisci
   testo** che tolga tutto ciò che non è cifra o separatore, e una seconda che
   trasformi la virgola in punto. Il server rifiuta con `400` un importo che
   non riesce a leggere.
2. **Non mandare `date` e `time`** se non sei costretto: se mancano, il server
   usa l'istante della chiamata, che è quello giusto. Un formato sbagliato è
   un modo di sbagliare in più, e non serve a niente.
3. **`lat` e `lon` vanno come numeri**, non come testo né come "posizione".
   Nel selettore delle variabili scegli le proprietà *Latitudine* e
   *Longitudine* della posizione, non la posizione intera.

### Come vedere se ha funzionato

Mentre la costruisci, aggiungi in fondo un'azione **Mostra notifica** con il
*Contenuto dell'URL* (il risultato dell'azione b). Ti fa vedere la risposta:

- la spesa appena creata, con i suoi campi → **ha funzionato**;
- `{"error":"invalid api key"}` → la chiave è sbagliata o incollata male;
- `{"error":"amount and name required"}` → uno dei due campi obbligatori
  arriva vuoto: è quasi sempre il punto 1 qui sopra, o un innesco che non
  passa i dettagli della transazione;
- niente / errore di rete → l'URL è sbagliato, o l'app non è online.

Quando funziona, togli la notifica: l'automazione deve essere silenziosa.

Poi apri tappy → **Movimenti**: la spesa deve esserci, con l'origine
"Apple Pay". Se hai mandato la posizione, aprila e controlla che ci sia — e
nella mappa comparirà nel periodo giusto.

## Per registrare le spese senza la posizione

Togli l'azione **Ottieni posizione attuale** e i due campi `lat`/`lon` dal
corpo. Tutto il resto funziona identico: le spese si registrano, e sulla
mappa semplicemente non compaiono. La posizione non è mai obbligatoria, in
nessun punto della catena.

Per togliere il luogo da una spesa già registrata: aprila in Movimenti e usa
**Rimuovi la posizione**.

## L'innesco giusto

Quello dei pagamenti con carta, che comincia con **«Ricevi transazione come
input»**: passa da sé *Importo*, *Esercente* e *Carta o biglietto* come
variabili. Non serve estrarre niente dal testo della notifica — verificato
sull'iPhone.

## Azioni che in background non si possono usare

Un'automazione impostata su «Esegui immediatamente» gira **senza nessuno
davanti allo schermo**. Quindi ogni azione che chiede qualcosa all'utente la
blocca: in particolare **«Scegli da elenco»**, comodo per scegliere la
categoria al momento, non può stare qui.

La categoria si sistema in un altro modo: non mandarla affatto — il server
mette "Altro" — e cambiarla dopo in tappy, che costa un tocco. Oppure
dedurla dall'esercente con delle azioni **Se** (`Esercente contiene "Eni"` →
`Macchina`), che restano automatiche.

## Una verifica ancora aperta

**La posizione arriva anche quando l'automazione scatta da sola?** Lanciandola
a mano funziona — è verificato. Ma il caso vero è a telefono bloccato in
tasca, ed è lì che iOS può negare la localizzazione a un'automazione in
background. Si scopre col primo pagamento vero: se `lat`/`lon` arrivano
vuoti, la spesa si registra lo stesso e semplicemente non compare sulla
mappa.

Un controllo utile: **Impostazioni → Privacy → Localizzazione → Comandi
Rapidi** deve avere **«Posizione esatta»** attiva. Con la posizione
approssimata le coordinate sono arrotondate a chilometri, e la heatmap
diventa una macchia sulla città.

## Se sposti l'app dentro l'hub Fru Pass

L'URL del webhook cambia (diventa `.../tappy/api/webhook/applepay`), quindi
va aggiornato nell'automazione. In Impostazioni compare sempre quello giusto
per il deploy in cui ti trovi: si copia da lì.
