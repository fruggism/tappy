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

1. App **Comandi Rapidi** → scheda **Automazione** → **+**.
2. Scegli l'innesco legato ai pagamenti disponibile sul tuo iOS.
3. **«Esegui immediatamente»**, con la richiesta di conferma **disattivata**:
   altrimenti a ogni pagamento l'iPhone chiede il permesso, e l'automatismo
   non serve più a niente.
4. Azioni, nell'ordine:
   - **Ottieni posizione attuale** (solo se vuoi la mappa);
   - **Ottieni contenuti dall'URL**, impostata su `POST`, con gli header e il
     corpo JSON qui sopra. Latitudine e longitudine si prendono dal risultato
     dell'azione precedente.

## Per registrare le spese senza la posizione

Togli l'azione **Ottieni posizione attuale** e i due campi `lat`/`lon` dal
corpo. Tutto il resto funziona identico: le spese si registrano, e sulla
mappa semplicemente non compaiono. La posizione non è mai obbligatoria, in
nessun punto della catena.

Per togliere il luogo da una spesa già registrata: aprila in Movimenti e usa
**Rimuovi la posizione**.

## Due cose ancora da verificare sull'iPhone

Non sono dettagli: da queste dipende quanto lavoro resta.

1. **La posizione arriva anche quando l'automazione scatta da sola?**
   Lanciandola a mano dall'app funziona — è verificato. Ma il caso vero è a
   telefono bloccato in tasca, ed è lì che iOS può negare la localizzazione a
   un'automazione in background. Da provare con un pagamento vero.
2. **Importo, esercente e carta si riempiono da soli?** Dipende dall'innesco
   scelto. Se il trigger passa i dettagli della transazione, l'automazione è
   quasi finita. Se non li passa, vanno estratti dal testo della notifica —
   lavoro diverso e più fragile, da affrontare solo dopo aver visto cosa
   arriva davvero.

Un controllo utile: **Impostazioni → Privacy → Localizzazione → Comandi
Rapidi** deve avere **«Posizione esatta»** attiva. Con la posizione
approssimata le coordinate sono arrotondate a chilometri, e la heatmap
diventa una macchia sulla città.

## Se sposti l'app dentro l'hub Fru Pass

L'URL del webhook cambia (diventa `.../tappy/api/webhook/applepay`), quindi
va aggiornato nell'automazione. In Impostazioni compare sempre quello giusto
per il deploy in cui ti trovi: si copia da lì.
