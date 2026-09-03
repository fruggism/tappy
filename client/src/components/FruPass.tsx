// Gli elementi "ospiti" dell'ecosistema Fru Pass dentro l'interfaccia di
// tappy. Sono gli unici, e vanno trattati come una firma discreta, non come
// un co-brand: monocromatici su currentColor, piccoli, senza sfondo né bordo
// che li trasformi in bottoni. Vedi design/F4-login-header-footer.md §3.

/**
 * URL dell'hub Fru Pass, aperto dall'icona "casa" nell'header.
 * Ancora da comunicare dall'amministratore: quando arriva si cambia solo
 * questa riga (vedi RELEASE-HUB.md §1a).
 */
export const FRUPASS_HUB_URL = "https://frupass-user.netlify.app/";

/**
 * Marchio Fru Pass. Oggi è un **segnaposto testuale** con lo stesso ingombro
 * del logo definitivo: quando arriva l'SVG monocromatico
 * (`client/public/frupass.svg`, `fill="currentColor"`) si sostituisce il
 * contenuto di questo componente e basta — i tre punti in cui compare non si
 * toccano. Vedi RELEASE-HUB.md §1b.
 */
export function FruPassMark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-label="Fru Pass"
      className={
        "inline-flex items-center rounded-md border border-current/30 px-1 py-0.5 " +
        "text-caption font-semibold leading-none tracking-[0.15em] " +
        className
      }
    >
      FRU
    </span>
  );
}
