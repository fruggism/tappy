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
  onRemove,
  onSaveBudget,
}: {
  category: Category;
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
    if (!isNaN(v) && v >= 0) onSaveBudget(v);
    else setBudgetInput(c.budget != null ? String(c.budget) : "");
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
  const { user, categories, setTheme, setBudget, refresh, logout } = useApp();
  const [budgetInput, setBudgetInput] = useState(user ? String(user.monthly_budget) : "");
  const [newCatName, setNewCatName] = useState("");
  const [newCatColor, setNewCatColor] = useState(PALETTE[0]);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/webhook/applepay`;

  async function copyApiKey() {
    if (!user?.api_key) return;
    await navigator.clipboard.writeText(user.api_key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

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
        <p className="text-xs text-muted dark:text-muted-dark">
          Il pulsante nell&apos;header imposta chiaro o scuro; da qui puoi tornare a
          &quot;Sistema&quot;.
        </p>
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
          Ogni categoria può avere un budget mensile dedicato, facoltativo: lascialo vuoto se
          vuoi che conti solo il budget complessivo.
        </p>
        <div className="flex flex-col gap-2">
          {categories.map((c) => (
            <CategoryRow
              key={c.id}
              category={c}
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
        <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
          Accesso
        </h2>
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-1 text-sm">
          <span className="text-[10px] text-muted dark:text-muted-dark uppercase tracking-wide">
            Il tuo codice Fru Pass
          </span>
          <code className="text-base tracking-widest">{user.code}</code>
          <p className="text-xs text-muted dark:text-muted-dark mt-1">
            È lo stesso codice che usi nelle altre app dell&apos;ecosistema: inseriscilo su un
            altro dispositivo per ritrovare gli stessi dati.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-muted dark:text-muted-dark uppercase tracking-wide">
          Automazione Apple Pay
        </h2>
        <div className="rounded-2xl bg-surface dark:bg-surface-dark p-4 flex flex-col gap-3 text-sm">
          <p className="text-muted dark:text-muted-dark">
            Nell&apos;automazione dell&apos;iPhone che scatta al pagamento Apple Pay, fai una
            POST a questo URL con l&apos;header <code>x-api-key</code> impostato sulla chiave
            qui sotto. Non usare il codice Fru Pass: è la credenziale di tutto
            l&apos;ecosistema e non va copiata in un&apos;automazione.
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted dark:text-muted-dark uppercase tracking-wide">
              URL webhook
            </span>
            <code className="rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 text-xs break-all">
              {webhookUrl}
            </code>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-muted dark:text-muted-dark uppercase tracking-wide">
              Chiave del webhook
            </span>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-xl bg-surface2 dark:bg-surface2-dark px-3 py-2 text-xs break-all">
                {user.api_key ?? "non disponibile"}
              </code>
              <button
                onClick={copyApiKey}
                className="text-xs rounded-lg bg-ink dark:bg-white text-white dark:text-black px-3 py-2 shrink-0"
              >
                {copied ? "Copiata!" : "Copia"}
              </button>
            </div>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <button
          onClick={logout}
          className="rounded-xl bg-surface dark:bg-surface-dark text-muted dark:text-muted-dark text-sm py-2.5"
        >
          Disconnetti (cambia codice Fru Pass/dispositivo)
        </button>
      </section>
    </div>
  );
}
