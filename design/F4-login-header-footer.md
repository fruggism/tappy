# F4 — Login, header e footer Fru Pass, nel linguaggio di tappy

Spec per l'UI Developer (task F5). Riferimenti: `COORDINATION.md` §6 per la
decisione di stile, la guida di integrazione Fru Pass per i requisiti
funzionali.

**Il principio che regge tutta la spec**: tappy non si traveste da app
dell'ecosistema. Di Fru Pass adottiamo *comportamenti* (come si entra, come
si torna all'hub, come si riconosce l'appartenenza) e non la sua pelle.
L'unico elemento visivo che importiamo è il logo — e va trattato come una
firma discreta, non come un co-brand.

Restano invariati: palette `base/surface/surface2/ink/muted` + accenti
`neon-*`, font di sistema, `rounded-2xl`, animazioni leggere. Niente
Orbitron, niente `--foil`, niente `#06070f`.

---

## 1. Schermata di login

Compare **solo** quando non c'è né codice nell'URL né sessione salvata.

### Struttura

Contenitore centrato, `max-w-sm`, colonna con `gap-4`, dentro il `max-w-md`
dell'app. Dall'alto:

1. **Wordmark tappy** — `text-3xl font-bold tracking-tight`, con `py` in
   `text-neon-green` (come già in `App.tsx`). È l'unica cosa grande della
   schermata: chi entra deve vedere *tappy*, non *Fru Pass*.
2. **Sottotitolo** — `text-sm text-muted dark:text-muted-dark text-center`:
   «Accedi con il tuo codice Fru Pass, lo stesso che usi nelle altre app.»
   Una riga, nessuna spiegazione di cosa sia l'ecosistema: chi ha un codice
   lo sa già.
3. **Campo codice** — vedi sotto.
4. **Riga di stato** — errore o vuoto. Altezza riservata (`min-h-[1.25rem]`)
   così il bottone non salta quando compare l'errore.
5. **Bottone Accedi**.
6. **Firma Fru Pass** — logo `h-4` in `opacity-40`, centrato, `mt-6`, con
   sopra `text-[10px] uppercase tracking-wide text-muted`: «parte
   dell'ecosistema». È qui che si dichiara l'appartenenza, in fondo e in
   punta di piedi.

### Il campo codice

```
className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-3
           text-center text-lg tracking-[0.2em] font-medium
           outline-none focus:ring-2 focus:ring-neon-green/60
           transition-shadow"
placeholder="FRU-••••-••••"
autoFocus autoCapitalize="characters" autoCorrect="off" spellCheck={false}
```

- **Maschera**: il campo parte con `FRU-` già scritto e si formatta da sé
  mentre si digita (`formatCodeInput` in `client/src/lib/frupass.ts`, già
  implementata in F1: accetta incollato con o senza trattini, con o senza
  prefisso, in minuscolo).
- **Tastiera iPhone**: `autoCapitalize="characters"` + `autoCorrect="off"` +
  `spellCheck={false}`. **Non** usare `inputMode="numeric"`: i codici
  contengono lettere. Non usare `type="password"`: il codice va riletto per
  controllarlo.
- **Il prefisso `FRU-` non è cancellabile**: la maschera lo rimette. Il
  cursore non deve poter finire prima di esso — se dà problemi, la soluzione
  semplice è tenerlo come testo statico a sinistra dentro il contenitore e
  lasciare all'input solo le 8 cifre. È accettabile e anzi preferibile.
- **Il bottone resta disabilitato** (`disabled:opacity-50`) finché
  `isCompleteCode()` non è vera. Nessun errore mentre si digita: si valida
  solo alla conferma.

### Stati

| Stato | Cosa si vede |
|---|---|
| **Riposo** | campo con `FRU-`, bottone «Accedi» disabilitato |
| **Completo** | bottone attivo, anello `focus:ring-neon-green/60` sul campo |
| **In verifica** | bottone → «Verifica…», `disabled`, campo `pointer-events-none opacity-60`. **Nessuno spinner**: la verifica dura poche centinaia di ms, uno spinner che appare e sparisce è peggio del testo che cambia |
| **Codice rifiutato** | messaggio `text-xs text-neon-pink text-center`: «Codice non riconosciuto». Il campo prende `ring-1 ring-neon-pink/50` e fa una **scossa laterale** di 0.3s (vedi §5). Il testo **non** si cancella: chi ha sbagliato un carattere lo corregge, non riscrive tutto |
| **Ecosistema irraggiungibile** | messaggio diverso e **non allarmante**: «Fru Pass non risponde, riprova tra poco». Niente scossa, niente rosa: usa `text-muted`. Non è colpa dell'utente e il codice è probabilmente giusto — distinguere i due casi è il punto (F1 restituisce già un errore diverso: `FruPassUnreachable`) |

### Arrivo dall'hub — niente lampeggio

Quando l'app è aperta da una tile dell'hub, il codice è già nell'URL
(`#code=FRU-…`) e la schermata di login **non deve mai comparire**, nemmeno
per un fotogramma. Il comportamento richiesto:

- All'avvio, finché non si sa chi è l'utente, si mostra **lo spinner
  esistente** (il cerchio `border-t-neon-green animate-spin` già in
  `App.tsx`), mai il login.
- Il login compare solo quando lo stato è deciso: nessun codice nell'hash,
  nessuna sessione salvata.

F1 ha già impostato la logica (`needsLogin` in `AppContext`); questa è la
regola visiva che la accompagna e va rispettata in F5.

---

## 2. Header

### Il problema

L'header attuale ha wordmark a sinistra e nome utente a destra. La guida
chiede tre controlli a destra (logo Fru Pass → home → toggle tema). Con il
nome utente farebbero quattro elementi in `max-w-md`: troppi.

**Decisione: il nome utente esce dall'header** e va in Impostazioni, dove
peraltro sta già la sua sezione. In un'app personale, aperta ogni giorno
dallo stesso proprietario, sapere come ci si chiama non vale un quarto della
barra.

### Struttura

Header non fisso ma **sticky**, così durante lo scroll resta agganciato in
alto senza rubare altezza al contenuto:

```
className="sticky top-0 z-20 px-5 pb-2 flex items-center justify-between
           bg-base/80 dark:bg-base-dark/80 backdrop-blur-xl"
style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
```

Lo `style` è **identico a quello già presente** in `App.tsx`: non va
ricalcolato, va solo mantenuto quando si aggiungono i controlli. Il velo
`bg-base/80 + backdrop-blur-xl` è lo stesso trattamento della nav in basso —
è così che le due barre si riconoscono come la stessa famiglia.

**Sinistra**: wordmark `tappy` invariato (`text-2xl font-bold`).

**Destra**, in quest'ordine da sinistra a destra (l'ordine della guida letto
da destra: toggle, home, logo):

| Elemento | Resa |
|---|---|
| **Toggle tema** | icona `h-5 w-5`, `text-muted dark:text-muted-dark`, `active:scale-90 transition-transform` |
| **Home (torna all'hub)** | stessa metrica, stessa `text-muted`. Icona casa a tratto (`stroke-width 1.8`, come le icone della nav) |
| **Logo Fru Pass** | vedi §3 |

Spaziatura `gap-3` fra i tre, area di tocco `p-1.5 -m-1.5` (44×44pt effettivi
senza allargare la riga).

Il **link home** apre l'URL dell'hub. Non lo conosciamo ancora: va messo in
una costante `FRUPASS_HUB_URL` in un solo punto del codice, così quando
l'amministratore lo comunica si cambia una riga. `target="_self"` — è una
navigazione via, non una nuova scheda.

---

## 3. Il logo Fru Pass — l'unico ospite

È il vero problema di design di questo task: un marchio di un ecosistema
"spaziale/cyber" dentro un'interfaccia Apple-minimale, senza che sembri un
adesivo attaccato sopra.

**Regole:**

1. **Monocromatico, sempre.** Il logo prende `currentColor` con
   `text-muted dark:text-muted-dark`, mai i suoi colori originali (ciano/
   magenta/gold stonerebbero con `neon-green`, che è l'accento di tappy, e
   creerebbero un secondo centro d'attenzione).
2. **Piccolo.** `h-4` nell'header (il wordmark tappy è `text-2xl`: la
   gerarchia deve essere inequivocabile), `h-4` nel footer, `h-4`
   nel login.
3. **A riposo `opacity-60`**, `opacity-100` al tocco quando è cliccabile.
4. **Non è un bottone primario.** Nessuno sfondo, nessun bordo, nessun
   `rounded` attorno.

**Cosa serve dall'amministratore**: il logo in **SVG monocromatico a tracciato
unico**, senza `fill` codificati nel file (o con `fill="currentColor"`), in
un `viewBox` quadrato o comunque con proporzioni note. Un PNG colorato non è
utilizzabile a queste regole. Va salvato in `client/public/frupass.svg` e
incluso inline come componente React, così eredita `currentColor`.

**Finché il logo non arriva**, F5 può procedere usando un segnaposto: il
testo `FRU` in `text-[10px] font-semibold tracking-[0.15em] text-muted`
dentro un rettangolo `rounded-md border border-current/30 px-1 py-0.5`. Ha
lo stesso ingombro del logo definitivo e non blocca l'implementazione.

---

## 4. Footer

### Il problema

La guida chiede un footer fisso con logo e versione. Ma in basso c'è già la
**nav flottante** (le tre tab): due barre sovrapposte su iPhone sono
insostenibili — mangiano un quarto dello schermo utile e competono per la
stessa area del pollice.

**Decisione: footer e nav diventano un unico blocco.** La nav resta esattamente
com'è (card flottante `rounded-2xl`, `backdrop-blur-xl`, tre tab); il footer
diventa una **riga sottile sotto di essa**, fuori dalla card, appoggiata
sullo sfondo:

```
<div className="flex flex-col items-center gap-0.5 pt-2 pb-1
                text-muted dark:text-muted-dark">
  <FruPassLogo className="h-4 opacity-60" />
  <span className="text-[10px] tabular-nums opacity-70">{APP_VERSION}</span>
</div>
```

Il tutto (nav + riga) sta in un contenitore fisso in basso con:

```
style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
```

— cioè lo **stesso identico calcolo** che oggi `App.tsx` applica alla nav,
spostato dalla nav al contenitore che le racchiude entrambe. Sull'iPhone la
riga del footer finisce così nella fascia dell'home indicator, che è
esattamente lo spazio morto giusto per un'informazione di servizio.

**Conseguenza da non dimenticare**: il `paddingBottom` del `<main>` (oggi
`calc(env(safe-area-inset-bottom) + 6rem)`) va aumentato a **`+ 8rem`**, o
l'ultima card di ogni schermata finisce sotto la nav.

### Versione

Formato `2026.09.02 · v1`: data del giorno più progressivo, come chiede la
guida ("data + versione del giorno"). Va da una costante generata a build
time (`define` in `vite.config.ts`), non scritta a mano — una versione
scritta a mano è una versione sbagliata dopo due deploy.

---

## 5. Toggle giorno/notte

La logica esiste già: `theme: "light" | "dark" | "system"` in
`AppContext.tsx`, persistita lato utente, con `effectiveTheme` calcolato. In
Impostazioni c'è già il selettore a tre posizioni. **Non va riscritta**: va
solo esposta nell'header.

**Il nodo**: la guida chiede un toggle *manuale*, cioè due stati; noi ne
abbiamo tre.

**Decisione: il tocco nell'header alterna solo chiaro ↔ scuro.** Chi tocca
il sole vuole il buio, non un menù. Le tre posizioni restano in
Impostazioni, che è il posto giusto per una preferenza e non per un gesto.

- Se il tema è `system`, il primo tocco lo fissa **all'opposto di quello che
  si sta vedendo** (`effectiveTheme === "dark" ? "light" : "dark"`): il
  tocco fa sempre qualcosa di visibile, che è l'unica cosa che l'utente si
  aspetta da un toggle.
- Da lì in poi alterna `light` ↔ `dark`. Per tornare a `system` si passa da
  Impostazioni — ed è giusto segnalarlo lì con una riga: «Il pulsante
  nell'header imposta chiaro o scuro; da qui puoi tornare ad Automatico.»
- **Icona**: sole quando si sta vedendo il chiaro, luna quando si sta vedendo
  lo scuro — cioè lo *stato corrente*, non l'azione. È la convenzione iOS, e
  invertirla confonde. Transizione: `transition-transform` con una rotazione
  di 90° e cambio icona a metà (0.2s), nessun crossfade.
- Il tema effettivo cambia anche i `<meta name="theme-color">`: sono già
  gestiti in `index.html` per `prefers-color-scheme`, ma con un toggle
  manuale vanno **aggiornati a runtime** quando `effectiveTheme` cambia,
  altrimenti su iPhone la striscia del notch resta del colore sbagliato. È
  il delta più facile da dimenticare di tutta la spec.

---

## 6. Safe area — cosa manca davvero

Buona parte è già fatta (commit «app ottimizzata per notch iPhone»):
`viewport-fit=cover` c'è in `index.html`, i tre `env(safe-area-inset-*)` ci
sono in `App.tsx`, e `html`/`html.dark` hanno già il colore di sfondo per la
striscia del notch.

**Delta per F5:**

1. `paddingTop` dell'header: **invariato**, ma va mantenuto quando l'header
   diventa `sticky` (uno `sticky` senza quel padding fa passare il contenuto
   sotto il notch).
2. `paddingBottom` del contenitore in basso: spostato dalla nav al nuovo
   contenitore nav+footer (§4).
3. `paddingBottom` del `<main>`: da `6rem` a `8rem` (§4).
4. `theme-color` aggiornato a runtime (§5).
5. Login: il contenitore centrato deve rispettare gli inset a sua volta —
   `min-h-full` con `padding` verticale che include
   `env(safe-area-inset-top)` e `env(safe-area-inset-bottom)`, altrimenti su
   iPhone piccoli con tastiera aperta il bottone finisce sotto la piega.

---

## 7. Animazioni

Coerenti con l'esistente: leggere, nessuna libreria.

```css
/* client/src/index.css */
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25%      { transform: translateX(-4px); }
  75%      { transform: translateX(4px); }
}
.animate-shake { animation: shake 0.3s ease-in-out; }

@media (prefers-reduced-motion: reduce) {
  .animate-shake { animation: none; }
}
```

Il blocco `prefers-reduced-motion` non è opzionale: il file lo fa già per
`gauge-overflow-pulse`, e va fatto qui.

L'ingresso della schermata di login riusa `.animate-rise`, che esiste già.

---

## 8. Tensioni con lo standard Fru Pass — da portare all'amministratore

Punti su cui questa spec si discosta consapevolmente dalla guida
dell'ecosistema. Il coordinatore deve comunicarli.

1. **Palette e font.** Nessuna adozione: né `#06070f` e i suoi accenti, né
   Orbitron/Space Grotesk/Space Mono. È la deroga già decisa; qui si
   registra solo che riguarda *tutte* le schermate, login compreso.
2. **Card e bottoni.** La guida indica `border-radius:20px` per le card,
   `12px` per i bottoni, ombre `0 8px 22px rgba(0,0,0,.45)`. Tappy usa
   `rounded-2xl` (16px) ovunque e ombre molto più leggere. Restiamo sui
   nostri: 20px dentro un'app da 16px si nota, e le ombre pesanti sono
   pensate per uno sfondo quasi nero che noi non abbiamo in chiaro.
3. **Footer.** Non è una barra fissa a sé, è una riga sotto la nav (§4). Il
   requisito «logo centrale + versione sotto» è rispettato alla lettera; la
   sua indipendenza come barra no, e su iPhone non poteva esserlo.
4. **Toggle a due stati.** La guida chiede un toggle manuale; noi manteniamo
   anche la terza posizione «sistema», raggiungibile da Impostazioni (§5).
   È un sovrainsieme del requisito, non una mancanza.
5. **Logo.** Reso monocromatico via `currentColor`. Se le linee guida del
   marchio vietano l'uso monocromatico, la spec va rivista — e serve saperlo
   prima che F5 parta.

## 9. Cosa serve prima che F5 possa chiudere

- [ ] Logo Fru Pass in SVG monocromatico (`fill="currentColor"`) →
      `client/public/frupass.svg`. Senza, F5 procede col segnaposto testuale.
- [ ] URL dell'hub per l'icona home → costante `FRUPASS_HUB_URL`.
- [ ] Conferma della deroga grafica da parte dell'amministratore.

Nessuno dei tre blocca l'implementazione: sono tutti sostituzioni di una
costante o di un file.
