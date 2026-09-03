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
- [ ] `npm run esporta` passa tutti i controlli
- [ ] La cartella è su GitHub, sul branch `export-frupass`
- [ ] Pulsante "Installa app", `manifest.json` e icone presenti (fatto)

## 4. Preparare la consegna per l'hub

L'hub vuole una cartella statica. Tappy però ha anche un **backend**, ed è il
motivo per cui esiste: al pagamento un'automazione dell'iPhone manda la spesa
a un endpoint, e un file statico non può riceverla.

Il sito dell'hub **è un sito Netlify**, quindi può ospitare anche quella
funzione: non serve un secondo deploy. È la strada consigliata — un dominio
solo, nessuna chiamata cross-origin, e l'automazione punta allo stesso posto
dell'app.

```bash
npm run esporta
```

Produce tre cose in `export/`:

| | Dove va |
|---|---|
| `tappy/` | `frupass-hub/tappy/` — il frontend, non richiede altro |
| `hub/netlify/functions/` | nelle funzioni del sito dell'hub (`tappy-api.js` è già rinominata, così non collide con le altre app) |
| `ISTRUZIONI-HUB.md` | per l'amministratore: le quattro aggiunte al progetto dell'hub |

Le quattro aggiunte sono: la funzione, tre dipendenze nel `package.json` del
sito, due redirect nel `netlify.toml`, e due variabili d'ambiente
`TAPPY_AIRTABLE_*`. Nessuna tocca le altre app.

### Se l'amministratore non vuole toccare il progetto dell'hub

Allora il backend va su un sito Netlify separato di tappy, e nell'hub entra
solo il frontend, che lo chiama da un'altra origine:

```bash
TAPPY_API_URL=https://<tuo-sito>.netlify.app npm run esporta
```

Funziona (CORS e preflight verificati), ma costa un secondo deploy da
mantenere e un dominio in più nell'automazione. Da usare solo se la prima
strada è preclusa.

### Consegna

```bash
git checkout -b export-frupass
git add -f export
git commit -m "Export di tappy per l'hub"
git push -u origin export-frupass
```

All'amministratore basta: repository `fruggism/tappy`, branch
`export-frupass`, cartella `export/`.

⚠️ **Con backend separato, non esportare prima del deploy**: senza il dominio
vero l'app cercherebbe l'API dove non c'è. In modalità hub il problema non si
pone, perché l'indirizzo è relativo.

### Verificato

Entrambe le sistemazioni sono state provate montando un finto sito dell'hub
con i due redirect veri:

- l'app parte da `/tappy/`, senza risorse mancanti;
- l'API è chiamata su `/tappy/api`, **sullo stesso dominio**;
- l'accesso riesce passando dalla funzione;
- l'arrivo dalla tile con `#code=` entra senza mostrare il login;
- il webhook risponde su `/tappy/api/webhook/applepay`, che è l'indirizzo che
  finirà nell'automazione.

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
