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
  const [copiato, setCopiato] = useState<"url" | "chiave" | null>(null);

  const webhookUrl = `${window.location.origin}${API_BASE}/api/webhook/applepay`;

  async function copia(cosa: "url" | "chiave") {
    await navigator.clipboard.writeText(cosa === "url" ? webhookUrl : user?.api_key ?? "");
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
          Quando paghi con Apple Pay, l&apos;iPhone può mandare la spesa a tappy da solo: importo,
          esercente, carta e — se vuoi — il luogo. Si prepara una volta, in circa dieci minuti, e
          poi non ci pensi più.
        </p>

        <Passo numero={1} titolo="Tieni a portata questi due valori">
          <p>
            Servono nell&apos;ultimo passaggio. Puoi copiarli adesso oppure tornare qui quando ti
            serviranno.
          </p>
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
            La chiave vale solo per registrare spese su tappy: non è il tuo codice Fru Pass, e non
            va scambiata con quello.
          </p>
        </Passo>

        <Passo
          numero={2}
          titolo="Crea l'automazione"
          immagine="./guida/1-innesco.jpg"
          didascalia="L'innesco giusto comincia con «Ricevi transazione come input»"
        >
          <p>
            Apri l&apos;app <b>Comandi Rapidi</b> (è già sul tuo iPhone), vai sulla scheda{" "}
            <b>Automazione</b> in basso e tocca <b>+</b> in alto a destra.
          </p>
          <p>
            Nell&apos;elenco degli inneschi cerca quello dei <b>pagamenti con carta</b>. È quello
            giusto se, dopo averlo scelto, la prima riga dice «Ricevi transazione come input»:
            significa che l&apos;iPhone ti passerà da solo importo ed esercente.
          </p>
          <p>
            Scegli <b>Esegui immediatamente</b> e <b>disattiva</b> la richiesta di conferma.
            Altrimenti a ogni pagamento il telefono ti chiede il permesso, e tanto valeva scrivere
            la spesa a mano.
          </p>
        </Passo>

        <Passo
          numero={3}
          titolo="Aggiungi le azioni"
          immagine="./guida/2-azioni.jpg"
          didascalia="Le azioni della posizione, se vuoi vedere dove hai speso"
        >
          <p>Cerca e aggiungi, in quest&apos;ordine:</p>
          <ol className="list-decimal pl-4 flex flex-col gap-1">
            <li>
              <b>Ottieni la posizione attuale</b>
            </li>
            <li>
              <b>Ottieni dettagli dalla posizione</b> → scegli <b>Latitudine</b>
            </li>
            <li>di nuovo lo stesso, scegliendo <b>Longitudine</b></li>
          </ol>
          <p>
            Servono solo per la mappa: se non ti interessa sapere dove hai speso, salta questo
            passo e più avanti ometti i due campi <code>lat</code> e <code>lon</code>.
          </p>
        </Passo>

        <Passo
          numero={4}
          titolo="Aggiungi l'invio a tappy"
          immagine="./guida/3-invio.jpg"
          didascalia="L'automazione completa, prima di sostituire la nota con l'invio"
        >
          <p>
            Cerca l&apos;azione <b>Ottieni contenuti dall&apos;URL</b> e aggiungila per ultima.
            Toccala per aprirla e imposta:
          </p>
          <ul className="list-disc pl-4 flex flex-col gap-1">
            <li>
              <b>URL</b>: l&apos;indirizzo copiato al passo 1
            </li>
            <li>
              <b>Metodo</b>: <code>POST</code>
            </li>
            <li>
              <b>Intestazioni</b>: due righe — <code>Content-Type</code> con valore{" "}
              <code>application/json</code>, e <code>x-api-key</code> con la chiave copiata al
              passo 1
            </li>
            <li>
              <b>Corpo richiesta</b>: <code>JSON</code>, e dentro questi campi
            </li>
          </ul>
          <div className="rounded-2xl bg-surface dark:bg-surface-dark p-3 mt-1 overflow-x-auto">
            <table className="w-full text-left">
              <tbody>
                <Campo nome="amount" tipo="Numero" valore="Importo" />
                <Campo nome="name" tipo="Testo" valore="Esercente" />
                <Campo nome="card" tipo="Testo" valore="Carta o biglietto" />
                <Campo nome="lat" tipo="Numero" valore="Latitudine" />
                <Campo nome="lon" tipo="Numero" valore="Longitudine" />
              </tbody>
            </table>
          </div>
          <p>
            I valori della terza colonna non si scrivono: si scelgono. Tocca il campo e prendili
            dai suggerimenti che compaiono sopra la tastiera.
          </p>
        </Passo>

        <Passo numero={5} titolo="Provala">
          <p>
            Salva, poi apri l&apos;automazione e toccala per eseguirla a mano. Torna in tappy, in{" "}
            <b>Movimenti</b>: se compare una spesa con scritto «Apple Pay», hai finito.
          </p>
          <p>
            Poi fai un pagamento vero, anche da un euro. È l&apos;unico modo di sapere se funziona
            anche col telefono in tasca.
          </p>
        </Passo>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline">Se non funziona</h2>
          <div className="text-callout text-muted dark:text-muted-dark flex flex-col gap-3">
            <p>
              Per capire cosa risponde tappy, aggiungi in fondo all&apos;automazione l&apos;azione{" "}
              <b>Mostra notifica</b> e mettici dentro il <b>Contenuto dell&apos;URL</b>. Poi
              rieseguila: la notifica ti dice cosa è andato storto.
            </p>
            <ul className="flex flex-col gap-2">
              <li>
                <b className="text-ink dark:text-ink-dark">«invalid api key»</b> — la chiave è
                sbagliata o incollata a metà. Ricopiala dal passo 1.
              </li>
              <li>
                <b className="text-ink dark:text-ink-dark">«amount and name required»</b> —
                l&apos;importo non è arrivato come numero. Prima dell&apos;invio aggiungi
                un&apos;azione <b>Sostituisci testo</b> che tolga il simbolo dell&apos;euro, e una
                che cambi la virgola in punto.
              </li>
              <li>
                <b className="text-ink dark:text-ink-dark">Nessuna risposta</b> — l&apos;indirizzo
                è sbagliato, o il telefono è senza rete.
              </li>
            </ul>
            <p>
              Quando funziona, togli la notifica: l&apos;automazione deve essere silenziosa.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-headline">Si può passare a qualcun altro?</h2>
          <div className="text-callout text-muted dark:text-muted-dark flex flex-col gap-2">
            <p>
              Le automazioni no: iPhone non permette di esportarle, e ognuno deve creare la propria
              — è il passo 2, un minuto.
            </p>
            <p>
              Le <b>azioni</b> sì. Puoi raccoglierle in un <b>comando rapido</b> a parte,
              condividerlo con un link iCloud, e poi far creare a ciascuno un&apos;automazione con
              dentro una sola azione: «Esegui comando rapido». Restano da fare i passi 1 e 2.
            </p>
            <p className="text-footnote">
              Attenzione se lo condividi: la <b>chiave</b> resta scritta dentro, e chi ce l&apos;ha
              può registrare spese sul tuo tappy. Prima di passarlo a qualcuno, svuota quel campo e
              digli di metterci la sua.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
