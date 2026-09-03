// Guida in-app per costruire l'automazione, scritta per chi non l'ha mai
// fatto. Vive dentro l'app e non in un file del repository perché il momento
// in cui serve è questo: hai l'URL e la chiave sotto gli occhi, e il telefono
// in mano.
import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { API_BASE } from "../lib/realApi";

function Passo({
  numero,
  titolo,
  children,
  immagine,
  didascalia,
}: {
  numero: number;
  titolo: string;
  children: React.ReactNode;
  immagine?: string;
  didascalia?: string;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-baseline gap-2 text-headline">
        <span className="text-acc-green tabular-nums">{numero}</span>
        {titolo}
      </h2>
      <div className="text-callout text-muted dark:text-muted-dark flex flex-col gap-2">
        {children}
      </div>
      {immagine && (
        <figure className="flex flex-col gap-1.5 mt-1">
          <img
            src={immagine}
            alt={didascalia ?? ""}
            loading="lazy"
            className="w-full rounded-2xl border border-black/5 dark:border-white/10"
          />
          {didascalia && (
            <figcaption className="text-caption text-muted dark:text-muted-dark text-center">
              {didascalia}
            </figcaption>
          )}
        </figure>
      )}
    </section>
  );
}

function Campo({ nome, tipo, valore }: { nome: string; tipo: string; valore: string }) {
  return (
    <tr className="border-b border-black/5 dark:border-white/10 last:border-0">
      <td className="py-1.5 pr-2 font-mono text-footnote">{nome}</td>
      <td className="py-1.5 pr-2 text-footnote text-muted dark:text-muted-dark">{tipo}</td>
      <td className="py-1.5 text-footnote">{valore}</td>
    </tr>
  );
}

export default function GuidaAutomazione({ onChiudi }: { onChiudi: () => void }) {
  const { user } = useApp();
  const [copiato, setCopiato] = useState<"url" | "chiave" | "posizione" | null>(null);

  const webhookUrl = `${window.location.origin}${API_BASE}/api/webhook/applepay`;
  const posizioneUrl = `${webhookUrl}/posizione`;

  async function copia(cosa: "url" | "chiave" | "posizione") {
    const testo =
      cosa === "url" ? webhookUrl : cosa === "posizione" ? posizioneUrl : user?.api_key ?? "";
    await navigator.clipboard.writeText(testo);
    setCopiato(cosa);
    setTimeout(() => setCopiato(null), 1500);
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-base dark:bg-base-dark">
      <header
        className="px-4 pb-3 flex items-center gap-3 border-b border-black/5 dark:border-white/10"
        style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        <button
          onClick={onChiudi}
          aria-label="Chiudi la guida"
          className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full text-muted dark:text-muted-dark active:scale-90 transition-transform"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-headline font-semibold">Registrare le spese da sole</h1>
      </header>

      <div
        className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-7"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 2rem)" }}
      >
        <p className="text-callout">
          Quando paghi con Apple Pay, l&apos;iPhone manda la spesa a tappy da solo. Si prepara una
          volta, in dieci minuti.
        </p>

        <Passo numero={1} titolo="Tieni a portata questi due valori">
          <p>Servono al passo 4. Puoi tornare qui a copiarli.</p>
          <div className="flex flex-col gap-2 mt-1">
            <button
              onClick={() => copia("url")}
              className="rounded-xl bg-surface dark:bg-surface-dark px-3 py-2.5 text-left flex items-center gap-3"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-caption uppercase tracking-wide text-muted dark:text-muted-dark">
                  Indirizzo
                </span>
                <span className="block text-footnote break-all text-ink dark:text-ink-dark">
                  {webhookUrl}
                </span>
              </span>
              <span className="text-footnote text-acc-green shrink-0">
                {copiato === "url" ? "Copiato" : "Copia"}
              </span>
            </button>
            <button
              onClick={() => copia("chiave")}
              className="rounded-xl bg-surface dark:bg-surface-dark px-3 py-2.5 text-left flex items-center gap-3"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-caption uppercase tracking-wide text-muted dark:text-muted-dark">
                  Chiave
                </span>
                <span className="block text-footnote break-all text-ink dark:text-ink-dark">
                  {user?.api_key ?? "non disponibile"}
                </span>
              </span>
              <span className="text-footnote text-acc-green shrink-0">
                {copiato === "chiave" ? "Copiata" : "Copia"}
              </span>
            </button>
          </div>
          <p className="text-footnote">
            La chiave non è il tuo codice Fru Pass: serve solo a registrare spese.
          </p>
        </Passo>

        <Passo
          numero={2}
          titolo="Crea l'automazione"
          immagine="./guida/1-innesco.jpg"
          didascalia="L'innesco giusto, e sotto le due azioni della categoria"
        >
          <ol className="list-decimal pl-4 flex flex-col gap-1.5">
            <li>
              Apri <b>Comandi Rapidi</b> → scheda <b>Automazione</b> → <b>+</b>
            </li>
            <li>
              Scegli l&apos;innesco dei <b>pagamenti con carta</b>
            </li>
            <li>
              Metti <b>Esegui immediatamente</b> e togli la richiesta di conferma
            </li>
          </ol>
          <p>
            È l&apos;innesco giusto se la prima riga dice «Ricevi transazione come input»: vuol
            dire che importo ed esercente arriveranno da soli.
          </p>
        </Passo>

        <Passo numero={3} titolo="Fatti chiedere la categoria">
          <p>Due azioni, se vuoi scegliere la categoria al volo:</p>
          <ol className="list-decimal pl-4 flex flex-col gap-1">
            <li>
              <b>Elenco</b> → scrivi i nomi delle tue categorie, uno per riga
            </li>
            <li>
              <b>Scegli da Elenco</b> → <b>Titolo</b>: <code>scegli categoria</code>, selezione
              multipla spenta
            </li>
          </ol>
          <p>
            Se salti questo passo la spesa finisce in <i>Altro</i>, e la cambi dall&apos;app.
          </p>
        </Passo>

        <Passo
          numero={4}
          titolo="Aggiungi l'invio a tappy"
          immagine="./guida/3-invio.jpg"
          didascalia="L'azione dell'URL aperta con «Mostra altro»"
        >
          <p>
            Aggiungi l&apos;azione <b>Ottieni contenuti dall&apos;URL</b>, poi tocca{" "}
            <b className="text-ink dark:text-ink-dark">Mostra altro</b>: senza, gli altri campi
            restano nascosti.
          </p>
          <ul className="list-disc pl-4 flex flex-col gap-1">
            <li>
              <b>URL</b>: l&apos;indirizzo copiato al passo 1
            </li>
            <li>
              <b>Metodo</b>: <code>POST</code>
            </li>
            <li>
              <b>Intestazioni</b>: <code>Content-Type</code> → <code>application/json</code>, e{" "}
              <code>x-api-key</code> → la chiave del passo 1
            </li>
            <li>
              <b>Corpo richiesta</b>: <code>JSON</code>, con questi campi
            </li>
          </ul>
          <div className="rounded-2xl bg-surface dark:bg-surface-dark p-3 mt-1 overflow-x-auto">
            <table className="w-full text-left">
              <tbody>
                <Campo nome="amount" tipo="Numero" valore="Importo" />
                <Campo nome="name" tipo="Testo" valore="Esercente" />
                <Campo nome="card" tipo="Testo" valore="Carta o biglietto" />
                <Campo nome="category" tipo="Testo" valore="Elemento selezionato" />
                </tbody>
            </table>
          </div>
          <p>
            Ogni riga si aggiunge con <b>Aggiungi nuovo campo</b>: scegli il tipo, scrivi il nome,
            tocca il valore.
          </p>
          <p>
            I valori <b>non si scrivono</b>: si scelgono dalla barra che compare sopra la
            tastiera.
          </p>
        </Passo>

        <Passo
          numero={5}
          titolo="La posizione, per ultima"
          immagine="./guida/2-posizione.jpg"
          didascalia="Precisione «Ottimale», poi latitudine e longitudine"
        >
          <p className="text-ink dark:text-ink-dark">
            Va <b>dopo</b> l&apos;invio, non prima. Se iOS nega la posizione — e a telefono
            bloccato può farlo — l&apos;azione va in errore e l&apos;automazione si ferma lì: messa
            prima ti farebbe perdere la spesa, messa dopo la spesa è già registrata e perdi solo il
            luogo.
          </p>
          <p>Aggiungi, in quest&apos;ordine:</p>
          <ol className="list-decimal pl-4 flex flex-col gap-1">
            <li>
              <b>Ottieni valore da dizionario</b> → <b>Ottieni</b> <code>id</code> da{" "}
              <b>Contenuti URL</b> (è la risposta del passo 4)
            </li>
            <li>
              <b>Ottieni la posizione attuale</b> → <b>Precisione</b>: <b>Ottimale</b>
            </li>
            <li>
              <b>Ottieni dettagli dalla posizione</b> → <b>Latitudine</b>
            </li>
            <li>di nuovo lo stesso, scegliendo <b>Longitudine</b></li>
            <li>
              un secondo <b>Ottieni contenuti dall&apos;URL</b>, uguale al primo ma con
              l&apos;indirizzo qui sotto
            </li>
          </ol>
          <button
            onClick={() => copia("posizione")}
            className="rounded-xl bg-surface dark:bg-surface-dark px-3 py-2.5 text-left flex items-center gap-3 mt-1"
          >
            <span className="flex-1 min-w-0">
              <span className="block text-caption uppercase tracking-wide text-muted dark:text-muted-dark">
                Indirizzo della posizione
              </span>
              <span className="block text-footnote break-all text-ink dark:text-ink-dark">
                {posizioneUrl}
              </span>
            </span>
            <span className="text-footnote text-acc-green shrink-0">
              {copiato === "posizione" ? "Copiato" : "Copia"}
            </span>
          </button>
          <p>
            Stesso metodo <code>POST</code>, stesse intestazioni, e tre campi nel corpo:
          </p>
          <div className="rounded-2xl bg-surface dark:bg-surface-dark p-3 mt-1 overflow-x-auto">
            <table className="w-full text-left">
              <tbody>
                <Campo nome="id" tipo="Testo" valore="il valore del dizionario" />
                <Campo nome="lat" tipo="Numero" valore="Latitudine" />
                <Campo nome="lon" tipo="Numero" valore="Longitudine" />
              </tbody>
            </table>
          </div>
          <p>
            Se la mappa non ti interessa, salta tutto il passo: l&apos;automazione finisce al 4 ed è
            più corta.
          </p>
        </Passo>

        <Passo
          numero={6}
          titolo="La nota non serve"
          immagine="./guida/4-nota.jpg"
          didascalia="Le due azioni della nota: facoltative, si possono togliere"
        >
          <p className="text-ink dark:text-ink-dark">
            Le azioni <b>Testo</b> e <b>Aggiungi a nota</b> non sono necessarie: tappy registra la
            spesa lo stesso. Servivano solo a tenere un doppione durante le prove.
          </p>
          <p>
            Se le vuoi comunque, la nota va <b>creata prima nell&apos;app Note</b> (per esempio
            «Spese Apple Pay»): se non esiste, l&apos;azione non trova dove scrivere e
            l&apos;automazione si ferma lì.
          </p>
          <p>
            Solo in quel caso serve anche <b>Formatta data</b> (visibile al passo 4): è la data
            che finisce nel testo della nota, non nel movimento.
          </p>
        </Passo>

        <Passo numero={7} titolo="Provala">
          <p className="text-ink dark:text-ink-dark">
            Eseguendola a mano importo ed esercente arrivano <b>vuoti</b>: non c&apos;è nessun
            pagamento da cui prenderli. È normale.
          </p>
          <p>Per provare comunque, scrivi per un attimo dei valori fissi:</p>
          <ul className="list-disc pl-4 flex flex-col gap-1">
            <li>
              <code>amount</code> → <b>1</b>
            </li>
            <li>
              <code>name</code> → <b>Prova</b>
            </li>
          </ul>
          <p>
            Se in <b>Movimenti</b> compare «Prova» da 1 €, funziona tutto: rimetti le variabili{" "}
            <i>Importo</i> ed <i>Esercente</i>.
          </p>
          <p>Poi fai un pagamento vero, anche da un euro.</p>
        </Passo>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline">Se non funziona</h2>
          <div className="text-callout text-muted dark:text-muted-dark flex flex-col gap-3">
            <p>
              Aggiungi in fondo l&apos;azione <b>Mostra notifica</b> con dentro i{" "}
              <b>Contenuti URL</b> (è l&apos;ultima dell&apos;immagine qui sopra): ti mostra la
              risposta di tappy.
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <b className="text-ink dark:text-ink-dark">«invalid api key»</b> — la chiave è
                sbagliata o incollata a metà. Ricopiala dal passo 1.
              </li>
              <li>
                <b className="text-ink dark:text-ink-dark">«amount and name required»</b> —
                l&apos;importo non è un numero. Aggiungi prima una <b>Sostituisci testo</b> che
                tolga il simbolo €, e una che cambi la virgola in punto.
              </li>
              <li>
                <b className="text-ink dark:text-ink-dark">Nessuna risposta</b> — l&apos;indirizzo
                è sbagliato, o il telefono è senza rete.
              </li>
            </ul>
            <p>Quando funziona, togli la notifica.</p>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline">Si può passare a qualcun altro?</h2>
          <div className="text-callout text-muted dark:text-muted-dark flex flex-col gap-2">
            <p>
              Le automazioni no: iPhone non permette di esportarle. Ognuno deve creare la propria —
              è il passo 2, un minuto.
            </p>
            <p>
              Le <b>azioni</b> sì: si raccolgono in un <b>comando rapido</b> a parte, condivisibile
              con un link iCloud. Poi ciascuno crea un&apos;automazione con dentro una sola azione,
              «Esegui comando rapido».
            </p>
            <p className="text-footnote">
              Prima di condividerlo, svuota il campo della <b>chiave</b>: chi ce l&apos;ha può
              registrare spese sul tuo tappy.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
