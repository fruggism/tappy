import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { api } from "../lib/api";
import type { Category } from "../lib/types";

const PALETTE = ["#39ff88", "#00e5ff", "#ff2ecb", "#a3a3ff", "#ffcf4d", "#ff6b6b"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function CategoryRow({
  category: c,
  maxAllowed,
  onRemove,
  onSaveBudget,
}: {
  category: Category;
  maxAllowed: number;
  onRemove: () => void;
  onSaveBudget: (budget: number | null) => void;
}) {
  const [budgetInput, setBudgetInput] = useState(c.budget != null ? String(c.budget) : "");

  function handleBlur() {
    const trimmed = budgetInput.trim();
    if (trimmed === "") {
      onSaveBudget(null);
      return;
    }
    const v = parseFloat(trimmed.replace(",", "."));
    if (isNaN(v) || v < 0) {
      setBudgetInput(c.budget != null ? String(c.budget) : "");
      return;
    }
    // La somma dei budget di categoria non può superare il budget mensile complessivo.
    const capped = Math.min(v, maxAllowed);
    if (capped !== v) setBudgetInput(String(capped));
    onSaveBudget(capped);
  }

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface dark:bg-surface-dark px-4 py-2.5">
      <span
        className="h-3 w-3 rounded-full shrink-0"
        style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
      />
      <span className="flex-1 text-sm min-w-0 truncate">{c.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        <span className="text-xs text-muted dark:text-muted-dark">€</span>
        <input
          value={budgetInput}
          onChange={(e) => setBudgetInput(e.target.value)}
          onBlur={handleBlur}
          inputMode="decimal"
          placeholder="opzionale"
          className="w-20 rounded-lg bg-surface2 dark:bg-surface2-dark px-2 py-1 text-xs text-right outline-none focus:ring-2 focus:ring-neon-green/60 placeholder:text-[10px]"
        />
        <span className="text-[10px] text-muted dark:text-muted-dark">/mese</span>
      </div>
      {c.is_default ? (
        <span className="text-[10px] text-muted dark:text-muted-dark shrink-0">predefinita</span>
      ) : (
        <button
          onClick={onRemove}
          className="text-[10px] text-muted dark:text-muted-dark hover:text-neon-pink shrink-0"
        >
          elimina
        </button>
      )}
    </div>
  );
}

export default function Impostazioni() {
  const { user, categories, setTheme, setBudget, refresh } = useApp();
  const [budgetInput, setBudgetInput] = useState(user ? String(user.monthly_budget) : "");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PALETTE[0]);

  if (!user) return null;

  const now = new Date();
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  const weekly = (user!.monthly_budget / dim) * 7;

  const allocated = categories.reduce((s, c) => s + (c.budget ?? 0), 0);
  const unallocated = Math.max(0, user.monthly_budget - allocated);
  const overAllocated = allocated > user.monthly_budget;
  const allocationPct = user.monthly_budget > 0 ? (allocated / user.monthly_budget) * 100 : 0;

  async function saveBudget() {
    const v = parseFloat(budgetInput.replace(",", "."));
    if (!isNaN(v) && v >= 0) await setBudget(v);
  }

  async function addCategory() {
    if (!newCatName.trim()) return;
    await api.createCategory({ name: newCatName.trim(), color: newCatColor });
    setNewCatName("");
    await refresh();
  }

  async function removeCategory(id: string) {
    await api.deleteCategory(id);
    await refresh();
  }

  async function saveCategoryBudget(id: string, budget: number | null) {
    await api.updateCategory(id, { budget });
    await refresh();
  }

  return (
    <div className="flex flex-col gap-8 animate-rise pb-4">
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
          Aspetto
        </h2>
        <div className="inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-sm self-start">
          {(["light", "dark", "system"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`px-4 py-1.5 rounded-full capitalize ${
                user.theme === t
                  ? "bg-white dark:bg-black shadow"
                  : "text-muted dark:text-muted-dark"
              }`}
            >
              {t === "light" ? "Chiaro" : t === "dark" ? "Scuro" : "Sistema"}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
          Budget
        </h2>
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Budget mensile (€)
            <input
              value={budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              onBlur={saveBudget}
              inputMode="decimal"
              className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-neon-green/60"
            />
          </label>
          <p className="text-xs text-muted dark:text-muted-dark">
            Equivalente a circa €{weekly.toFixed(0)}/settimana e €
            {(user.monthly_budget / dim).toFixed(0)}/giorno questo mese.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
          Categorie
        </h2>
        <p className="text-xs text-muted dark:text-muted-dark -mt-1">
          Il budget mensile può essere suddiviso tra le categorie, facoltativamente: la
          somma dei budget di categoria non supera mai il budget mensile complessivo.
        </p>

        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-2">
          <div className="flex justify-between text-sm">
            <span>Assegnato alle categorie</span>
            <span className="tabular-nums font-medium">
              €{allocated.toFixed(0)} / €{user.monthly_budget.toFixed(0)}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-black/[0.06] dark:bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, allocationPct)}%`,
                background: overAllocated ? "#ff2ecb" : "#39ff88",
              }}
            />
          </div>
          <span
            className={`text-xs ${
              overAllocated ? "text-neon-pink" : "text-muted dark:text-muted-dark"
            }`}
          >
            {overAllocated
              ? `Hai assegnato €${(allocated - user.monthly_budget).toFixed(0)} più del budget mensile.`
              : `Non assegnato: €${unallocated.toFixed(0)}`}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
              maxAllowed={Math.max(0, (c.budget ?? 0) + unallocated)}
              onRemove={() => removeCategory(c.id)}
              onSaveBudget={(budget) => saveCategoryBudget(c.id, budget)}
            />
          ))}
        </div>
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3">
          <input
            value={newCatName}
            onChange={(e) => setNewCatName(e.target.value)}
            placeholder="Nuova categoria"
            className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 outline-none focus:ring-2 focus:ring-neon-green/60 text-sm"
          />
          <div className="flex gap-2">
            {PALETTE.map((color) => (
              <button
                key={color}
                onClick={() => setNewCatColor(color)}
                className="h-7 w-7 rounded-full"
                style={{
                  background: color,
                  outline: newCatColor === color ? `2px solid ${color}` : "none",
                  outlineOffset: 2,
                }}
              />
            ))}
          </div>
          <button
            onClick={addCategory}
            className="rounded-xl bg-ink dark:bg-white text-white dark:text-black text-sm font-medium py-2"
          >
            Aggiungi categoria
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
            Apple Pay Shortcut
          </h2>
          <span className="text-[10px] font-medium text-neon-amber bg-neon-amber/10 px-2 py-0.5 rounded-full">
            Fase 3
          </span>
        </div>
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-2 text-sm">
          <p className="text-muted dark:text-muted-dark">
            Qui compariranno l&apos;URL del webhook, l&apos;API key personale e le istruzioni
            per collegare il Comando Rapido &quot;Alla ricezione di una notifica&quot; di Apple
            Pay, una volta collegato il backend reale.
          </p>
          <div className="flex items-center gap-2 opacity-40 pointer-events-none select-none">
            <code className="flex-1 rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 text-xs break-all">
              {user.api_key}
            </code>
            <button className="text-xs rounded-lg bg-ink dark:bg-white text-white dark:text-black px-3 py-2 shrink-0">
              Copia
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
