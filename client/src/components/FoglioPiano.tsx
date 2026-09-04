import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { haptic, HAPTIC } from "../lib/haptics";
import {
  congelarePrezzo,
  type Frequenza,
  type Piano,
  type TipoPiano,
} from "../lib/piani";
import { api } from "../lib/api";
import Foglio from "./Foglio";
import SegmentedControl from "./SegmentedControl";

function oggiIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const campo =
  "rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-acc-green/60";

export default function FoglioPiano({
  esistente,
  onChiudi,
  onSalvato,
}: {
  esistente?: Piano;
  onChiudi: () => void;
  onSalvato: () => void;
}) {
  const { user, categories } = useApp();
  const [type, setType] = useState<TipoPiano>(esistente?.type ?? "subscription");
  const [name, setName] = useState(esistente?.name ?? "");
  const [amount, setAmount] = useState(esistente ? String(esistente.amount) : "");
  const [frequency, setFrequency] = useState<Frequenza>(esistente?.frequency ?? "monthly");
  const [intervalMonths, setIntervalMonths] = useState(
    esistente?.interval_months ? String(esistente.interval_months) : "3"
  );
  const [startDate, setStartDate] = useState(esistente?.start_date ?? oggiIso());
  const [endDate, setEndDate] = useState(esistente?.end_date ?? "");
  const [categoryId, setCategoryId] = useState(esistente?.category_id ?? categories[0]?.id ?? "");
  const [note, setNote] = useState(esistente?.note ?? "");
  const [errore, setErrore] = useState("");
  const [saving, setSaving] = useState(false);

  async function salva() {
    if (!user) return;
    const importo = parseFloat(amount.replace(",", "."));
    if (!name.trim() || isNaN(importo) || importo <= 0) {
      setErrore("Inserisci nome e importo validi.");
      return;
    }
    if (type === "installment" && !endDate) {
      setErrore("Una rata ha bisogno della data di fine.");
      return;
    }
    if (endDate && endDate < startDate) {
      setErrore("La fine non può precedere l'inizio.");
      return;
    }
    const nMesi = type === "once" ? null : frequency === "everyN" ? Math.max(1, parseInt(intervalMonths, 10) || 1) : null;
    setSaving(true);
    setErrore("");
    try {
      const base = {
        name: name.trim(),
        type,
        amount: importo,
        price_history: esistente?.price_history ?? [{ da: startDate, importo }],
        category_id: categoryId || null,
        card_id: esistente?.card_id ?? null,
        frequency: type === "once" ? "monthly" : frequency,
        interval_months: nMesi,
        start_date: startDate,
        end_date: type === "once" ? startDate : type === "installment" ? endDate : endDate || null,
        review_date: null,
        active: esistente?.active ?? true,
        note: note.trim() || null,
      };
      if (esistente) {
        const congelato =
          importo !== esistente.amount
            ? congelarePrezzo(esistente, importo, oggiIso())
            : esistente;
        await api.updatePlan(esistente.id, { ...congelato, ...base, amount: congelato.amount, price_history: congelato.price_history });
      } else {
        await api.createPlan(base);
      }
      haptic(HAPTIC.saved);
      onSalvato();
      onChiudi();
    } catch (e) {
      setErrore(e instanceof Error ? e.message : "Non salvato");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Foglio lastra onChiudi={onChiudi}>
      <form
        className="p-5 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          salva();
        }}
      >
        <h2 className="text-headline font-semibold">
          {esistente ? "Modifica spesa prevista" : "Nuova spesa prevista"}
        </h2>

        <SegmentedControl
          className="w-full [&>button]:flex-1"
          options={[
            { value: "subscription", label: "Abbonamento" },
            { value: "installment", label: "Rata" },
            { value: "once", label: "Una volta" },
          ]}
          value={type}
          onChange={setType}
        />

        <label className="flex flex-col gap-1 text-callout">
          Nome
          <input value={name} onChange={(e) => setName(e.target.value)} className={campo} placeholder="Es. Netflix" />
        </label>

        <label className="flex flex-col gap-1 text-callout">
          Importo (€)
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="decimal"
            className={campo}
            placeholder="0.00"
          />
        </label>

        {type !== "once" && (
          <div className="flex flex-col gap-1">
            <span className="text-callout">Ogni quanto</span>
            <SegmentedControl
              options={[
                { value: "weekly", label: "Settimana" },
                { value: "monthly", label: "Mese" },
                { value: "everyN", label: "N mesi" },
              ]}
              value={frequency}
              onChange={setFrequency}
            />
          </div>
        )}

        {type !== "once" && frequency === "everyN" && (
          <label className="flex flex-col gap-1 text-callout">
            Ogni quanti mesi
            <input
              value={intervalMonths}
              onChange={(e) => setIntervalMonths(e.target.value)}
              inputMode="numeric"
              className={campo}
            />
          </label>
        )}

        {type === "once" ? (
          <label className="flex flex-col gap-1 text-callout">
            Il giorno
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={campo} />
          </label>
        ) : (
          <div className="flex gap-3">
            <label className="flex flex-col gap-1 text-callout flex-1">
              Inizio
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={campo} />
            </label>
            <label className="flex flex-col gap-1 text-callout flex-1">
              {type === "installment" ? "Fine" : "Fine (facoltativa)"}
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className={campo} />
            </label>
          </div>
        )}

        {categories.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-callout">Categoria</span>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {categories.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoryId(c.id)}
                  className={`shrink-0 rounded-full px-3.5 py-1.5 text-callout ${
                    categoryId === c.id
                      ? "bg-surface2 dark:bg-surface2-dark font-medium"
                      : "border border-black/10 dark:border-white/15 text-muted dark:text-muted-dark"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1 text-callout">
          Nota (opzionale)
          <input value={note} onChange={(e) => setNote(e.target.value)} className={campo} />
        </label>

        {errore ? <p className="text-callout text-acc-pink">{errore}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="mt-1 rounded-xl bg-ink dark:bg-white text-white dark:text-black font-medium py-3 disabled:opacity-50"
        >
          {saving ? "Salvataggio…" : esistente ? "Salva modifiche" : "Aggiungi"}
        </button>
      </form>
    </Foglio>
  );
}
