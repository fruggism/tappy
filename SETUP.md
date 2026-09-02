# tappy — guida operativa: Airtable, Netlify, comandi

Guida passo passo per mettere in piedi tappy con dati veri. Ogni comando è
copiabile così com'è. Tempo realistico: 30-40 minuti, quasi tutti su Airtable.

Per la consegna all'hub Fru Pass, vedi [`RELEASE-HUB.md`](./RELEASE-HUB.md).

---

## Prima, una cosa importante sulla base Airtable

Hai detto che ti collegherai *"alla tabella che già si collega al Netlify del
Fru Pass"*. **Non farlo, e non è una formalità.**

La guida dell'ecosistema è esplicita su questo punto: l'endpoint Fru Pass
serve **solo per l'identità**; per i dati della tua app devi usare *"un tuo
backend/storage separato… Non condividere le tue credenziali/chiavi con
l'ecosistema Fru Pass e viceversa"*.

Il motivo pratico: un token Airtable ha accesso a **tutta la base** su cui è
abilitato. Se metti le tabelle di tappy nella base dell'hub, il token che
finisce nelle variabili d'ambiente di tappy può leggere e scrivere anche i
profili, i permessi e i messaggi dell'ecosistema — e viceversa. Un errore in
tappy diventa un problema dell'hub e di tutte le altre app.

**Quello che devi fare invece**: stesso *account* Airtable (comodo, un solo
login), **base nuova e separata** per tappy, con un token dedicato abilitato
solo su quella. Il collegamento con Fru Pass resta comunque completo: passa
dal codice `FRU-XXXX-XXXX`, che è la chiave con cui le righe di tappy sono
associate all'utente. Non serve nessuna tabella condivisa.

Se l'amministratore dell'ecosistema ti chiede espressamente di stare nella
stessa base, dimmelo prima di procedere: si può fare, ma cambia il modello di
sicurezza e va deciso consapevolmente.

---

## 1. Crea la base Airtable

1. Vai su [airtable.com](https://airtable.com), **Create → Start from
   scratch**. Chiama la base **`tappy`**.
2. Crea **4 tabelle** con questi nomi esatti: `Users`, `Categories`, `Cards`,
   `Transactions`. (Airtable te ne crea una di default chiamata "Table 1":
   rinominala in `Users`.)
3. In ogni tabella crea i campi qui sotto, con **nome e tipo esatti** — il
   backend li cerca così come sono scritti, maiuscole comprese.

⚠️ Airtable crea da sé dei campi di esempio (`Notes`, `Assignee`, `Status`) e
tre righe vuote. **Cancella i campi di esempio e le righe**: le righe vuote
non danno errore, ma sporcano.

### `Users`
| Campo | Tipo |
|---|---|
| `Name` | Single line text |
| `FrupasCode` | Single line text |
| `ApiKey` | Single line text |
| `Theme` | Single line text |
| `MonthlyBudget` | Number |
| `CreatedAt` | Single line text |

### `Categories`
| Campo | Tipo |
|---|---|
| `UserId` | Single line text |
| `Name` | Single line text |
| `Color` | Single line text |
| `Icon` | Single line text |
| `IsDefault` | Checkbox |
| `SortOrder` | Number |
| `Budget` | Number |

### `Cards`
| Campo | Tipo |
|---|---|
| `UserId` | Single line text |
| `Name` | Single line text |

### `Transactions`
| Campo | Tipo |
|---|---|
| `UserId` | Single line text |
| `Date` | Single line text |
| `Time` | Single line text |
| `Amount` | Number |
| `MyShare` | Number |
| `Name` | Single line text |
| `CardId` | Single line text |
| `CategoryId` | Single line text |
| `Source` | Single line text |
| `IsIncome` | Checkbox |
| `Note` | Single line text |
| `CreatedAt` | Single line text |

**Sui campi `Number`**: Airtable chiede la precisione. Metti **2 decimali**
per `MonthlyBudget`, `Amount`, `MyShare` e `Budget`; **intero** per
`SortOrder`. Con 0 decimali gli importi verrebbero arrotondati in silenzio.

**Non creare utenti a mano.** Al primo accesso con un codice Fru Pass valido,
tappy crea da sé la riga in `Users`, le 4 categorie di default e una carta
"Carta principale".

## 2. Prendi le due credenziali

**`AIRTABLE_BASE_ID`** — apri la base e guarda l'URL:
`https://airtable.com/appXXXXXXXXXXXXXX/tbl…` → la parte che inizia per
`app` è il base id.

**`AIRTABLE_API_KEY`** — è un Personal Access Token:

1. [airtable.com/create/tokens](https://airtable.com/create/tokens) →
   **Create new token**.
2. Nome: `tappy`.
3. **Scopes**: `data.records:read` e `data.records:write`. Nient'altro — in
   particolare **non** `schema.bases:write`.
4. **Access**: seleziona **solo la base `tappy`**. È il punto che tiene
   separati i due mondi: questo token non deve poter vedere la base dell'hub.
5. Copia il token (`pat…`): **te lo mostra una volta sola**.

## 3. Controlla che la base sia giusta

Prima di collegare qualsiasi cosa, verifica che nomi di tabelle e campi
corrispondano a quelli che tappy cerca. Un campo scritto anche solo con una
maiuscola diversa non dà un errore leggibile a runtime: dà una pagina che
non carica.

```bash
npm install
AIRTABLE_API_KEY=pat... AIRTABLE_BASE_ID=app... npm run check-airtable
```

È **in sola lettura**: chiede un record per tabella indicando i campi attesi,
non scrive e non cancella nulla. Ti dice esattamente cosa manca:

```
  ok         Users — 6 campi
  ok         Categories — 7 campi
  MANCA      Cards — la tabella non esiste (attenzione a maiuscole e plurale)
  INCOMPLETA Transactions — campi mancanti o scritti diversamente: MyShare
```

Correggi su Airtable e rilancia finché non è tutto `ok`.

## 4. Verifica che sia tutto a posto

```bash
npm run doctor
```

Controlla in un colpo solo tutto ciò che è verificabile da riga di comando —
versione di Node, dipendenze, `.env`, schema Airtable,
raggiungibilità dell'ecosistema Fru Pass, e che il client compili — e per
ogni cosa che manca dice il comando per rimediare.

Restano due verifiche che solo tu puoi fare, dopo aver avviato l'app: che
si entri con il proprio codice Fru Pass, e che su Airtable compaiano la riga
in `Users`, le 4 categorie e la carta.

## 5. Prova in locale

Dalla radice del repo:

```bash
npm install                       # dipendenze della funzione
cd client && npm install && cd ..  # dipendenze del client
```

Crea il file `.env`:

```bash
npm run setup-env
```

Chiede solo il token — il base id è già noto e non è un segreto — e scrive
un `.env` leggibile solo dal tuo utente. È in `.gitignore`, non finisce su
GitHub. In alternativa puoi copiare `.env.example` in `.env` e riempirlo a
mano.

Avvia:

```bash
npm run dev
```

Fa girare client e funzione insieme, come in produzione, usando la Netlify
CLI tramite `npx`: non serve installarla globalmente (su macOS l'installazione
globale spesso fallisce per i permessi di `/usr/local`, ed è una battaglia
inutile). La prima volta ci mette un po' perché la scarica.

Apri `http://localhost:8888` e inserisci il tuo codice Fru Pass. Se tutto è a
posto, entri e in Airtable compaiono la riga in `Users` e le 4 categorie.

### Se qualcosa non va

| Sintomo | Causa quasi sempre |
|---|---|
| «Codice non riconosciuto» con un codice che sai valido | il codice non è (ancora) attivo nell'ecosistema — chiedi all'amministratore |
| «Fru Pass non risponde, riprova» | l'endpoint condiviso è irraggiungibile: non è un problema tuo, riprova più tardi |
| Errore 500 / pagina che resta a caricare | manca una delle due variabili, o un nome di campo Airtable è scritto diversamente |
| Entri ma non vedi le categorie | tabella `Categories` con un nome o un campo diverso da quelli sopra |

Per vedere l'errore vero: `npm run dev` stampa in console i log della
funzione, ed è lì che compare il messaggio di Airtable.

## 6. Metti online su Netlify

1. [app.netlify.com](https://app.netlify.com) → **Add new site → Import an
   existing project** → GitHub → scegli il repo `tappy`.
2. Branch da pubblicare: quello che decidiamo di mergiare su `main`.
   **Non toccare build command e publish directory**: Netlify legge già tutto
   da `netlify.toml` (build del client, cartella `client/dist`, funzioni in
   `netlify/functions`, redirect `/api/*`).
3. **Site configuration → Environment variables** → aggiungi le stesse due:
   `AIRTABLE_API_KEY` e `AIRTABLE_BASE_ID`.
4. **Deploy**. Da lì in poi ogni push sul branch pubblicato ridistribuisce da
   solo.
5. Apri il dominio Netlify da iPhone e accedi col tuo codice: gli stessi dati
   che vedi sul computer.

⚠️ Le variabili d'ambiente vanno messe **prima** del primo deploy utile: se
le aggiungi dopo, serve un **Trigger deploy → Clear cache and deploy site**,
altrimenti la funzione gira ancora senza.

## 7. Comandi utili

Tutti dalla radice del repo.

| Comando | Cosa fa |
|---|---|
| `npm run doctor` | controlla tutto l'ambiente e dice cosa manca |
| `npm run setup-env` | crea il `.env` con le credenziali per lo sviluppo in locale |
| `npm run check-airtable` | verifica che tabelle e campi della base siano quelli giusti (sola lettura) |
| `npm run dev` | client + API insieme, come in produzione (`:8888`) |
| `npm test` | i test dell'autenticazione Fru Pass (non toccano la rete, non servono credenziali) |
| `cd client && npm run dev` | solo il client, senza backend — utile per lavorare sulla grafica |
| `cd client && npm run build` | verifica che compili prima di pushare |
| `cd client && npm run lint` | controllo statico |

## 8. L'automazione Apple Pay

**È un'automazione, non un comando rapido da lanciare a mano**: si crea
nell'app Comandi Rapidi, scheda **Automazione**, e scatta da sé quando arriva
il pagamento. Tu non tocchi niente — paghi, e la spesa è già registrata.

Due conseguenze pratiche, che sono il motivo per cui la distinzione conta:

- Va impostata su **«Esegui immediatamente»** con la richiesta di conferma
  **disattivata**, altrimenti a ogni pagamento l'iPhone chiede il permesso e
  l'automatismo non serve più a niente.
- Il trigger disponibile dipende dalla versione di iOS: va verificato sul tuo
  iPhone quale c'è fra quelli legati ai pagamenti o alle notifiche. È la prima
  cosa da guardare quando affronteremo il task, perché da lì dipende come si
  estraggono importo ed esercente.

Non è ancora pronta (è il task F7), ma il webhook lato server sì. Quando ci
arriveremo servirà:

- **URL**: `https://<tuo-sito>.netlify.app/api/webhook/applepay`
- **Header**: `x-api-key` con la **chiave del webhook**, che trovi in
  Impostazioni → Apple Pay Shortcut.

⚠️ Nell'automazione va la **chiave del webhook**, mai il codice Fru Pass:
quello è la credenziale di tutto l'ecosistema, e un'automazione si può
esportare e condividere con un link.
