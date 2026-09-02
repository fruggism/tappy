import { useMemo, useState } from "react";
import { useApp } from "../lib/AppContext";
import RadialGauge from "../components/RadialGauge";

type Period = "day" | "week" | "month";

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

// Lunedì come primo giorno della settimana
function startOfWeek(d: Date) {
  const day = (d.getDay() + 6) % 7;
  const s = new Date(d);
  s.setDate(d.getDate() - day);
  s.setHours(0, 0, 0, 0);
  return s;
}

const LABELS: Record<Period, string> = {
  day: "Giornaliero",
  week: "Settimanale",
  month: "Mensile",
};

export default function Andamento() {
  const { user, categories, transactions } = useApp();
  const [period, setPeriod] = useState<Period>("month");

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const monthPrefix = today.slice(0, 7);
  const dim = daysInMonth(now.getFullYear(), now.getMonth());
  const weekStart = startOfWeek(now).toISOString().slice(0, 10);

  const expenses = useMemo(
    () => transactions.filter((t) => !t.is_income),
    [transactions]
  );

  const periodTx = useMemo(() => {
    if (period === "day") return expenses.filter((t) => t.date === today);
    if (period === "week") return expenses.filter((t) => t.date >= weekStart && t.date <= today);
    return expenses.filter((t) => t.date.startsWith(monthPrefix));
  }, [expenses, period, today, weekStart, monthPrefix]);

  const monthTx = useMemo(
    () => expenses.filter((t) => t.date.startsWith(monthPrefix)),
    [expenses, monthPrefix]
  );

  const budget = user
    ? period === "day"
      ? user.monthly_budget / dim
      : period === "week"
      ? (user.monthly_budget / dim) * 7
      : user.monthly_budget
    : 0;

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of periodTx) {
      map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.my_share);
    }
    return categories
      .map((c) => ({ id: c.id, label: c.name, color: c.color, value: map.get(c.id) ?? 0 }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [periodTx, categories]);

  const totalPeriod = byCategory.reduce((s, c) => s + c.value, 0);

  const monthDaysElapsed = now.getDate();
  const perDay = monthDaysElapsed > 0 ? monthTx.reduce((s, t) => s + t.my_share, 0) / monthDaysElapsed : 0;

  const pctText = budget > 0 ? `${Math.round((totalPeriod / budget) * 100)}%` : "—";

  const budgetLabel =
    period === "day" ? "Budget giornaliero" : period === "week" ? "Budget settimanale" : "Budget mensile";

  return (
    <div className="flex flex-col items-center gap-6 animate-rise">
      <div className="w-full flex justify-center">
        <div className="inline-flex bg-surface2 dark:bg-surface2-dark rounded-full p-1 text-sm">
          {(["day", "week", "month"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 rounded-full transition-colors ${
                period === p
                  ? "bg-white dark:bg-black text-ink dark:text-ink-dark shadow"
                  : "text-muted dark:text-muted-dark"
              }`}
            >
              {LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      <RadialGauge
        segments={byCategory}
        budget={budget}
        centerLabel={`€${totalPeriod.toFixed(0)}`}
        centerSub={`${pctText} · €${perDay.toFixed(0)}/giorno`}
      />

      <div className="w-full flex justify-between text-sm px-1">
        <span className="text-muted dark:text-muted-dark">{budgetLabel}</span>
        <span className="font-medium tabular-nums">€{budget.toFixed(0)}</span>
      </div>

      <div className="w-full flex flex-col gap-3">
        {byCategory.length === 0 && (
          <p className="text-center text-sm text-muted dark:text-muted-dark py-8">
            Nessuna spesa in questo periodo.
          </p>
        )}
        {byCategory.map((c) => {
          const pct = totalPeriod > 0 ? (c.value / totalPeriod) * 100 : 0;
          return (
            <div key={c.id} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span>{c.label}</span>
                <span className="tabular-nums text-muted dark:text-muted-dark">
                  €{c.value.toFixed(0)}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/5 dark:bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${pct}%`,
                    background: c.color,
                    boxShadow: `0 0 8px 0 ${c.color}aa`,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
