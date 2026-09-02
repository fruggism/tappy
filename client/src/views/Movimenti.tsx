import { useMemo, useState } from "react";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";
import TransactionModal from "../components/TransactionModal";
import type { Transaction } from "../lib/types";

type Sort = "date_desc" | "date_asc" | "amount_desc" | "amount_asc";

export default function Movimenti() {
  const { transactions, categories, cards, refreshTransactions } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [sort, setSort] = useState<Sort>("date_desc");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categoryById = useMemo(
    () => new Map(categories.map((c) => [c.id, c])),
    [categories]
  );
  const cardById = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const filtered = useMemo(() => {
    let list = transactions;
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
  }, [transactions, sort, categoryFilter]);

  async function handleDelete(id: string) {
    await api.deleteTransaction(id);
    await refreshTransactions();
  }

  return (
    <div className="flex flex-col gap-4 animate-rise">
      <button
        onClick={() => {
          setEditing(null);
          setShowModal(true);
        }}
        className="w-full rounded-2xl bg-ink dark:bg-white text-white dark:text-black font-medium py-3 flex items-center justify-center gap-2 shadow-lg shadow-black/10"
      >
        <span className="text-lg leading-none">+</span> Registra spesa
      </button>

      <div className="flex gap-2 overflow-x-auto pb-1">
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="text-sm rounded-full bg-surface2 dark:bg-surface2-dark px-3 py-1.5 outline-none shrink-0"
        >
          <option value="date_desc">Data ↓</option>
          <option value="date_asc">Data ↑</option>
          <option value="amount_desc">Importo ↓</option>
          <option value="amount_asc">Importo ↑</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="text-sm rounded-full bg-surface2 dark:bg-surface2-dark px-3 py-1.5 outline-none shrink-0"
        >
          <option value="all">Tutte le categorie</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        {filtered.length === 0 && (
          <p className="text-center text-sm text-muted dark:text-muted-dark py-10">
            Nessun movimento registrato.
          </p>
        )}
        {filtered.map((t) => {
          const cat = categoryById.get(t.category_id);
          const card = t.card_id ? cardById.get(t.card_id) : null;
          const isSplit = !t.is_income && t.my_share !== t.amount;
          return (
            <button
              key={t.id}
              onClick={() => {
                setEditing(t);
                setShowModal(true);
              }}
              className="flex items-center gap-3 rounded-2xl bg-surface dark:bg-surface-dark px-4 py-3 text-left"
            >
              <span
                className="h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
                style={{
                  background: `${cat?.color ?? "#999"}22`,
                  color: cat?.color ?? "#999",
                }}
              >
                {t.is_income ? "+" : cat?.name.slice(0, 1) ?? "?"}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-medium truncate">{t.name}</span>
                <span className="block text-xs text-muted dark:text-muted-dark truncate">
                  {t.date}
                  {t.time ? ` · ${t.time}` : ""}
                  {card ? ` · ${card.name}` : ""}
                  {t.source === "applepay" ? " · Apple Pay" : ""}
                  {isSplit ? ` · quota di €${t.amount.toFixed(0)}` : ""}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    t.is_income ? "text-neon-green" : ""
                  }`}
                >
                  {t.is_income ? "+" : "-"}€{t.my_share.toFixed(2)}
                </span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                  className="text-[10px] text-muted dark:text-muted-dark hover:text-neon-pink"
                >
                  elimina
                </span>
              </span>
            </button>
          );
        })}
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
