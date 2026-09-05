# Linee guida — sentire da app, non da sito

Documento da replicare. Nasce da tappy, ma non è un inventario di componenti:
è il **contratto visivo e tattile** che fa sembrare un prodotto un’app
installata, anche quando gira in Safari o come PWA.

Ogni regola qui sotto è nata da un difetto reale (pagina che zoomava,
pulsantiera che galleggiava, schermata che “si smontava”). Non sono gusti.

---

## 1. Una frase

Lo schermo del telefono **è** l’app. Niente esce, niente rimbalza, niente
rimpicciolisce la pagina, niente scopre il bianco di Safari sotto il notch o
sopra l’home indicator.

Se un’azione apre qualcosa, è una **lastra** o una **pagina** dentro la
colonna dell’app — non un dialogo da desktop e non un `position: fixed`
inchiodato al viewport del browser.

---

## 2. Lo scheletro

```
┌─────────────────────────┐  ← html/body: stesso colore dell’app
│  status bar / notch     │     (non il default di Safari)
│  header (sticky)        │
│                         │
│  main  (unico scroll)   │
│                         │
│  dock                   │
│  home indicator         │  ← padding = safe-area, stesso sfondo
└─────────────────────────┘
     colonna max-w-md
```

- Colonna unica, **`max-w-md`**, centrata. Mai full-bleed da sito.
- Header e dock **non scorrono**. Scorre solo `<main>`.
- `body { overflow: hidden; overscroll-behavior: none }`. Il rubber-band iOS
  non deve trascinare la pulsantiera.
- Altezza: **`100dvh`** (con `100svh` di ripiego). Non `100%`, non `100vh`.
  `svh` da solo lascia una striscia vuota quando Safari nasconde la barra.
- L’app sta in una colonna `h-full` con header / main / dock in colonna flex.
  `main` ha `flex-1 min-h-0 overflow-y-auto`.

---

## 3. Notch, status bar, home indicator

Queste fasce **appartengono all’app**. Se si vede un altro colore, è un buco.

| Pezzo | Cosa fare | Cosa non fare |
|---|---|---|
| Viewport | `viewport-fit=cover` | omettere, o `width=device-width` da solo |
| Sfondo html | stesso colore di `base` (chiaro `#f5f5f7`, scuro `#000`) | lasciare il default bianco/nero del browser |
| `theme-color` | **un solo** meta, aggiornato all’avvio *prima* di React, col tema scelto dall’utente | due meta con `prefers-color-scheme`: vince il tema di **sistema**, non quello dell’app |
| Status bar iOS | `apple-mobile-web-app-status-bar-style = default` | `black-translucent`: accorcia il viewport ma lo disegna da y=0; i pixel avanzati restano in fondo, irraggiungibili, e la dock galleggia |
| Header | `padding-top: max(…, env(safe-area-inset-top))` | padding fisso: sul notch il titolo finisce sotto l’orologio |
| Dock | `padding-bottom: max(…, env(safe-area-inset-bottom))` | ancorare a `bottom: 0` senza safe area: i tasti sotto l’home indicator |
| Lastre / form | stesso padding bottom safe-area | contenuto tagliato dalla home bar |

La status bar prende il colore da `theme-color`. Va scritto in uno script
inline in `<head>`, non in React: iOS la decide al primo paint.

---

## 4. Niente deve far “uscire” dalla schermata

Elenco chiuso di cose che, su iPhone, fanno sentire un sito:

1. **Zoom della pagina.** `user-scalable=no` Safari lo ignora. Si annullano
   `gesturestart/change/end` (WebKit) su tutto tranne ciò che deve
   ingrandirsi (es. una mappa). `touch-action: manipulation` sul body.
2. **Zoom al focus dei campi.** Qualsiasi `input` / `select` / `textarea` a
   **16px o più**. Sotto, iOS ingrandisce e **non rimpicciolisce** dopo.
3. **`position: fixed; inset: 0` sul viewport.** Su Safari non è lo schermo
   del telefono: è la pagina. Header e dock “si smontano”, compare una
   cornice da sito. Le schermate extra stanno **nella colonna**, in un
   portal interno.
4. **Scroll del body.** Solo `main` (o la lastra) scorre.
5. **Tap highlight grigio**, delay 300ms, scrollbar visibile. Via:
   `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`,
   scrollbar a larghezza 0.
6. **Modali da desktop** (overlay full-window, X in alto a destra, card
   centrata). Al loro posto: lastra o pagina (punto 5).

Se l’utente può “uscire” dallo schermo dell’app — bounce, pinch, campo che
allarga, overlay più largo della colonna — la regola è rotta.

---

## 5. Due tipi di schermata extra, mai un terzo

Dentro la colonna, due soli modelli:

**Lastra** (un form, una scelta)
- Sale dal basso, copre la **dock**, lascia l’**header**.
- Maniglia in cima (`h-1 w-10` pillola), angoli `rounded-t-3xl`.
- Fondo scuro a 40% sulla parte di lista che resta visibile.
- Chiudere non azzera lo scroll di sotto: la vista resta montata.

**Pagina** (dettaglio, mappa)
- Copre header **e** dock. Su un telefono, se restano visibili, la pagina
  “non si è aperta”.
- Stesso sfondo `base`, stessa tipografia.
- Indietro in alto a sinistra, non una X.

Niente fogli `fixed` sull’intera finestra. Niente tooltip/`nuvolette` per i
dettagli: il dato va **dove già c’era un numero** (centro di un anello,
riga sotto, pannello che sostituisce — mai un terzo blocco che sposta il
layout).

---

## 6. Colore

Tre superfici, un inchiostro, un muto, pochi accenti. **Non si inventano
tinte.**

| Token | Chiaro | Scuro | Uso |
|---|---|---|---|
| `base` | `#f5f5f7` | `#000000` | sfondo pagina, html, theme-color |
| `surface` | `#ffffff` | `#111113` | card, dock |
| `surface2` | `#f0f0f2` | `#1c1c1f` | campi, pozzi interni |
| `ink` | `#1d1d1f` | `#f5f5f7` | testo |
| `muted` | `#6e6e73` | `#9a9aa2` | didascalie |

Accenti, **due versioni**. In scuro sono fluo; in chiaro sono scuriti fino a
**≥ 4.5:1** su `base`. I fluo puri sul chiaro stanno a ~1.4:1: illegibili e
“da sito gaming”.

| Accento | Chiaro | Scuro |
|---|---|---|
| green | `#008241` | `#39ff88` |
| pink | `#d6008f` | `#ff2ecb` |
| cyan | `#007b94` | `#00e5ff` |
| violet | `#5e5eeb` | `#a3a3ff` |
| amber | `#996600` | `#ffcf4d` |
| over (sforamento) | `#8f1738` | `#e11d48` |

In JS/SVG si legge la variabile (`accent("green")`), non si copia l’esagono
fluo. Altrimenti il tema chiaro riceve il fluo e il contrasto muore.

Distinguere due stati dello **stesso** dato (previsto vs avvenuto, oggi vs
altri giorni): **non un colore nuovo**. Stesso accento, pieno / al 55% /
tratteggiato.

---

## 7. Tipo

Scala iOS, nomi parlanti. **Vietato** `text-[13px]` e simili: la scala è il
prodotto.

| Nome | Size | Line | Weight | Dove |
|---|---|---|---|---|
| `largeTitle` | 34 | 40 | 700 | numero eroico (totale al centro) |
| `title2` | 22 | 28 | 600 | titolo di scheda |
| `headline` | 17 | 22 | 600 | nome, voce di lista |
| `body` | 17 | 22 | 400 | testo |
| `callout` | 15 | 20 | 400 | secondario |
| `footnote` | 13 | 18 | 400 | meta |
| `caption` | 12 | 16 | 400 | etichette uppercase, kpi |

Font: `-apple-system, BlinkMacSystemFont, SF Pro Display, Inter, system-ui`.
Numeri in `tabular-nums`. Tracking stretto solo su largeTitle/title2.

Titoli di sezione: `caption` + `uppercase` + `tracking-wide` + `muted`.
Corti. «Bdg», «€/gg», non paragrafi.

Lingua: **italiano**. Interfaccia, commit, commenti. Niente inglese in UI
(«Cancel», «Save», «in linea»).

---

## 8. Forma

- Card: `rounded-3xl bg-surface p-4`.
- Dock: `rounded-2xl bg-surface/80 backdrop-blur-xl`, bordo 5% nero/10% bianco,
  `shadow-xl`. Una sola barra. Icone, non etichette.
- Header: `bg-base/80 backdrop-blur-xl`. Il bordo sotto compare solo dopo lo
  scroll.
- Campi: `rounded-xl bg-surface2`, 16px.
- Pulsante primario: pieno `ink` (nero in chiaro, bianco in scuro), non un
  verde a bandiera.
- Pulsante distruttivo: testo `acc-pink`, fondo `acc-pink/10`.
- Icone: SVG a tratto, **`strokeWidth={1.8}`**, 20×20 (`h-5 w-5`). Fill
  nessuno, tranne un pallino di stato.
- Active: `active:scale-90`, non un ripple Material.

Due barre fisse in basso su iPhone mangiano un quarto dello schermo. Footer
(marchio, versione) **dentro** la fascia della dock / sotto lo scroll di
main, mai una seconda barra.

L’identità utente non sta in header: tre controlli ci stanno, quattro no.

---

## 9. Movimento e tatto

- Entrate: 8px in su, 400ms, `cubic-bezier(0.22, 1, 0.36, 1)`.
- Lastre: stessa curva, dal basso.
- `prefers-reduced-motion: reduce` → niente animazione **e** niente haptic.
- Haptic, vocabolario chiuso: tick / snap / limit / home / saved / overBudget.
  Un colpo = una notizia. Non vibrare a ogni render.
- Anelli e barre: si riempiono una volta all’ingresso, non in loop.
- Estremità degli archi: **taglio dritto** (`stroke-linecap: butt`), non
  tondo — un tondo su un anello sembra un loader web.

---

## 10. Grafici e numeri

- SVG a mano, non una libreria. Polar math, niente `transform` CSS sui
  numeri (li capovolge).
- Un oggetto alla volta nello sguardo. Se tocchi una fetta, le altre
  spariscono; il dettaglio va **al centro**, dove stava già il totale.
- Pallini e badge: cifra scura su bianco, non colore su colore.
- Overflow di budget: rosso scuro dedicato (`over`), non il pink di Leisure.
- I numeri grandi diventano di quel rosso se si sfora. Niente commento
  («in linea», «ancora», «bravo»).

---

## 11. Contenuto che si tocca

- Un tap ha un bersaglio ≥ 44pt di fatto (padding, non icona nuda).
- Segmented control: pillole, non tab da sito. Stesso componente ovunque
  (giorno / settimana / mese).
- Liste: una riga, un tap, una pagina. Non un menu contestuale.
- Conferme distruttive: nel foglio, non `window.confirm`.
- La vista sotto un foglio **resta montata**: chiudere torna esattamente
  dove si era.

---

## 12. PWA / iPhone

- `apple-mobile-web-app-capable` + `mobile-web-app-capable`.
- Icona 180 per `apple-touch-icon`.
- Manifest con `display: standalone`, `background_color` = `base`.
- Non promettere installazione se già standalone.
- Automazioni e webhook: l’invio utile **prima** di qualsiasi domanda
  (categoria, GPS). Una domanda a telefono bloccato fa scadere tutto.

---

## 13. Checklist prima di dire «sembra un’app»

Da provare su iPhone, PWA e Safari, chiaro e scuro, con notch:

- [ ] Notch e home indicator sono del colore di `base`, mai bianchi “di Safari”
- [ ] `theme-color` segue il tema **dell’app**, non quello di sistema
- [ ] La dock tocca il fondo in entrambi gli stati della barra di Safari
- [ ] Nessun pinch-zoom sulla pagina; la mappa, se c’è, sì
- [ ] Un campo a 16px non fa ingrandire lo schermo
- [ ] Lo scroll non trascina header/dock (niente bounce del body)
- [ ] Aprire un form non “smonta” la vista: è una lastra nella colonna
- [ ] Aprire un dettaglio copre header e dock
- [ ] Chiudere un foglio lascia lo scroll dove stava
- [ ] Nessun `text-[Npx]`, nessun colore fuori palette
- [ ] Accento sul chiaro passa 4.5:1
- [ ] Reduced motion: fermo e muto
- [ ] Icone a tratto 1.8, dock senza scritte
- [ ] Italiano, scritte corte

Se uno di questi fallisce, non è un dettaglio: è di nuovo un sito.
