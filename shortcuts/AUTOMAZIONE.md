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

L'ordine non è estetico: **l'invio della spesa viene per primo**, e tutto
ciò che può inciampare sta dopo. Due azioni possono interrompere
l'automazione:

- «Ottieni la posizione attuale», se iOS nega la localizzazione a
  un'automazione in background;
- «Scegli da Elenco», che a telefono bloccato mette l'automazione in pausa
  in attesa di una risposta e **scade** se la notifica non viene toccata
  subito. Al primo pagamento vero è successo esattamente questo: notifica
  ignorata per qualche minuto, automazione morta lì, nessuna spesa
  registrata e nemmeno la nota di collaudo scritta.

Finché stanno prima dell'invio, un loro inciampo fa perdere la spesa. Messe
dopo, si perde solo il dettaglio che stavano portando.

1. **Elenco** — `Leisure`, `Spesa`, `Macchina`, `Altro`. Sono le stesse
   categorie che tappy ha già, quindi combaciano da sole.
2. **Scegli da Elenco** → produce *Elemento selezionato*.
1. **Ottieni contenuti dall'URL** — è l'azione che registra la spesa:

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

2. **Ottieni valore dal dizionario** — `id` da *Contenuti URL*: è l'id della
   spesa appena creata, e serve a tutte le chiamate successive.
3. **Ottieni la posizione attuale** (Precisione: *Ottimale*).
4. **Ottieni Latitudine da Posizione attuale**.
5. **Ottieni Longitudine da Posizione attuale**.
6. **Ottieni contenuti dall'URL**, il secondo — stesso metodo e stesse
   intestazioni, indirizzo `.../api/webhook/applepay/completa`, corpo:

     | Campo | Tipo | Variabile |
     |---|---|---|
     | `id` | Testo | **Valore del dizionario** |
     | `lat` | Numero | **Latitudine** |
     | `lon` | Numero | **Longitudine** |

7. **Elenco** — i nomi delle categorie, uno per riga.
8. **Scegli da Elenco** → produce *Elemento selezionato*.
9. **Ottieni contenuti dall'URL**, il terzo — stesso indirizzo del secondo,
   corpo:

     | Campo | Tipo | Variabile |
     |---|---|---|
     | `id` | Testo | **Valore del dizionario** |
     | `category` | Testo | **Elemento selezionato** |

   I punti 3-6 (posizione) e 7-9 (categoria) sono blocchi indipendenti e
   facoltativi: si può tenerne uno, entrambi o nessuno. Senza, l'automazione
   finisce al punto 2 ed è una sola chiamata che non può fermarsi.

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

## 5. La categoria, e perché sta in fondo

Scegliere la categoria al momento del pagamento costa un tocco e fa nascere
la spesa già categorizzata. Ma è l'unica azione dell'automazione che
**aspetta una risposta**, e un'automazione «Esegui immediatamente» gira anche
a telefono in tasca: iOS manda una notifica, mette in pausa, e se nessuno
risponde entro poco l'esecuzione scade.

Finché la domanda stava prima dell'invio, questo faceva perdere la spesa
intera. Ora sta dopo: se non rispondi la spesa resta in *Altro* e la
sistemi in tappy con un tocco nella vista di dettaglio.

Chi non vuole essere interrotto affatto toglie i punti 7-9 e categorizza
sempre dall'app. Un'alternativa senza interazione è dedurre la categoria
dall'esercente con azioni **Se** (`Esercente contiene "Eni"` → `Macchina`),
da mantenere a mano man mano che compaiono negozi nuovi.

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

E le chiamate che completano la spesa:

`POST` a `.../api/webhook/applepay/completa`, stesse intestazioni, corpo:

```json
{ "id": "recXXXXXXXX", "lat": 44.788466, "lon": 10.260754, "category": "Spesa" }
```

`id` è quello che la prima risposta ha restituito; tutto il resto è
facoltativo, e si può chiamare più volte per la stessa spesa (una per la
posizione, una per la categoria). Risponde **200** con la spesa aggiornata;
**200** senza modifiche se non c'è niente di utile da scrivere — non è un
errore: il telefono non aveva la posizione, o nessuno ha risposto alla
domanda; **404** se la spesa non è di chi manda la chiave.

`.../applepay/posizione` è il vecchio nome della stessa rotta e continua a
funzionare.

## Se l'app si sposta dentro l'hub Fru Pass

L'URL del webhook cambia (diventa `.../tappy/api/webhook/applepay`) e va
aggiornato nell'automazione. In Impostazioni compare sempre quello giusto per
il deploy in cui ti trovi: si copia da lì.
