// Schermata aggiuntiva: sta nella colonna max-w-md, non `fixed` sul viewport.
// L'header resta sopra le lastre (form). Una pagina (mappa, dettaglio) sale
// sopra header e dock, altrimenti su iPhone sembra che non si sia aperta.
// La vista sotto resta montata: chiudere un foglio non azzera lo scroll.
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";

const Slot = createContext<{
  host: HTMLDivElement | null;
  setPagina: (aperta: boolean) => void;
}>({ host: null, setPagina: () => {} });

export function FoglioRoot({ children }: { children: ReactNode }) {
  const [nodo, setNodo] = useState<HTMLDivElement | null>(null);
  const [pagina, setPagina] = useState(false);
  return (
    <Slot.Provider value={{ host: nodo, setPagina }}>
      <div className="relative h-full min-h-0 flex flex-col">
        {children}
        <div
          ref={setNodo}
          className={`absolute inset-0 pointer-events-none ${pagina ? "z-50" : "z-30"}`}
        />
      </div>
    </Slot.Provider>
  );
}

export function BarraFoglio({
  titolo,
  sotto,
  onChiudi,
}: {
  titolo: string;
  sotto?: string;
  onChiudi: () => void;
}) {
  return (
    <header className="px-4 py-3 flex items-center gap-3 shrink-0">
      <button
        type="button"
        onClick={onChiudi}
        aria-label="Chiudi"
        className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full text-muted dark:text-muted-dark active:scale-90 transition-transform"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div className="min-w-0">
        <h1 className="text-headline font-semibold truncate leading-tight">{titolo}</h1>
        {sotto ? (
          <p className="text-footnote text-muted dark:text-muted-dark truncate">{sotto}</p>
        ) : null}
      </div>
    </header>
  );
}

export default function Foglio({
  children,
  onChiudi,
  lastra = false,
}: {
  children: ReactNode;
  onChiudi: () => void;
  /** Foglio dal basso (form). Copre la pulsantiera, non l'header. */
  lastra?: boolean;
}) {
  const { host, setPagina } = useContext(Slot);

  useLayoutEffect(() => {
    if (lastra) return;
    setPagina(true);
    return () => setPagina(false);
  }, [lastra, setPagina]);

  const corpo = lastra ? (
    <div className="absolute inset-0 pointer-events-auto flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label="Chiudi"
        onClick={onChiudi}
      />
      <div
        className="relative rounded-t-3xl bg-base dark:bg-base-dark max-h-[92%] overflow-y-auto animate-sheet shadow-xl"
        style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/10 dark:bg-white/15" />
        {children}
      </div>
    </div>
  ) : (
    <div className="absolute inset-0 pointer-events-auto bg-base dark:bg-base-dark flex flex-col overflow-hidden animate-rise">
      {children}
    </div>
  );

  if (!host) return corpo;
  return createPortal(corpo, host);
}
