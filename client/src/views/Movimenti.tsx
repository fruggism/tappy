import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";
import TransactionModal from "../components/TransactionModal";
import SegmentedControl from "../components/SegmentedControl";
import SpendingClock from "../components/SpendingClock";
// Leaflet pesa quanto mezza app: si carica quando si apre la mappa, non
// all'avvio di chi non la aprirà mai.
const Mappa = lazy(() => import("./Mappa"));
const Dettaglio = lazy(() => import("./DettaglioMovimento"));
import type { Transaction } from "../lib/types";

type Sort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

const SORT_OPTIONS: { value: Sort; label: string }[] = [
  { value: "date_desc", label: "Data ↓" },
  { value: "date_asc", label: "Data ↑" },
  { value: "amount_desc", label: "€ ↓" },
  { value: "amount_asc", label: "€ ↑" },
];

function monthFromOffset(offset: number) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() + offset, 1);
}

function dayLabel(iso: string, today: string, yesterday: string) {
  if (iso === today) return "Oggi";
  if (iso === yesterday) return "Ieri";
  const label = new Date(`${iso}T00:00:00`).toLocaleDateString("it-IT", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function RowMenu({
  onEdit,
  onDelete,
}: {
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        aria-label="Altre azioni"
        className="h-7 w-7 -mr-1 flex items-center justify-center rounded-full text-muted dark:text-muted-dark hover:bg-black/5 dark:hover:bg-white/10"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
          <circle cx="5" cy="12" r="1.6" />
          <circle cx="12" cy="12" r="1.6" />
          <circle cx="19" cy="12" r="1.6" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-8 z-10 w-40 rounded-2xl bg-surface dark:bg-surface-dark shadow-xl border border-black/5 dark:border-white/10 overflow-hidden animate-rise"
        >
          <button
            onClick={() => {
              setOpen(false);
              onEdit();
            }}
            className="w-full text-left px-4 py-2.5 text-callout hover:bg-black/5 dark:hover:bg-white/10"
          >
            Modifica
          </button>
          <button
            onClick={() => {
              setOpen(false);
              onDelete();
            }}
            className="w-full text-left px-4 py-2.5 text-callout text-acc-pink hover:bg-black/5 dark:hover:bg-white/10"
          >
            Elimina
          </button>
        </div>
      )}
    </div>
  );
}

export default function Movimenti() {
  const { transactions, categories, cards, refreshTransactions } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [dettaglio, setDettaglio] = useState<Transaction | null>(null);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [sort, setSort] = useState<Sort>("date_desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [monthOffset, setMonthOffset] = useState(0);

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const monthPrefix = useMemo(() => {
    const m = monthFromOffset(monthOffset);
    return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`;
  }, [monthOffset]);

  const filtered = useMemo(() => {
    let list = transactions.filter((t) => t.date.startsWith(monthPrefix));
    if (categoryFilter !== "all") list = list.filter((t) => t.category_id === categoryFilter);
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case "date_desc":
          return (b.date + (b.time ?? "")).localeCompare(a.date + (a.time ?? ""));
        case "date_asc":
          return (a.date + (a.time ?? "")).localeCompare(b.date + (b.time ?? ""));
        case "amount_desc":
          return b.my_share - a.my_share;
        case "amount_asc":
          return a.my_share - b.my_share;
      }
    });
    return sorted;
  }, [transactions, sort, categoryFilter, monthPrefix]);

  const groups = useMemo(() => {
    const today = new Date();
    const todayISO = today.toISOString().slice(0, 10);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayISO = yesterday.toISOString().slice(0, 10);

    const list: { date: string; label: string; items: Transaction[] }[] = [];
    for (const t of filtered) {
      const last = list[list.length - 1];
      if (last && last.date === t.date) {
        last.items.push(t);
      } else {
        list.push({ date: t.date, label: dayLabel(t.date, todayISO, yesterdayISO), items: [t] });
      }
    }
    return list;
  }, [filtered]);

  async function handleDelete(id: string) {
    await api.deleteTransaction(id);
    await refreshTransactions();
  }

  if (dettaglio) {
    return (
      <Suspense fallback={null}>
        <Dettaglio
          movimento={dettaglio}
          onChiudi={() => setDettaglio(null)}
          onModifica={() => {
            setEditing(dettaglio);
            setDettaglio(null);
            setShowModal(true);
          }}
        />
      </Suspense>
    );
  }

  if (showMap) {
    return (
      <Suspense
        fallback={
          <div className="fixed inset-0 z-30 flex items-center justify-center bg-base dark:bg-base-dark">
            <div className="h-8 w-8 rounded-full border-2 border-acc-green/30 border-t-acc-green animate-spin" />
          </div>
        }
      >
        <Mappa onChiudi={() => setShowMap(false)} />
      </Suspense>
    );
  }

  return (
    <div className="flex flex-col gap-4 animate-rise">
      <SpendingClock offset={monthOffset} onOffsetChange={setMonthOffset} />

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            setEditing(null);
            setShowModal(true);
          }}
          className="flex-1 rounded-2xl bg-ink dark:bg-white text-white dark:text-black font-medium py-3 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
        >
          <span className="text-headline leading-none">+</span> Registra spesa
        </button>
        <button
          onClick={() => setShowMap(true)}
          aria-label="Dove ho speso"
          className="h-[3.25rem] w-[3.25rem] shrink-0 rounded-2xl bg-surface dark:bg-surface-dark flex items-center justify-center text-muted dark:text-muted-dark active:scale-95 transition-transform"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-5 w-5">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.7}
              d="M9 20l-5.5 2.2V6.2L9 4m0 16l6-2.4M9 20V4m6 13.6L20.5 20V4L15 6.4m0 11.2V6.4M9 4l6 2.4"
            />
          </svg>
        </button>
      </div>

      <SegmentedControl options={SORT_OPTIONS} value={sort} onChange={setSort} className="self-start" />

      <div className="flex gap-2 overflow-x-auto snap-x pb-1 -mx-5 px-5">
        <button
          onClick={() => setCategoryFilter("all")}
          className={`shrink-0 snap-start rounded-full px-3.5 py-1.5 text-callout transition-colors ${
            categoryFilter === "all"
              ? "bg-surface2 dark:bg-surface2-dark font-medium"
              : "border border-black/10 dark:border-white/15 text-muted dark:text-muted-dark"
          }`}
        >
          Tutte
        </button>
        {categories.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategoryFilter(c.id)}
            className={`shrink-0 snap-start flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-callout transition-colors ${
              categoryFilter === c.id
                ? "bg-surface2 dark:bg-surface2-dark font-medium"
                : "border border-black/10 dark:border-white/15 text-muted dark:text-muted-dark"
            }`}
          >
            <span className="h-2 w-2 rounded-full shrink-0" style={{ background: c.color }} />
            {c.name}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {groups.length === 0 && (
          <p className="text-center text-callout text-muted dark:text-muted-dark py-10">
            Nessun movimento in questo mese.
          </p>
        )}
        {groups.map((group) => (
          <div key={group.date} className="flex flex-col gap-2">
            <div className="sticky top-0 z-[1] -mx-5 px-5 py-1.5 bg-base/90 dark:bg-base-dark/90 backdrop-blur-sm">
              <span className="text-caption font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
                {group.label}
              </span>
            </div>
            {group.items.map((t) => {
              const cat = categoryById.get(t.category_id);
              const card = t.card_id ? cardById.get(t.card_id) : null;
              const isSplit = !t.is_income && t.my_share !== t.amount;
              return (
                <div
                  key={t.id}
                  onClick={() => setDettaglio(t)}
                  className="flex items-center gap-3 rounded-2xl bg-surface dark:bg-surface-dark px-4 py-3 cursor-pointer active:opacity-70 transition-opacity"
                >
                  <span
                    className="h-9 w-9 rounded-full flex items-center justify-center text-footnote font-semibold shrink-0"
                    style={{
                      background: `${cat?.color ?? "#999"}22`,
                      color: cat?.color ?? "#999",
                    }}
                  >
                    {t.is_income ? "+" : cat?.name.slice(0, 1) ?? "?"}
                  </span>
                  <span className="flex-1 min-w-0">
                    <span className="block text-callout font-medium truncate">{t.name}</span>
                    <span className="block text-footnote text-muted dark:text-muted-dark truncate">
                      {t.time ?? ""}
                      {card ? ` · ${card.name}` : ""}
                      {t.source === "applepay" ? " · Apple Pay" : ""}
                      {isSplit ? ` · quota di €${t.amount.toFixed(0)}` : ""}
                    </span>
                  </span>
                  <span
                    className={`text-callout font-semibold tabular-nums shrink-0 ${
                      t.is_income ? "text-acc-green" : ""
                    }`}
                  >
                    {t.is_income ? "+" : "-"}€{t.my_share.toFixed(2)}
                  </span>
                  <span onClick={(e) => e.stopPropagation()}>
                  <RowMenu
                    onEdit={() => {
                      setEditing(t);
                      setShowModal(true);
                    }}
                    onDelete={() => handleDelete(t.id)}
                  />
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {showModal && (
        <TransactionModal
          existing={editing ?? undefined}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
