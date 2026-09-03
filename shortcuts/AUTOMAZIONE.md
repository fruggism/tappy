# L'automazione Apple Pay

Al pagamento, un'**automazione** dell'iPhone manda a tappy importo,
esercente, carta, categoria e posizione. Non è un comando rapido da lanciare
a mano: scatta da sé, e l'unica cosa che fai è scegliere la categoria con un
tocco (vedi §5).

Serve l'app **online**: l'automazione chiama un URL pubblico, e `localhost`
dal telefono non esiste.

---

## 1. I due valori da copiare

Apri tappy → **Impostazioni → Automazione Apple Pay**. Ci sono, entrambi col
pulsante Copia:

- **URL webhook** — es. `https://tappy.netlify.app/api/webhook/applepay`
- **Chiave del webhook** — un segreto interno di tappy

⚠️ Nell'automazione va la **chiave del webhook**, mai il codice Fru Pass: il
codice apre tutte le app dell'ecosistema, e un'automazione si può esportare e
condividere con un link.

## 2. L'innesco

Quello dei pagamenti con carta, che comincia con **«Ricevi transazione come
input»**. Passa da sé *Importo*, *Esercente* e *Carta o biglietto* come
variabili: non serve estrarre niente dal testo della notifica — verificato
sull'iPhone.

Impostalo su **«Esegui immediatamente»**, con la richiesta di conferma
**disattivata**: altrimenti a ogni pagamento l'iPhone chiede il permesso, e
l'automatismo non serve più a niente.

## 3. Le azioni, nell'ordine

L'ordine non è estetico: **l'invio della spesa viene prima della
posizione**. Su iPhone «Ottieni la posizione attuale» può fallire (iOS che
nega la localizzazione a un'automazione in background) e quando fallisce
l'automazione si interrompe lì. Con la posizione prima dell'invio, un GPS
negato fa perdere la spesa; con la posizione dopo, il peggio che può
succedere è una spesa senza luogo. Vedi §6.

1. **Elenco** — `Leisure`, `Spesa`, `Macchina`, `Altro`. Sono le stesse
   categorie che tappy ha già, quindi combaciano da sole.
2. **Scegli da Elenco** → produce *Elemento selezionato*.
3. **Ottieni contenuti dall'URL** — è l'azione che registra la spesa:

   - **URL**: quello copiato da Impostazioni
   - **Metodo**: `POST`
   - **Intestazioni**: due righe —
     `Content-Type` → `application/json`
     `x-api-key` → la chiave copiata da Impostazioni
   - **Corpo richiesta**: `JSON`, con questi campi:

     | Campo | Tipo | Variabile |
     |---|---|---|
     | `amount` | Numero | **Importo** |
     | `name` | Testo | **Esercente** |
     | `card` | Testo | **Carta o biglietto** |
     | `category` | Testo | **Elemento selezionato** |

4. **Ottieni valore da dizionario** — `id` da *Contenuti URL*: è l'id della
   spesa appena creata, e serve alla seconda chiamata.
5. **Ottieni la posizione attuale** (Precisione: *Ottimale*).
6. **Ottieni Latitudine da Posizione attuale**.
7. **Ottieni Longitudine da Posizione attuale**.
8. **Ottieni contenuti dall'URL**, il secondo — stesso metodo e stesse
   intestazioni, indirizzo `.../api/webhook/applepay/posizione`, corpo:

     | Campo | Tipo | Variabile |
     |---|---|---|
     | `id` | Testo | **Valore del dizionario** |
     | `lat` | Numero | **Latitudine** |
     | `lon` | Numero | **Longitudine** |

   Le azioni 4-8 sono tutte facoltative: senza, l'automazione finisce alla 3
   e le spese si registrano senza luogo.

Per inserire una variabile, tocca il campo e scegli dal suggerimento sopra la
tastiera.

**Non mandare `date` e `time`**: se mancano, il server usa l'istante della
chiamata, che è quello giusto. Un formato sbagliato sarebbe solo un modo in
più di sbagliare.

## 4. Collaudo

Mentre la costruisci, tieni due cose in fondo e toglile quando funziona:

- il blocco **Testo** + **Aggiungi a nota**, che ti mostra cosa è arrivato
  davvero dall'innesco — utile se tappy non riceve nulla e vuoi sapere se il
  problema è a monte. **Non è necessario**: la spesa si registra lo stesso. Se
  lo tieni, la nota di destinazione (es. «Spese Apple Pay») **va creata prima
  nell'app Note**: se non esiste, l'azione non trova dove scrivere e
  l'automazione si ferma lì, prima dell'invio. È l'unico motivo per cui serve
  anche l'azione **Formatta data**, che riempie il testo della nota e non ha
  niente a che vedere col movimento;
- un'azione **Mostra notifica** con il *Contenuto dell'URL*, che ti mostra la
  risposta del server.

Le risposte e cosa significano:

| Cosa leggi | Cosa fare |
|---|---|
| la spesa creata, coi suoi campi | ha funzionato |
| `{"error":"invalid api key"}` | la chiave è sbagliata o incollata male |
| `{"error":"amount and name required"}` | l'importo o l'esercente arrivano vuoti — quasi sempre l'importo, vedi sotto |
| niente, o errore di rete | URL sbagliato, o app non raggiungibile |

**Se l'importo arriva come testo** (`12,50 €`) il server lo rifiuta: metti
prima dell'invio due azioni **Sostituisci testo**, una che tolga tutto ciò che
non è cifra o separatore, l'altra che trasformi la virgola in punto.

**Eseguendola a mano importo ed esercente arrivano vuoti**: non c'è nessuna
transazione da cui prenderli, e il server rifiuta con `400`. Per provare
l'impianto senza aspettare un pagamento, scrivi per un attimo valori fissi
(`1` in `amount`, `Prova` in `name`) al posto delle variabili, esegui, e poi
rimetti le variabili. La prova vera resta un pagamento da un euro. Poi apri tappy
→ **Movimenti**: la spesa deve esserci, con origine "Apple Pay". Se hai
mandato la posizione, aprila e controllala — comparirà anche sulla mappa, nel
periodo giusto.

## 5. La categoria: un tocco, e il suo compromesso

Scegliere la categoria al momento del pagamento è una scelta deliberata: un
tocco in più, ma la spesa nasce già categorizzata.

Il compromesso: un'automazione «Esegui immediatamente» gira anche a telefono
in tasca, e un'azione che chiede qualcosa **sospende tutto finché non si
risponde**. Se la richiesta passa inosservata, non si perde solo la categoria
— **non parte nemmeno l'invio**, e la spesa non viene registrata.

Se dovesse capitare troppo spesso, due alternative: dedurre la categoria
dall'esercente con azioni **Se** (`Esercente contiene "Eni"` → `Macchina`),
oppure mandare la spesa senza categoria e sistemarla dopo in tappy, che costa
un tocco nella vista di dettaglio.

## 6. La posizione

È sempre facoltativa. Per farne a meno, togli le azioni 3-5 e i campi
`lat`/`lon`: le spese si registrano identiche e semplicemente non compaiono
sulla mappa. Per togliere il luogo da una spesa già registrata, aprila in
Movimenti e usa **Rimuovi la posizione**.

**Se la posizione non arriva, la spesa si perde?** Dipende da *dove* si
ferma, e i due casi vanno tenuti distinti.

- **Coordinate vuote che arrivano al server**: nessun problema. Il webhook
  tratta `""`, `null` e il campo assente allo stesso modo — la spesa si
  registra senza luogo e semplicemente non compare sulla mappa. (Fino al
  2026-09-03 `Number("")` faceva `0` e la spesa finiva a 0°,0°, in mezzo al
  golfo di Guinea: corretto, con prova in `tests/multiutente.test.mjs`.)
- **L'azione della posizione che fallisce sul telefono**: l'automazione si
  interrompe davvero lì. Ma da quando l'invio è in due tempi (§3) quel punto
  viene *dopo* che la spesa è già registrata: si perde il luogo, non la
  spesa. È l'unico motivo per cui l'ordine delle azioni è quello.

**Una verifica ancora aperta** è proprio questa: a telefono bloccato in
tasca, iOS concede la posizione a un'automazione in background? Lanciandola a
mano funziona — verificato. Si scopre col primo pagamento vero. Se la spesa
non compare in tappy, la causa più probabile è questa: togli le tre azioni
della posizione e i campi `lat`/`lon`, e l'automazione torna a essere una
sola chiamata che non può fallire per il GPS.

Controlla anche che **Impostazioni → Privacy → Localizzazione → Comandi
Rapidi** abbia **«Posizione esatta»** attiva: con la posizione approssimata le
coordinate sono arrotondate a chilometri, e la heatmap diventa una macchia
sulla città.

---

## Il contratto della richiesta

Per riferimento, se un giorno servisse ricostruirla da zero o chiamarla da
altro.

`POST` all'URL del webhook, header `Content-Type: application/json` e
`x-api-key: <chiave>`, corpo:

```json
{
  "amount": 12.5,
  "name": "Bar Roma",
  "card": "Visa",
  "category": "Leisure",
  "lat": 44.788466,
  "lon": 10.260754
}
```

| Campo | Obbligatorio | Note |
|---|---|---|
| `amount` | **sì** | numero, non `"12,50 €"` |
| `name` | **sì** | esercente |
| `card` | no | se non esiste viene creata |
| `category` | no | se non corrisponde a nulla, la spesa finisce in "Altro" |
| `date` / `time` | no | se mancano si usa l'istante della chiamata |
| `note` | no | |
| `lat` / `lon` | no | senza, il movimento c'è lo stesso e non compare sulla mappa |

Risposta attesa: **201** con la spesa creata. **401** = chiave sbagliata,
**400** = mancano `amount` o `name`.

E la seconda chiamata, quella della posizione:

`POST` a `.../api/webhook/applepay/posizione`, stesse intestazioni, corpo:

```json
{ "id": "recXXXXXXXX", "lat": 44.788466, "lon": 10.260754 }
```

`id` è quello che la prima risposta ha restituito. Risponde **200** con la
spesa aggiornata; **200** senza modifiche se `lat`/`lon` arrivano vuoti (non
è un errore: il telefono non aveva la posizione); **404** se la spesa non è
di chi manda la chiave.

## Se l'app si sposta dentro l'hub Fru Pass

L'URL del webhook cambia (diventa `.../tappy/api/webhook/applepay`) e va
aggiornato nell'automazione. In Impostazioni compare sempre quello giusto per
il deploy in cui ti trovi: si copia da lì.
