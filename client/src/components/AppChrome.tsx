// Header e "dock" (navigazione + footer) dell'app.
//
// Due scelte di impaginazione che vengono dalla spec F4 e non vanno disfatte
// senza rifarne il ragionamento:
//
// - il nome utente NON sta nell'header: con i tre controlli richiesti
//   dall'ecosistema farebbero quattro elementi in `max-w-md`, troppi.
//   L'identità (il codice Fru Pass) si legge in Impostazioni → Accesso;
// - footer e navigazione sono **un blocco solo**: due barre fisse in basso su
//   iPhone mangiano un quarto dello schermo e competono per la stessa area
//   del pollice. La riga con marchio e versione sta sotto la nav, nella
//   fascia dell'home indicator.
import type { ReactNode } from "react";
import { useApp } from "../lib/AppContext";
import { FRUPASS_HUB_URL, FruPassMark } from "./FruPass";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
      <circle cx="12" cy="12" r="4.2" strokeWidth={1.8} />
      <path
        strokeLinecap="round"
        strokeWidth={1.8}
        d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4L17 7M7 17l-1.6 1.6"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M20 13.4A8.2 8.2 0 1110.6 4a6.6 6.6 0 009.4 9.4z"
      />
    </svg>
  );
}

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.8}
        d="M3.5 10.5L12 4l8.5 6.5V19a1.5 1.5 0 01-1.5 1.5h-3.5V14h-7v6.5H5A1.5 1.5 0 013.5 19z"
      />
    </svg>
  );
}

export function Header({
  scrolled = false,
  sezione,
}: {
  scrolled?: boolean;
  /** Nome della tab attiva, in grigio accanto al wordmark. */
  sezione?: string;
}) {
  const { effectiveTheme, setTheme } = useApp();
  const scuro = effectiveTheme === "dark";

  return (
    <header
      className={`sticky top-0 z-20 px-5 pb-2 flex items-center justify-between border-b transition-all duration-300
                 bg-base/80 dark:bg-base-dark/80 backdrop-blur-xl ${
                   scrolled ? "border-black/5 dark:border-white/10" : "border-transparent"
                 }`}
      style={{
        paddingTop: scrolled
          ? "max(0.75rem, env(safe-area-inset-top))"
          : "max(1.5rem, calc(env(safe-area-inset-top) + 0.5rem))",
      }}
    >
      <h1
        className={`font-bold tracking-tight flex items-baseline gap-2 min-w-0 transition-all duration-300 ${
          scrolled ? "text-callout" : "text-title2"
        }`}
      >
        <span className="shrink-0">
          tap<span className="text-acc-green">py</span>
        </span>
        {sezione ? (
          <span className="font-medium text-muted/55 dark:text-muted-dark/55 truncate text-callout">
            {sezione}
          </span>
        ) : null}
      </h1>

      <div className="flex items-center gap-3 text-muted dark:text-muted-dark">
        <button
          onClick={() => setTheme(scuro ? "light" : "dark")}
          aria-label={scuro ? "Passa al tema chiaro" : "Passa al tema scuro"}
          className="p-1.5 -m-1.5 active:scale-90 transition-transform"
        >
          {scuro ? <MoonIcon /> : <SunIcon />}
        </button>

        <a
          href={FRUPASS_HUB_URL}
          target="_self"
          aria-label="Torna a Fru Pass"
          className="p-1.5 -m-1.5 active:scale-90 transition-transform"
        >
          <HomeIcon />
        </a>

        <FruPassMark className="opacity-60" />
      </div>
    </header>
  );
}

export function Dock({ children }: { children: ReactNode }) {
  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-20 pointer-events-none"
      style={{ paddingBottom: "max(1rem, calc(env(safe-area-inset-bottom) + 0.5rem))" }}
    >
      <div
        className="absolute inset-x-0 bottom-0 -top-6 bg-gradient-to-t
                   from-base via-base to-transparent
                   dark:from-base-dark dark:via-base-dark"
      />
      <div className="relative max-w-md mx-auto px-4 pointer-events-auto">{children}</div>
    </div>
  );
}

export function PieDiPagina() {
  return (
    <div className="flex flex-col items-center gap-0.5 pt-6 pb-2 text-muted dark:text-muted-dark">
      <FruPassMark className="opacity-60" />
      <span className="text-caption tabular-nums opacity-70">{__APP_VERSION__}</span>
    </div>
  );
}
