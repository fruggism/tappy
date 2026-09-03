// Istruzioni per aggiungere tappy alla schermata Home.
//
// Non c'è un modo unico: su iPhone il browser non espone alcun invito
// all'installazione e va fatto a mano dal menu Condividi; su Android il
// browser propone un invito che si può intercettare. Le due strade sono
// diverse davvero, quindi si mostra quella giusta invece di un testo generico
// che vale per entrambe e non aiuta nessuno.
import { useEffect, useState } from "react";

interface EventoInstallazione extends Event {
  prompt: () => Promise<void>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Già aperta dalla schermata Home: non ha senso proporre di installarla. */
function giaInstallata() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export default function InstallaApp() {
  const [aperto, setAperto] = useState(false);
  const [invito, setInvito] = useState<EventoInstallazione | null>(null);
  const [installata, setInstallata] = useState(giaInstallata);

  useEffect(() => {
    const onInvito = (e: Event) => {
      e.preventDefault();
      setInvito(e as EventoInstallazione);
    };
    const onInstallata = () => setInstallata(true);
    window.addEventListener("beforeinstallprompt", onInvito);
    window.addEventListener("appinstalled", onInstallata);
    return () => {
      window.removeEventListener("beforeinstallprompt", onInvito);
      window.removeEventListener("appinstalled", onInstallata);
    };
  }, []);

  if (installata) return null;

  async function installa() {
    if (!invito) return;
    await invito.prompt();
    setInvito(null);
    setAperto(false);
  }

  return (
    <>
      <button
        onClick={() => (invito ? installa() : setAperto(true))}
        className="rounded-xl bg-surface dark:bg-surface-dark text-sm py-2.5 w-full"
      >
        Installa app
      </button>

      {aperto && (
        <div
          className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm"
          onClick={() => setAperto(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-base dark:bg-base-dark p-5 flex flex-col gap-3 animate-rise"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-semibold">Aggiungi tappy alla Home</h2>

            {isIOS() ? (
              <ol className="text-sm text-muted dark:text-muted-dark flex flex-col gap-2 list-decimal pl-4">
                <li>
                  Tocca il pulsante <b>Condividi</b> nella barra di Safari — il quadrato con la
                  freccia verso l&apos;alto.
                </li>
                <li>
                  Scorri e scegli <b>Aggiungi a Home</b>.
                </li>
                <li>
                  Conferma con <b>Aggiungi</b>: tappy compare fra le app, e si apre a tutto
                  schermo.
                </li>
              </ol>
            ) : (
              <ol className="text-sm text-muted dark:text-muted-dark flex flex-col gap-2 list-decimal pl-4">
                <li>
                  Apri il menu del browser — i tre puntini in alto a destra.
                </li>
                <li>
                  Scegli <b>Installa app</b> (o <b>Aggiungi a schermata Home</b>).
                </li>
                <li>Conferma: tappy compare fra le app.</li>
              </ol>
            )}

            <p className="text-xs text-muted dark:text-muted-dark">
              Funziona solo da Safari su iPhone: se stai leggendo in un altro browser, apri prima
              questo indirizzo lì.
            </p>

            <button
              onClick={() => setAperto(false)}
              className="mt-1 rounded-xl bg-ink dark:bg-white text-white dark:text-black text-sm font-medium py-2.5"
            >
              Ho capito
            </button>
          </div>
        </div>
      )}
    </>
  );
}
