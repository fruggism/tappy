import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";
import { haptic, HAPTIC } from "../lib/haptics";
import type { Transaction } from "../lib/types";
import Foglio from "./Foglio";

interface Props {
  onClose: () => void;
  existing?: Transaction;
}

export default function TransactionModal({ onClose, existing }: Props) {
  const { categories, cards, refreshTransactions } = useApp();
  const altro = categories.find((c) => c.name === "Altro");
  const [isIncome, setIsIncome] = useState(!!existing?.is_income);
  const [name, setName] = useState(existing?.name ?? "");
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [myShare, setMyShare] = useState(
    existing ? String(existing.my_share) : ""
  );
  const [splitting, setSplitting] = useState(
    !!existing && existing.my_share !== existing.amount
  );
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal");
  const [splitCount, setSplitCount] = useState("2");
  const [categoryId, setCategoryId] = useState(existing?.category_id ?? altro?.id ?? "");
  const [cardId, setCardId] = useState(existing?.card_id ?? cards[0]?.id ?? "");
  const [date, setDate] = useState(existing?.date ?? new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(existing?.time ?? new Date().toISOString().slice(11, 16));
  const [note, setNote] = useState(existing?.note ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const isAltro = categories.find((c) => c.id === categoryId)?.name === "Altro";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const amt = parseFloat(amount.replace(",", "."));
    if (!name.trim() || isNaN(amt) || amt <= 0) {
      setError("Inserisci nome e importo validi.");
      return;
    }
    let share = amt;
    if (splitting) {
      if (splitMode === "equal") {
        const n = parseInt(splitCount, 10);
        if (isNaN(n) || n < 2) {
          setError("Indica in quante persone dividere la spesa (almeno 2).");
          return;
        }
        share = Math.round((amt / n) * 100) / 100;
      } else {
        share = parseFloat(myShare.replace(",", "."));
      }
    }
    if (isNaN(share) || share < 0) {
      setError("Quota non valida.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        amount: amt,
        my_share: isIncome ? amt : share,
        category_id: isAltro ? categoryId : categoryId,
        card_id: isAltro ? null : cardId || null,
        date: isAltro ? new Date().toISOString().slice(0, 10) : date,
        time: isAltro ? null : time,
        note: note.trim() || null,
        is_income: (isIncome ? 1 : 0) as 0 | 1,
      };
      if (existing) {
        await api.updateTransaction(existing.id, payload);
      } else {
        await api.createTransaction(payload);
      }
      await refreshTransactions();
      haptic(HAPTIC.saved);
      onClose();
    } catch (err: any) {
      setError(err.message ?? "Errore");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Foglio lastra onChiudi={onClose}>
      <form
        onSubmit={handleSubmit}
        className="w-full p-6 flex flex-col gap-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-headline font-semibold">
            {existing ? "Modifica movimento" : "Nuovo movimento"}
          </h2>
          <button type="button" onClick={onClose} className="text-muted dark:text-muted-dark">
            ✕
          </button>
        </div>

        <div className="inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-callout self-start">
          <button
            type="button"
            onClick={() => setIsIncome(false)}
            className={`px-4 py-1.5 rounded-full ${
              !isIncome ? "bg-white dark:bg-black shadow" : "text-muted dark:text-muted-dark"
            }`}
          >
            Uscita
          </button>
          <button
            type="button"
            onClick={() => setIsIncome(true)}
            className={`px-4 py-1.5 rounded-full ${
              isIncome ? "bg-white dark:bg-black shadow" : "text-muted dark:text-muted-dark"
            }`}
          >
            Entrata
          </button>
        </div>

        <label className="flex flex-col gap-1 text-callout">
          Nome
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-green/60"
            placeholder="Es. Supermercato"
          />
        </label>

        <label className="flex flex-col gap-1 text-callout">
          Importo (€)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-green/60"
            placeholder="0.00"
          />
        </label>

        {!isIncome && (
          <>
            <label className="flex flex-col gap-1 text-callout">
              Categoria
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none"
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            {!isAltro && (
              <>
                <label className="flex flex-col gap-1 text-callout">
                  Carta
                  <select
                    value={cardId}
                    onChange={(e) => setCardId(e.target.value)}
                    className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none"
                  >
                    {cards.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex gap-3">
                  <label className="flex flex-col gap-1 text-callout flex-1">
                    Data
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none"
                    />
                  </label>
                  <label className="flex flex-col gap-1 text-callout flex-1">
                    Ora
                    <input
                      type="time"
                      value={time ?? ""}
                      onChange={(e) => setTime(e.target.value)}
                      className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none"
                    />
                  </label>
                </div>
              </>
            )}

            <label className="flex items-center gap-2 text-callout">
              <input
                type="checkbox"
                checked={splitting}
                onChange={(e) => setSplitting(e.target.checked)}
                className="accent-acc-green h-4 w-4"
              />
              Spesa divisa con altre persone
            </label>

            {splitting && (
              <div className="flex flex-col gap-3 rounded-xl bg-surface2 dark:bg-surface2-dark p-3">
                <div className="inline-flex bg-surface dark:bg-surface-dark rounded-full p-1 text-footnote self-start">
                  <button
                    type="button"
                    onClick={() => setSplitMode("equal")}
                    className={`px-3 py-1.5 rounded-full ${
                      splitMode === "equal"
                        ? "bg-white dark:bg-black shadow"
                        : "text-muted dark:text-muted-dark"
                    }`}
                  >
                    Parti uguali
                  </button>
                  <button
                    type="button"
                    onClick={() => setSplitMode("custom")}
                    className={`px-3 py-1.5 rounded-full ${
                      splitMode === "custom"
                        ? "bg-white dark:bg-black shadow"
                        : "text-muted dark:text-muted-dark"
                    }`}
                  >
                    Il mio importo
                  </button>
                </div>

                {splitMode === "equal" ? (
                  <label className="flex flex-col gap-1 text-callout">
                    In quante persone?
                    <input
                      value={splitCount}
                      onChange={(e) => setSplitCount(e.target.value)}
                      inputMode="numeric"
                      className="rounded-xl bg-surface dark:bg-surface-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-green/60"
                      placeholder="2"
                    />
                    {amount && !isNaN(parseFloat(amount)) && !isNaN(parseInt(splitCount, 10)) && parseInt(splitCount, 10) > 0 && (
                      <span className="text-footnote text-muted dark:text-muted-dark">
                        La tua quota: €
                        {(
                          Math.round((parseFloat(amount.replace(",", ".")) / parseInt(splitCount, 10)) * 100) / 100
                        ).toFixed(2)}
                      </span>
                    )}
                  </label>
                ) : (
                  <label className="flex flex-col gap-1 text-callout">
                    Di mia competenza (€)
                    <input
                      value={myShare}
                      onChange={(e) => setMyShare(e.target.value)}
                      inputMode="decimal"
                      className="rounded-xl bg-surface dark:bg-surface-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-green/60"
                      placeholder="0.00"
                    />
                  </label>
                )}
              </div>
            )}
          </>
        )}

        <label className="flex flex-col gap-1 text-callout">
          Nota (opzionale)
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-green/60"
          />
        </label>

        {error && <p className="text-callout text-acc-pink">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="mt-2 rounded-xl bg-ink dark:bg-white text-white dark:text-black font-medium py-3 disabled:opacity-50"
        >
          {saving ? "Salvataggio…" : existing ? "Salva modifiche" : "Registra spesa"}
        </button>
      </form>
    </Foglio>
  );
}
