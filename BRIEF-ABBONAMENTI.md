# Briefing — sezione «Programmati» (abbonamenti e rateizzazioni)

Documento per l'agente che implementerà la nuova sezione. Scritto dopo una
sessione di analisi con Riccardo (proprietario del progetto): le decisioni
qui dentro sono **sue**, già prese, e non vanno rimesse in discussione senza
chiederglielo.

Leggi anche `COORDINATION.md` (mappa del progetto e regole di lavoro) e
`SETUP.md` (Airtable, Netlify, comandi). Questo documento non li ripete.

---

## 1. Cos'è tappy, in breve

Un registratore di spese personale, in italiano, pensato per il telefono. Il
suo tratto distintivo: le spese con carta arrivano **da sole**, mandate da
un'automazione di iPhone (Comandi Rapidi) che scatta al pagamento Apple Pay e
chiama un webhook. Il resto si inserisce a mano.

Fa parte dell'ecosistema **Fru Pass**: l'accesso avviene con un codice
`FRU-XXXX-XXXX` verificato da un endpoint condiviso, e quel codice è anche
l'identità dell'utente nel database (`UserId` in tutte le tabelle).

L'app è online su `https://tappyy.netlify.app`.

## 2. Com'è fatto

| Parte | Dove | Con cosa |
|---|---|---|
| Interfaccia | `client/src` | React 19, Vite, Tailwind, TypeScript |
| Backend | `netlify/functions/api.js` | Express 5 dentro una Netlify Function |
| Dati | `netlify/functions/lib/airtable.js` | Airtable (4 tabelle) |
| Accesso | `netlify/functions/lib/frupass.js` | endpoint condiviso dell'ecosistema |

Comandi, dalla radice:

```bash
npm test          # la suite: 10 file, ~96 controlli. Deve restare verde.
npm run dev       # client + funzione insieme, su localhost:8888
cd client && npm run build   # build (fa anche il typecheck)
npx oxlint client/src        # lint
```

## 3. Regole di lavoro — leggile prima di toccare qualsiasi cosa

**Branch**: si lavora e si committa su `main`. Non aprire branch nuovi se non
te lo chiede lui.

**Il push lo autorizza Riccardo, sempre.** Committa in locale, poi chiedi.
Vale anche per la documentazione e per le modifiche piccole. Non pushare
perché «tanto è innocuo»: è una regola esplicita, ripetuta più volte.

**Lingua**: tutto in italiano — interfaccia, commenti, messaggi di commit,
nomi di variabili nuove. Il progetto è coerente su questo.

**Commenti**: spiegano *perché*, non *cosa*. Il codice esistente ha commenti
che raccontano la decisione e il difetto che l'ha originata; scrivili nello
stesso registro. Non commentare l'ovvio.

**Test**: ogni difetto corretto e ogni comportamento non banale ha un test.
La regola che questo progetto applica sul serio: **dopo aver scritto un
test, rimetti il difetto e verifica che diventi rosso**. Un test che passa
per il motivo sbagliato è peggio di nessun test — è già successo qui, due
volte.

**Dipendenze**: non aggiungerne. L'unica eccezione concessa finora è stata
Leaflet, discussa prima. Il grafico dei 14 giorni, l'orologio e gli anelli
sono SVG scritti a mano: continua così.

**Verifica nel browser**: il progetto ha Playwright (`playwright-core`, con
Chromium in `/opt/pw-browsers/chromium`). Le cose visive si misurano, non si
deducono: qui si sono bruciati quattro tentativi correggendo «a occhio» un
difetto di impaginazione che si è risolto solo misurando i valori veri sul
dispositivo.

## 4. Il sistema grafico — la coerenza è un requisito, non un auspicio

Riccardo l'ha chiesto esplicitamente. Non inventare uno stile nuovo per la
sezione: riusa quello che c'è.

**Testo** (`client/tailwind.config.js`): `largeTitle` 34, `title2` 22,
`headline` 17, `body` 17, `callout` 15, `footnote` 13, `caption` 12.

**Colori**: le variabili CSS in `client/src/index.css`. Gli accenti hanno due
versioni, una per tema, e quelle chiare sono state ricalcolate per stare
sopra 4.5:1 di contrasto — `--acc-green: #008241`, `--acc-pink: #d6008f`,
`--acc-cyan: #007b94`, `--acc-violet: #5e5eeb`, `--acc-amber: #996600`. Non
introdurre colori nuovi. Si leggono con `accent()` (`client/src/lib/accent.ts`).

**Componenti da riusare**: `SegmentedControl` (le pillole Giorno/Mese/Anno),
`RadialGauge`, `AppChrome` (`Header`, `Dock`, `PieDiPagina`), le card
(`rounded-3xl bg-surface p-4`).

**Due regole ferree**, entrambe nate da difetti reali:
- ogni `input`, `select`, `textarea` sta a **16px** o più: sotto quella
  soglia iOS ingrandisce la pagina al fuoco. C'è `tests/campi-16px.test.mjs`
  che lo impedisce;
- **niente colori nuovi** per distinguere «previsto» da «avvenuto»: si usa lo
  stesso accento attenuato o tratteggiato, che è il linguaggio già parlato
  dal grafico dei 14 giorni (giorno corrente pieno, gli altri al 55%).

---

## 5. La sezione da costruire

### L'idea in una riga

Due mondi che **non si sommano**: le spese realmente avvenute (Movimenti) e
gli impegni futuri (questa sezione). Il secondo compare nel primo solo come
avviso, mai come totale.

### Decisioni già prese da Riccardo

1. **Va nella pulsantiera**, come quarta voce. Oggi ce ne sono tre
   (Andamento, Movimenti, Impostazioni): verifica che con quattro
   l'impaginazione regga a 390px e in tema scuro.
2. **Frequenze**: settimanale, mensile, ogni N mesi. Nient'altro.
3. **Rateizzazioni**: l'utente scrive importo della rata, data di inizio e
   data di fine. L'app gli ricorda **sempre quanto manca**.
4. **Abbonamenti senza scadenza**: nessuna data di fine obbligatoria, ma un
   campo facoltativo di **revisione** («ricordamelo fra un anno»). Non è una
   scadenza: è un appuntamento per decidere se tenerlo.
5. **Categorie**: le stesse delle spese, non un elenco separato.
6. **Prezzo che cambia**: lo storico va **congelato**. Se Netflix passa da
   12,99 a 14,99, i pagamenti passati restano a 12,99.
7. **Due totali distinti, mai sommati**: *Costo ricorrente* (gli abbonamenti,
   in €/mese e €/anno) e *Impegno residuo* (le rate che mancano, in € e in
   numero di rate). Sommarli non significherebbe niente.
8. **Nessun effetto automatico sulle altre sezioni**: questi importi non
   entrano nei totali di Andamento né in quelli di Movimenti.

### Il rilevamento dei conflitti

Riccardo paga Netflix online, quindi normalmente **non** arriva da Apple Pay.
Ma può capitare che un pagamento programmato arrivi anche come spesa vera.

Quando succede: **nessuna riconciliazione automatica**, nessuna fusione.
L'app segnala e basta — un simbolo di attenzione **sotto il movimento
sospetto**, in Movimenti, che dice «assomiglia a un pagamento programmato».
Toccandolo si vede quale.

Il criterio del sospetto va tenuto stretto e dichiarato nel codice (importo
uguale a meno di pochi centesimi **e** data entro pochi giorni dalla
ricorrenza **e** nome simile). In caso di dubbio **non** segnalare: un falso
allarme su ogni spesa è peggio di un conflitto non visto.

### Modello dati

Una tabella Airtable nuova, `Plans`. **Le singole occorrenze non si scrivono
mai**: si calcolano da data di inizio, frequenza e fine. Due motivi — il
piano gratuito di Airtable si ferma a 1.000 record per base (già stretto), e
una serie materializzata si disallinea appena si corregge una data.

Campi (segui le convenzioni di `airtable.js`, che mappa `Name`/`UserId`/…
verso `name`/`user_id`/…):

| Campo | Tipo | Note |
|---|---|---|
| `UserId` | testo | il codice Fru Pass, come nelle altre tabelle |
| `Name` | testo | «Netflix», «iPhone 15» |
| `Type` | testo | `subscription` o `installment` |
| `Amount` | numero | importo corrente della singola occorrenza |
| `PriceHistory` | testo lungo | JSON `[{"da":"2025-01-01","importo":12.99}]` — è ciò che congela lo storico |
| `CategoryId` | testo | id di una categoria dell'utente |
| `CardId` | testo | id di una carta dell'utente |
| `Frequency` | testo | `weekly`, `monthly`, `everyN` |
| `IntervalMonths` | numero | solo per `everyN` |
| `StartDate` | data | |
| `EndDate` | data | obbligatoria per le rate, vuota per gli abbonamenti |
| `ReviewDate` | data | il promemoria facoltativo degli abbonamenti |
| `Active` | checkbox | disdetto ≠ cancellato: lo storico resta |
| `Note` | testo | |
| `CreatedAt` | testo | ISO, come nelle altre tabelle |

Rotte da aggiungere in `netlify/functions/api.js`, con le stesse guardie
delle altre (`withUser`, controllo del proprietario, `404` e non `403` su id
altrui): `GET/POST /plans`, `PATCH/DELETE /plans/:id`.

**Attenzione**: `category_id` e `card_id` che arrivano dal client vanno
riportati all'utente che li manda, come già fa `idAltrui()` per le
transazioni. C'è un test che copre quel difetto per le spese
(`tests/multiutente.test.mjs`): estendilo ai piani.

### Le schermate

**Vista principale**, tre parti dall'alto:

1. **I due totali**, affiancati e visibilmente distinti: *Costo ricorrente* e
   *Impegno residuo*. Sono la risposta a due domande diverse e non devono
   sembrare due metà della stessa cosa.
2. **Il binario**: una riga per piano, il tempo da sinistra a destra, una
   barra che copre la durata e pallini nei punti di addebito. È la forma che
   risponde a «per quanto vanno avanti e come si accavallano»: si deve vedere
   che a marzo finiscono due rate e da lì si respira. Le rate hanno un capo
   netto; **gli abbonamenti sfumano verso destra**, e la sfumatura significa
   «continua».
3. **Le colonne del periodo**: una barra per mese (o anno, o più anni, con le
   stesse pillole `SegmentedControl` usate altrove), e sopra il conteggio —
   «7 pagamenti · €212». Il numero di occorrenze previste nel periodo scelto
   è una richiesta esplicita.

**Scheda del piano** (toccando una riga): i dati, quanto manca se è una rata,
e un **pulsante** che apre la lista dei movimenti ricostruiti — passati e
futuri nella stessa lista, separati da una linea «oggi». La lista non si vede
finché non si preme quel pulsante.

### Gli innesti nelle altre pagine

**Andamento**, sotto il grafico principale: **una riga sola**, non una card.
«Programmati questo mese: €212». Se diventa un riquadro sposta il baricentro
della schermata su una previsione invece che sulla realtà, ed è il contrario
di quello che serve.

**L'orologio** in Movimenti (`client/src/components/SpendingClock.tsx`, SVG a
mano, `viewBox 0 0 300 300`, barre che crescono verso il centro da `R_BAR`):
i giorni futuri del mese con un addebito previsto prendono una barra
**tratteggiata o attenuata**, alla stessa altezza proporzionale delle altre.
Serve un interruttore per escluderli, **e la scelta va ricordata** — se la
deve rifare a ogni apertura è un fastidio, non una funzione.

---

## 6. Il processo — questa parte è vincolante

**Prima il mockup, poi il codice.** Riccardo vuole vedere la grafica prima
che si scriva la parte pesante.

1. Costruisci un **mockup statico** con dati finti: una pagina che usa il CSS
   compilato dell'app (`cd client && npm run build`, poi il foglio in
   `client/dist/assets/index-*.css`), così i colori e i caratteri sono quelli
   veri e non una loro imitazione.
2. Rendine gli **screenshot con Playwright a 390×844**, in tema chiaro **e**
   scuro, e mandaglieli.
3. **Aspetta la sua approvazione.** Non passare all'implementazione prima.
4. Solo dopo: backend, poi interfaccia, poi gli innesti nelle altre pagine.
   Ogni pezzo con i suoi test.

## 7. Cosa non fare

- Non far entrare questi importi nei totali di Andamento e Movimenti. Il
  confine è: qui si dichiara **cosa succederà**, in Movimenti si registra
  **cosa è successo**. Ogni funzione che sfuma quel confine va lasciata
  perdere.
- Non materializzare le occorrenze come record.
- Non unire i due totali in uno.
- Non aggiungere dipendenze.
- Non pushare senza il suo ok.
- Non toccare l'automazione dell'iPhone né il webhook: funzionano, sono stati
  faticosi, e non c'entrano con questa sezione.

## 8. Il nome

«Programmati» è la parola che è emersa parlandone, ma non è decisa:
proponigliene due o tre nel mockup e falla scegliere a lui.
