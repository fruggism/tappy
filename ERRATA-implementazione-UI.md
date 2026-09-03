# Errata al "Pacchetto di implementazione" grafico

Da leggere **prima** di scrivere codice, se stai implementando
`tappy — pacchetto di implementazione` (token tipografici, palette
accessibile, `SpendingClock`, haptics, controlli di Movimenti).

Quel documento è valido nella sostanza, ma è stato scritto prima di due
lavori già completati e mergiati altrove. Tre delle sue premesse oggi sono
false, e due riguardano proprio i file che dovrai toccare.

---

## 1. Da dove partire — il punto più importante

**Parti da `claude/app-deployment-sync-agzd2h`, non da `main`.**

`main` è indietro di due task: l'autenticazione Fru Pass (F1) e l'header/dock
(F5). I file che il pacchetto ti chiede di modificare — `App.tsx`,
`index.css`, `tailwind.config.js` — sono **gli stessi** che quei due task
hanno cambiato. Partire da `main` significa scoprire il conflitto a lavoro
finito, sul codice più delicato.

```bash
git fetch origin
git checkout -b <tuo-branch> origin/claude/app-deployment-sync-agzd2h
```

## 2. Le tre premesse superate

| Il documento dice | Oggi |
|---|---|
| «il client è ancora su `mockApi` (`USE_MOCK = true`): resta così» | `USE_MOCK` è **`false`**: il client parla con le Netlify Functions. Per sviluppare la UI senza backend puoi girarlo a `true` in locale — con i dati finti la schermata di accesso Fru Pass viene saltata apposta — ma **rimettilo a `false` prima di committare**. |
| «non toccare `server/`» | `server/` **non esiste più**. Il backend è `netlify/functions/` su Airtable. La sostanza della regola resta: non toccarlo. |
| §6.3 «header collassabile in `App.tsx`» | L'header ora è il componente `Header` in `client/src/components/AppChrome.tsx`: sticky, `backdrop-blur-xl`, con toggle tema, ritorno all'hub e marchio Fru Pass. Il collasso allo scroll si può ancora fare, ma **su quello** — non sull'header descritto nel documento, che non c'è più. |

## 3. Cosa è comparso dopo, e che ti riguarda

Tre file nuovi, tutti in territorio che il pacchetto attraversa:

- `client/src/components/AppChrome.tsx` — `Header` e `Dock` (navigazione +
  riga con marchio e versione, un blocco solo in fondo).
- `client/src/views/Login.tsx` — schermata di accesso Fru Pass.
- `client/src/components/FruPass.tsx` — marchio dell'ecosistema, oggi un
  segnaposto testuale.

**Vale anche per loro** quello che il pacchetto chiede al resto del client:
il §1 (niente `text-[Npx]`, scala tipografica) e il §2 (accento accessibile
sul chiaro) si applicano a questi tre file come agli altri. Non sono
esenti perché sono nuovi.

In particolare — ed è un difetto reale, non un'ipotesi — `#39ff88` su fondo
chiaro sta a **1.4:1**, e questi file lo usano: il `py` del wordmark
(`AppChrome.tsx`, `Login.tsx`) e l'anello di focus del campo codice. La
variante `--acc-green: #00b25a` del §2 va applicata anche lì.

Una cosa invece **non** toccarla senza parlarne: il §5 chiede di estrarre il
segmented control da `Andamento.tsx` in un componente condiviso. Bene. Ma la
`Dock` e la navigazione a tre tab non sono un segmented control e non vanno
unificate con quello: sono due cose diverse che si somigliano.

## 4. Cosa guarderò in revisione

Nell'ordine, e senza sorprese — è tutto verificabile prima di consegnare:

1. **I criteri di accettazione del pacchetto**, eseguiti davvero:
   `grep -r "text-\[" client/src` vuoto, nessun `<select>` in
   `Movimenti.tsx`, `npm run build` e `npx oxlint` puliti, nessuna
   dipendenza nuova in `package.json`.
2. **Il contrasto sul tema chiaro**, sulle coppie testo/sfondo che hai
   toccato — inclusi i tre file nuovi di §3.
3. **`prefers-reduced-motion`**: niente animazioni **e** niente haptic. Il
   pacchetto lo chiede, e `haptics.ts` lo implementa: verifica che valga
   anche per le animazioni che introduci.
4. **Il gesto del quadrante non blocca lo scroll verticale** della pagina.
   È il punto più facile da sbagliare e il più fastidioso da usare se
   sbagliato: lo proverò a mano, in un browser, non solo leggendo il codice.
5. **Che l'anello di Andamento sia rimasto quello di prima.** Il quadrante è
   un componente nuovo e separato: i due coesistono.
6. **Che F1 e F5 funzionino ancora**: accesso Fru Pass, auto-login da
   `#code=`, toggle tema (che aggiorna anche i meta `theme-color`), dock in
   fondo. Sono verificati da test e da controlli su browser reale: se un tuo
   cambiamento li rompe, lo vedo lì.

Se qualcosa del pacchetto ti sembra sbagliato mentre lo implementi, dillo
invece di aggirarlo: il documento è una proposta, non un contratto. Le uniche
cose non negoziabili sono le tre premesse corrette qui sopra e i due punti di
§8 che restano validi — nessuna libreria nuova, e l'anello di Andamento non
si sostituisce.
