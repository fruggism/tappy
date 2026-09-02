# tappy — guida di coordinamento

Questo documento non spiega *come funziona* tappy (per quello ci sono
[`README.md`](./README.md) e [`GUIDE.md`](./GUIDE.md)): spiega **chi fa cosa**.
È la guida operativa del coordinatore e degli agent che lavorano al progetto.

Regola d'oro: **le idee entrano dal coordinatore, escono come task assegnati a
un solo agent proprietario.** Nessun agent tocca file di proprietà di un altro
senza passare da qui.

---

## 1. Gli agent e i loro confini

| Agent | Ruolo | File di sua proprietà | Non tocca mai |
|---|---|---|---|
| **UI Expert** | Design, non codice di produzione. Definisce layout, gerarchia visiva, micro-interazioni, palette, copy. Consegna spec + mockup, non PR sull'app. | `design/` (spec, mockup, note), `tailwind.config.js` (proposte di palette) | tutto `src/` |
| **UI Developer** | Implementa le spec dell'UI Expert. Componenti, viste, grafici SVG, animazioni, stato locale. | `client/src/views/`, `client/src/components/`, `client/src/index.css`, `client/src/App.tsx` | `client/src/lib/*Api.ts`, `server/` |
| **Backend & Deploy** | Server Express/SQLite, schema, rotte, autenticazione, hosting, sincronizzazione multi-dispositivo, migrazione dal mock ai dati reali. | `server/`, `client/src/lib/realApi.ts`, `client/src/lib/api.ts`, `client/.env*`, config di deploy | viste e componenti |
| **Shortcuts (iPhone)** | Comando Rapido Apple Pay: parsing della notifica, POST al webhook, onboarding dell'utente, sezione "Apple Pay Shortcut" in Impostazioni (solo la parte funzionale). | `shortcuts/` (documentazione + file del comando), contratto del webhook | schema DB, layout delle viste |

**Zone condivise** (serve accordo esplicito del coordinatore prima di
modificarle, perché rompono tutti):

- `client/src/lib/types.ts` — il modello dati. Cambiarlo tocca client, server e webhook.
- `client/src/lib/api.ts` — l'interfaccia comune fra `mockApi` e `realApi`.
- `server/src/db.ts` — lo schema.

---

## 2. Il contratto che tiene tutto insieme

Il progetto regge perché `mockApi` e `realApi` espongono **la stessa identica
interfaccia**, e lo switch è una riga sola:

```ts
// client/src/lib/api.ts
const USE_MOCK = true;
export const api = USE_MOCK ? mockApi : realApi;
```

Conseguenze operative, valide per tutti:

1. L'UI Developer programma **solo contro `api`**, mai contro `fetch` diretto.
   Così può lavorare col mock mentre il backend cambia sotto.
2. Chi aggiunge un metodo all'API lo aggiunge **in entrambe** le
   implementazioni nella stessa PR, altrimenti il mock si rompe.
3. Chi cambia `types.ts` apre un task esplicito al coordinatore, che avvisa
   gli altri tre agent prima del merge.

---

## 3. Come io instrado un'idea

Quando mi proponi un'idea la classifico così, e questo determina l'agent:

- **"Si vede"** (schermata nuova, grafico, layout, animazione, copy)
  → UI Expert per la spec → UI Developer per l'implementazione. Due task in
  sequenza, mai in parallelo: il developer parte solo quando la spec esiste.
- **"Si salva / si sincronizza / va online"** (nuovi dati, nuove rotte,
  hosting, backup, più dispositivi, login) → Backend & Deploy.
- **"Parte dall'iPhone"** (notifiche, automazioni, Comandi Rapidi, widget)
  → Shortcuts.
- **Idea che tocca due o tre di questi** → la spezzo io in task per agent, con
  l'ordine di esecuzione e il contratto (tipi/rotte) fissato **prima** che
  qualcuno inizi.

Quello che ricevi da me per ogni idea: *cosa* si costruisce, *chi* lo fa,
*in che ordine*, e *cosa serve decidere prima* (se serve).

---

## 4. Workflow

- **Branch**: uno per task, `claude/<area>-<slug>`; niente commit diretti su `main`.
- **Un task = un agent = un'area**. Se un task ha bisogno di toccare due aree,
  è due task.
- **Fatto significa**: `npm run lint` e `npm run build` puliti in `client/`;
  provato a mano con `USE_MOCK = true`; e — se il task tocca `realApi` o il
  server — provato anche con `USE_MOCK = false` e il server acceso.
- **Niente dipendenze nuove senza il mio ok.** Il progetto è deliberatamente
  leggero: nessuna libreria di charting, nessuna libreria di animazione, i
  grafici sono SVG/CSS scritti a mano. Vale ancora.
- **Regressioni visive**: chi tocca `Andamento.tsx` (767 righe, il file più
  delicato) descrive nella PR quali dei sette blocchi ha toccato — gauge,
  confronto, proiezione, anelli categoria, sparkline, in evidenza, macchina
  del tempo.

---

## 5. Stato del progetto e priorità

| Fase | Stato | Proprietario |
|---|---|---|
| 1 — UI su dati mock | ✅ fatta | UI Expert + UI Developer |
| 2 — collegamento ai dati reali | ⏳ server pronto, client ancora su mock | Backend & Deploy |
| 3 — Comando Rapido + vista di dettaglio | ❌ da fare | Shortcuts + UI Developer |
| 4 — integrazione fru-pass | 🆕 da definire | vedi §6 |

Ordine consigliato: **la Fase 2 sblocca tutto il resto.** Il Comando Rapido
non ha senso finché il client legge dal `localStorage`, e la vista di
dettaglio è più veloce da fare quando i dati sono già veri. Quindi:

1. Backend & Deploy: `USE_MOCK = false`, hosting del server, API key gestita
   dal client, sync fra dispositivi.
2. Shortcuts: Comando Rapido reale + sezione Impostazioni con URL e API key
   copiabili (oggi placeholder disabilitato).
3. UI Expert → UI Developer: vista di dettaglio del singolo movimento.

---

## 6. Integrazione fru-pass

**Stato: in attesa della guida fru-pass.** Non progetto l'integrazione a
scatola chiusa: appena ricevo il documento aggiorno questa sezione con
l'assegnazione dei task.

Quello che mi serve sapere dalla guida, per poter instradare:

- **Cos'è fru-pass rispetto a tappy** — un provider di identità/login, un
  wallet/fonte di transazioni, o entrambi?
- **Superficie di integrazione**: API REST, OAuth, webhook, SDK, file?
- **Autenticazione**: chi possiede l'utente? Se fru-pass fa da login, l'attuale
  `api_key` in `users` diventa un dettaglio interno e cambia `db.ts` — ed è una
  modifica in zona condivisa.
- **Direzione dei dati**: tappy legge da fru-pass, ci scrive, o si sincronizza
  nei due sensi? Da questo dipende se è un task del solo Backend & Deploy o
  anche dello Shortcuts (se fru-pass può sostituire il parsing della notifica).

Ipotesi di instradamento, da confermare: se fru-pass è **identità/dati**, il
grosso è Backend & Deploy con un task UI a valle per il login; se è una
**fonte di transazioni**, potrebbe rendere superfluo il Comando Rapido e va
deciso *prima* di costruirlo — motivo in più per non partire con la Fase 3
finché la guida non è sul tavolo.
