// Dettaglio di un singolo movimento: quello che la lista non ha spazio per
// dire, più le due azioni che richiedono di vedere prima cosa si sta toccando
// — modificare, e togliere la posizione.
import { useState } from "react";
import { api } from "../lib/api";
import { useApp } from "../lib/AppContext";
import type { Transaction } from "../lib/types";

function Riga({ etichetta, children }: { etichetta: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5 border-b border-black/5 dark:border-white/10 last:border-0">
      <span className="text-xs text-muted dark:text-muted-dark shrink-0">{etichetta}</span>
      <span className="text-sm text-right min-w-0 break-words">{children}</span>
    </div>
  );
}

export default function DettaglioMovimento({
  movimento,
  onModifica,
  onChiudi,
}: {
  movimento: Transaction;
  onModifica: () => void;
  onChiudi: () => void;
}) {
  const { categories, cards, refreshTransactions } = useApp();
  const [t, setT] = useState(movimento);
  const [rimuovendo, setRimuovendo] = useState(false);
  const [conferma, setConferma] = useState(false);

  const categoria = categories.find((c) => c.id === t.category_id);
  const carta = t.card_id ? cards.find((c) => c.id === t.card_id) : null;
  const diviso = !t.is_income && t.my_share !== t.amount;
  const haPosizione = t.lat != null && t.lon != null;

  async function rimuoviPosizione() {
    setRimuovendo(true);
    try {
      // null cancella il campo: il backend distingue "non toccare" (undefined)
      // da "svuota" (null).
      await api.updateTransaction(t.id, { lat: null, lon: null });
      setT({ ...t, lat: null, lon: null });
      await refreshTransactions();
    } finally {
      setRimuovendo(false);
      setConferma(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-base dark:bg-base-dark">
      <header
        className="px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "max(1.5rem, calc(env(safe-area-inset-top) + 0.5rem))" }}
      >
        <button
          onClick={onChiudi}
          aria-label="Chiudi"
          className="h-8 w-8 -ml-1 flex items-center justify-center rounded-full text-muted dark:text-muted-dark active:scale-90 transition-transform"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M15 18l-6-6 6-6" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold truncate">{t.name}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-4 pb-6 flex flex-col gap-4">
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 text-center">
          <div className={`text-3xl font-bold tabular-nums ${t.is_income ? "text-neon-green" : ""}`}>
            {t.is_income ? "+" : "-"}€{t.my_share.toFixed(2)}
          </div>
          {diviso && (
            <p className="text-xs text-muted dark:text-muted-dark mt-1">
              la tua quota di €{t.amount.toFixed(2)}
            </p>
          )}
        </div>

        <div className="rounded-2xl bg-surface dark:bg-surface-dark px-4 py-1">
          <Riga etichetta="Data">
            {t.date}
            {t.time ? ` · ${t.time}` : ""}
          </Riga>
          <Riga etichetta="Categoria">
            <span style={{ color: categoria?.color }}>{categoria?.name ?? "—"}</span>
          </Riga>
          <Riga etichetta="Carta">{carta?.name ?? "—"}</Riga>
          <Riga etichetta="Origine">
            {t.source === "applepay" ? "Apple Pay" : "Inserita a mano"}
          </Riga>
          {t.note && <Riga etichetta="Nota">{t.note}</Riga>}
        </div>

        <div className="rounded-2xl bg-surface dark:bg-surface-dark px-4 py-1">
          <Riga etichetta="Posizione">
            {haPosizione ? (
              <a
                href={`https://www.openstreetmap.org/?mlat=${t.lat}&mlon=${t.lon}#map=17/${t.lat}/${t.lon}`}
                target="_blank"
                rel="noreferrer"
                className="underline decoration-dotted tabular-nums"
              >
                {t.lat!.toFixed(5)}, {t.lon!.toFixed(5)}
              </a>
            ) : (
              <span className="text-muted dark:text-muted-dark">nessuna</span>
            )}
          </Riga>
        </div>

        {haPosizione && (
          // La cancellazione della sola posizione è la contropartita di
          // registrarla: deve essere raggiungibile qui, non sepolta altrove.
          <div className="flex flex-col gap-2">
            {!conferma ? (
              <button
                onClick={() => setConferma(true)}
                className="text-sm text-muted dark:text-muted-dark rounded-xl bg-surface dark:bg-surface-dark py-2.5"
              >
                Rimuovi la posizione
              </button>
            ) : (
              <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
                <p className="text-sm">
                  Il movimento resta, ma sparisce dalla mappa. Non si può annullare.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setConferma(false)}
                    className="flex-1 text-sm rounded-xl bg-surface2 dark:bg-surface2-dark py-2"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={rimuoviPosizione}
                    disabled={rimuovendo}
                    className="flex-1 text-sm rounded-xl bg-neon-pink/15 text-neon-pink py-2 disabled:opacity-50"
                  >
                    {rimuovendo ? "Rimuovo…" : "Rimuovi"}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        <button
          onClick={onModifica}
          className="rounded-xl bg-ink dark:bg-white text-white dark:text-black text-sm font-medium py-2.5"
        >
          Modifica
        </button>
      </div>
    </div>
  );
}
