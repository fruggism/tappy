import { useState } from "react";
import { useApp } from "../lib/AppContext";
import { api, API_BASE } from "../lib/api";

const PALETTE = ["#39ff88", "#00e5ff", "#ff2ecb", "#a3a3ff", "#ffcf4d", "#ff6b6b"];

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function Impostazioni() {
  const { user, categories, setTheme, setBudget, refresh } = useApp();
  const [budgetInput, setBudgetInput] = useState(user ? String(user.monthly_budget) : "");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PALETTE[0]);
  const [copied, setCopied] = useState(false);

  if (!user) return null;

  const now = new Date();
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  const weekly = (user!.monthly_budget / dim) * 7;

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

  function copyKey() {
    navigator.clipboard.writeText(user!.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
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
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <div
              key={c.id}
              className="flex items-center gap-3 rounded-2xl bg-surface dark:bg-surface-dark px-4 py-2.5"
            >
              <span
                className="h-3 w-3 rounded-full shrink-0"
                style={{ background: c.color, boxShadow: `0 0 6px ${c.color}` }}
              />
              <span className="flex-1 text-sm">{c.name}</span>
              {c.is_default ? (
                <span className="text-[10px] text-muted dark:text-muted-dark">predefinita</span>
              ) : (
                <button
                  onClick={() => removeCategory(c.id)}
                  className="text-[10px] text-muted dark:text-muted-dark hover:text-neon-pink"
                >
                  elimina
                </button>
              )}
            </div>
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
        <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
          Apple Pay Shortcut
        </h2>
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3 text-sm">
          <p className="text-muted dark:text-muted-dark">
            Crea un&apos;automazione &quot;Alla ricezione di una notifica&quot; (Apple Pay) su
            Comandi Rapidi che invii una richiesta POST a:
          </p>
          <code className="block rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 text-xs break-all">
            {API_BASE}/api/webhook/applepay
          </code>
          <p className="text-muted dark:text-muted-dark">
            Header <code className="bg-surface2 dark:bg-surface2-dark px-1 rounded">x-api-key</code>:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 text-xs break-all">
              {user.api_key}
            </code>
            <button
              onClick={copyKey}
              className="text-xs rounded-lg bg-ink dark:bg-white text-white dark:text-black px-3 py-2 shrink-0"
            >
              {copied ? "Copiato" : "Copia"}
            </button>
          </div>
          <p className="text-muted dark:text-muted-dark">
            Corpo JSON: <code className="bg-surface2 dark:bg-surface2-dark px-1 rounded">
              {`{"amount": 12.5, "name": "Bar Roma", "card": "Visa", "category": "Leisure"}`}
            </code>
          </p>
        </div>
      </section>
    </div>
  );
}
