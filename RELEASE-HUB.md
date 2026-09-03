# tappy — consegna all'hub Fru Pass

Cosa resta da fare quando tappy è finita e va pubblicata come app
dell'ecosistema. Da leggere *prima* di scrivere all'amministratore.

Setup di Airtable e Netlify: [`SETUP.md`](./SETUP.md).

---

## 1. Le due cose rinviate a questo momento

Sono state lasciate indietro di proposito, perché dipendono
dall'amministratore e non bloccano lo sviluppo. Nel codice sono **due
costanti e un file**: sostituirle è il lavoro di dieci minuti.

### a) URL dell'hub (icona "home" nell'header)

L'header ha un'icona casa che riporta all'hub. Finché l'URL non è noto, punta
alla costante `FRUPASS_HUB_URL`, definita in un solo punto del client.

**Da fare**: chiedere all'amministratore l'URL dell'hub e sostituirlo lì.

### b) Logo Fru Pass (header, footer, schermata di login)

Nei tre punti il marchio è oggi un **segnaposto testuale**: `FRU` in un
rettangolo bordato, con lo stesso ingombro del logo definitivo.

**Da chiedere all'amministratore**: il logo in **SVG monocromatico a
tracciato unico**, senza `fill` codificati nel file (o con
`fill="currentColor"`), in un `viewBox` di proporzioni note.

Un PNG colorato **non è utilizzabile**: la spec (`design/F4-login-header-footer.md`
§3) rende il marchio monocromatico su `currentColor` proprio perché i suoi
ciano/magenta accanto al verde neon di tappy creerebbero un secondo centro
d'attenzione. Se le linee guida del marchio vietano l'uso monocromatico, va
detto *prima*: cambia la spec, non solo il file.

**Da fare**: salvare il file come `client/public/frupass.svg` e includerlo
inline come componente React (così eredita `currentColor`), sostituendo il
segnaposto nei tre punti.

## 2. La deroga grafica — cosa comunicare

tappy **non adotta** lo standard grafico dell'ecosistema: mantiene la propria
identità visiva (palette neon su fondo chiaro/scuro Apple, font di sistema,
grafici SVG scritti a mano). La deroga è stata decisa e confermata dal
proprietario del progetto.

Va comunicata all'amministratore in modo esplicito, perché è l'unico punto in
cui tappy si discosta dallo standard. Nel dettaglio:

| Requisito della guida | tappy |
|---|---|
| Login con un solo campo, placeholder `FRU-••••-••••` | ✅ conforme |
| Auto-login da `#code=FRU-…` | ✅ conforme |
| Sessione persistente in `localStorage`, chiave `tappy_frupass` | ✅ conforme |
| Header fisso: logo Fru Pass → home → toggle giorno/notte | ✅ conforme |
| Footer con logo centrale e versione sotto | ✅ conforme come **riga sotto la nav**, non come barra fissa a sé: due barre fisse in basso su iPhone sono insostenibili |
| `viewport-fit=cover` + `env(safe-area-inset-*)` | ✅ conforme |
| Toggle giorno/notte manuale | ✅ conforme, **più** la terza posizione "sistema" in Impostazioni (sovrainsieme del requisito) |
| Nessuna credenziale dell'ecosistema nel codice | ✅ conforme, verificato dallo script di export |
| Percorsi relativi, `index.html` alla radice della cartella | ✅ conforme, provato da un sottopercorso |
| `manifest.json` + icone 192/512/180 | ✅ conforme |
| Pulsante "Installa app" con le istruzioni | ✅ conforme (iOS e Android hanno istruzioni diverse: si mostra quella giusta) |
| Palette `#06070f` + ciano/magenta/gold | ❌ **deroga**: resta la palette tappy |
| Font Orbitron / Space Grotesk / Space Mono | ❌ **deroga**: restano i font di sistema |
| Card `20px`, bottoni `12px`, ombre `0 8px 22px rgba(0,0,0,.45)` | ❌ **deroga**: restano `16px` e ombre leggere |

Motivazioni, se servono: la grafica di tappy è stata sviluppata e rifinita
prima dell'ingresso nell'ecosistema, ed è la ragione per cui l'app è
piacevole da aprire ogni giorno. Il resto dello standard — cioè tutto ciò che
riguarda *come si entra e come ci si muove fra le app* — è rispettato alla
lettera.

## 3. Prima di scrivere all'amministratore

- [ ] L'app è online su un suo sito Netlify e funziona da iPhone
- [ ] Login con un codice Fru Pass **reale** (non inventato) verificato
- [ ] Aprendo `https://<sito>/#code=FRU-XXXX-XXXX` si entra **senza** vedere
      la schermata di login, nemmeno per un istante
- [ ] Il profilo resta salvato fra un'apertura e l'altra (nessun logout al
      refresh)
- [ ] Header e footer presenti, toggle giorno/notte funzionante
- [ ] Logo Fru Pass definitivo al posto del segnaposto (§1b)
- [ ] Icona home che porta davvero all'hub (§1a)
- [ ] **Nessuna credenziale dell'ecosistema nel repo**: da verificare a mano
      con `git grep -i airtable` — devono comparire solo le **nostre**
      variabili `AIRTABLE_API_KEY`/`AIRTABLE_BASE_ID`, mai valori scritti nel
      codice, e nessun riferimento alla base dell'hub
- [ ] Il token Airtable di tappy è abilitato **solo** sulla base `tappy`
      (vedi `SETUP.md` §2)
- [ ] `npm run esporta` passa tutti i controlli, col dominio vero
- [ ] La cartella è su GitHub, sul branch `export-frupass`
- [ ] Pulsante "Installa app", `manifest.json` e icone presenti (fatto)

## 4. Preparare la cartella per l'hub

L'hub vuole una cartella **statica e autosufficiente**, da copiare in
`frupass-hub/tappy/`. Tappy però ha un backend — è il motivo per cui esiste,
visto che l'automazione deve poter scrivere una spesa. La guida
dell'ecosistema lo prevede: l'identità arriva dall'hub, i dati stanno «su un
tuo backend separato».

Quindi la sistemazione è questa:

- **Nell'hub** va solo il frontend, statico, con percorsi relativi.
- **Il backend resta sul sito Netlify di tappy** e viene chiamato da un altro
  dominio. Il webhook dell'automazione continua a puntare lì, e non cambia
  quando l'app entra nell'hub.

Serve quindi il dominio del sito Netlify di tappy, e va passato all'export:

```bash
TAPPY_API_URL=https://<tuo-sito>.netlify.app npm run esporta
```

Lo script compila il client con i percorsi relativi e l'API puntata al
backend, copia tutto in `export/tappy/`, e **si rifiuta di consegnare** se
trova un riferimento assoluto, un `localhost`, un'icona mancante o una
credenziale finita nel pacchetto. Sono gli errori che altrimenti si scoprono
solo online.

Poi:

```bash
git checkout -b export-frupass
git add -f export/tappy
git commit -m "Export statico di tappy per l'hub"
git push -u origin export-frupass
```

E all'amministratore basta dire: repository `fruggism/tappy`, branch
`export-frupass`, cartella `export/tappy/`.

⚠️ **Non esportare prima del deploy**: senza il dominio vero l'app cercherebbe
l'API dove non c'è. E se un giorno cambi il dominio del backend, va rifatto
l'export — è l'unico punto in cui quell'indirizzo resta scritto.

### Cosa contiene la cartella

```
tappy/
  index.html
  assets/            (js e css, con percorsi relativi)
  manifest.json
  icons/icon-192.png, icon-512.png, icon-180.png
  icona.svg
```

### Verificato

Il pacchetto è stato provato servito **da un sottopercorso** (`/tappy/`), che
è il test che la guida indica come più importante: l'app parte, nessuna
risorsa manca, il manifest e le icone si raggiungono, l'API viene cercata sul
backend esterno e non sull'hub, e l'arrivo dalla tile con `#code=` entra senza
mostrare il login.

## 5. Cosa mandare

All'amministratore serve:

1. **L'URL finale** del sito Netlify.
2. **Nome, icona, colore e descrizione** per la tile nel catalogo dell'hub.
   Coerenti con l'app: nome `tappy`, accento verde neon `#39ff88`,
   descrizione in una riga («Le spese delle carte, live»).
3. **La comunicazione della deroga grafica** (§2), meglio se con un
   collegamento a questo file o uno screenshot dell'app.

L'inserimento nel catalogo e l'abilitazione sui profili utente **li fa
l'amministratore**, dal pannello admin: non c'è nulla da fare lato codice.

## 6. Dopo la pubblicazione

Da controllare la prima volta che apri tappy **dalla tile dell'hub**, non dal
link diretto: è l'unico modo di provare davvero l'auto-login con un codice
vero nell'URL. Se lì comparisse la schermata di login, il difetto è quello
che la guida dell'ecosistema segnala come più frequente — e va corretto
subito.
