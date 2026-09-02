// Schermata di accesso Fru Pass. Compare solo quando non c'è né un codice
// nell'URL né una sessione salvata: chi arriva dall'hub non deve vederla
// nemmeno per un fotogramma (vedi App.tsx).
import { useState } from "react";
import { FruPassMark } from "../components/FruPass";
import { useApp } from "../lib/AppContext";
import { FruPassUnreachable, formatCodeInput, isCompleteCode } from "../lib/frupass";

export default function Login() {
  const { login } = useApp();
  // Nel campo si digitano solo le 8 cifre: il prefisso "FRU-" è testo statico
  // a sinistra, così non è cancellabile e il cursore non ci finisce dentro.
  const [cifre, setCifre] = useState("");
  const [errore, setErrore] = useState<string | null>(null);
  // Un errore dell'ecosistema non è colpa dell'utente: niente rosa, niente
  // scossa, e il codice resta probabilmente giusto.
  const [colpaNostra, setColpaNostra] = useState(false);
  const [inCorso, setInCorso] = useState(false);
  const [scuote, setScuote] = useState(false);

  const codice = formatCodeInput(cifre);
  const completo = isCompleteCode(codice);

  async function accedi() {
    if (!completo || inCorso) return;
    setInCorso(true);
    setErrore(null);
    try {
      await login(codice);
    } catch (err) {
      const irraggiungibile = err instanceof FruPassUnreachable;
      setColpaNostra(!irraggiungibile);
      setErrore(
        irraggiungibile
          ? "Fru Pass non risponde, riprova tra poco"
          : err instanceof Error
            ? err.message
            : "Accesso non riuscito"
      );
      // Il testo NON si cancella: chi ha sbagliato un carattere lo corregge.
      if (!irraggiungibile) {
        setScuote(true);
        setTimeout(() => setScuote(false), 300);
      }
    } finally {
      setInCorso(false);
    }
  }

  return (
    <div
      className="h-full flex items-center justify-center px-6 animate-rise"
      style={{
        paddingTop: "calc(env(safe-area-inset-top) + 1rem)",
        paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)",
      }}
    >
      <div className="w-full max-w-sm flex flex-col gap-4">
        <h1 className="text-largeTitle font-bold tracking-tight text-center">
          tap<span className="text-acc-green">py</span>
        </h1>
        <p className="text-callout text-muted dark:text-muted-dark text-center">
          Accedi con il tuo codice Fru Pass, lo stesso che usi nelle altre app.
        </p>

        <div
          className={`flex items-center justify-center gap-0.5 rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-3
            transition-shadow focus-within:ring-2 focus-within:ring-acc-green/60
            ${errore && colpaNostra ? "ring-1 ring-acc-pink/50" : ""}
            ${scuote ? "animate-shake" : ""}
            ${inCorso ? "pointer-events-none opacity-60" : ""}`}
        >
          <span className="text-headline font-medium tracking-[0.2em] text-muted dark:text-muted-dark">
            FRU-
          </span>
          <input
            value={codice.slice(4)}
            onChange={(e) => {
              setCifre(e.target.value);
              setErrore(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && accedi()}
            placeholder="••••-••••"
            autoFocus
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Codice Fru Pass"
            className="w-[11.5ch] bg-transparent outline-none text-headline font-medium tracking-[0.2em]"
          />
        </div>

        {/* Altezza riservata: il bottone non salta quando compare l'errore. */}
        <div className="min-h-[1.25rem] text-footnote text-center">
          {errore && (
            <span className={colpaNostra ? "text-acc-pink" : "text-muted dark:text-muted-dark"}>
              {errore}
            </span>
          )}
        </div>

        <button
          onClick={accedi}
          disabled={inCorso || !completo}
          className="rounded-xl bg-ink dark:bg-white text-white dark:text-black text-callout font-medium
                     py-2.5 disabled:opacity-50"
        >
          {inCorso ? "Verifica…" : "Accedi"}
        </button>

        <div className="mt-6 flex flex-col items-center gap-1 text-muted dark:text-muted-dark">
          <span className="text-caption uppercase tracking-[0.12em] opacity-80">
            parte dell&apos;ecosistema
          </span>
          <FruPassMark className="opacity-60" />
        </div>
      </div>
    </div>
  );
}
