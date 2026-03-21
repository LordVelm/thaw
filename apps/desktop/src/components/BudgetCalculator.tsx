import { useState } from "react";

interface ExpenseCategory {
  key: string;
  label: string;
  placeholder: string;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { key: "rent", label: "Rent / Mortgage", placeholder: "1200" },
  { key: "utilities", label: "Utilities (electric, water, gas, internet)", placeholder: "200" },
  { key: "groceries", label: "Groceries", placeholder: "400" },
  { key: "transportation", label: "Transportation (car payment, gas, insurance)", placeholder: "350" },
  { key: "insurance", label: "Insurance (health, life, etc.)", placeholder: "150" },
  { key: "subscriptions", label: "Subscriptions & memberships", placeholder: "50" },
  { key: "other", label: "Other expenses", placeholder: "0" },
];

interface Props {
  totalMinimumPayments: number;
  onBudgetCalculated: (availableForDebt: number) => void;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function BudgetCalculator({
  totalMinimumPayments,
  onBudgetCalculated,
}: Props) {
  const [income, setIncome] = useState("");
  const [expenses, setExpenses] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(true);

  const incomeNum = parseFloat(income) || 0;
  const totalExpenses = Object.values(expenses).reduce(
    (sum, val) => sum + (parseFloat(val) || 0),
    0
  );
  const availableForDebt = Math.max(0, incomeNum - totalExpenses);
  const shortfall = totalMinimumPayments - availableForDebt;

  function handleExpense(key: string, value: string) {
    setExpenses((prev) => ({ ...prev, [key]: value }));
  }

  function handleCalculate() {
    if (incomeNum <= 0) return;
    onBudgetCalculated(availableForDebt);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-lg font-semibold">Budget Calculator</h2>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <p className="text-xs text-gray-500 mb-4">
        Enter your take-home income and monthly expenses to see how much you can
        put toward debt.
      </p>

      {expanded && (
        <>
          {/* Income */}
          <div className="mb-5">
            <label className="flex flex-col text-sm text-gray-700">
              <span className="font-medium mb-1">Monthly Take-Home Income</span>
              <div className="flex items-center">
                <span className="text-gray-400 mr-1 text-lg">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="e.g. 4500"
                  className="border border-gray-300 rounded px-3 py-2 w-48 text-base"
                />
              </div>
              <span className="text-xs text-gray-400 mt-1">
                After taxes — what hits your bank account
              </span>
            </label>
          </div>

          {/* Expenses */}
          <div className="mb-5">
            <h3 className="text-sm font-medium text-gray-700 mb-2">
              Monthly Living Expenses
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {EXPENSE_CATEGORIES.map((cat) => (
                <label
                  key={cat.key}
                  className="flex flex-col text-xs text-gray-600"
                >
                  <span className="mb-1">{cat.label}</span>
                  <div className="flex items-center">
                    <span className="text-gray-400 mr-1">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={expenses[cat.key] ?? ""}
                      onChange={(e) => handleExpense(cat.key, e.target.value)}
                      placeholder={cat.placeholder}
                      className="border border-gray-300 rounded px-2.5 py-1.5 w-full text-sm text-gray-900"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      <div className="border-t border-gray-200 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Monthly income</span>
          <span className={incomeNum > 0 ? "font-medium" : "text-gray-300"}>
            {incomeNum > 0 ? fmt(incomeNum) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Living expenses</span>
          <span
            className={totalExpenses > 0 ? "font-medium text-red-600" : "text-gray-300"}
          >
            {totalExpenses > 0 ? `- ${fmt(totalExpenses)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-base border-t border-gray-100 pt-2">
          <span className="font-semibold text-gray-700">Available for debt</span>
          <span
            className={`font-bold ${
              availableForDebt > 0 && availableForDebt >= totalMinimumPayments
                ? "text-green-700"
                : availableForDebt > 0
                ? "text-amber-600"
                : "text-gray-300"
            }`}
          >
            {incomeNum > 0 ? fmt(availableForDebt) : "—"}
          </span>
        </div>

        {incomeNum > 0 && totalMinimumPayments > 0 && shortfall > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-red-800 font-medium">
              You're {fmt(shortfall)} short of covering minimum payments
            </p>
            <p className="text-xs text-red-600 mt-1">
              Your combined minimums are {fmt(totalMinimumPayments)}/mo. Review
              your expenses above to find areas to cut, or consider contacting
              your card issuers about hardship programs.
            </p>
          </div>
        )}

        {incomeNum > 0 &&
          availableForDebt > 0 &&
          availableForDebt >= totalMinimumPayments && (
            <p className="text-xs text-green-700 mt-1">
              Covers your {fmt(totalMinimumPayments)}/mo in minimums with{" "}
              {fmt(availableForDebt - totalMinimumPayments)} extra to accelerate
              payoff.
            </p>
          )}
      </div>

      {/* Calculate button */}
      <div className="mt-4">
        <button
          onClick={handleCalculate}
          disabled={incomeNum <= 0 || availableForDebt <= 0}
          className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed w-full"
        >
          Calculate Payoff Plan with {availableForDebt > 0 ? fmt(availableForDebt) : "$0"}/mo
        </button>
      </div>
    </div>
  );
}
