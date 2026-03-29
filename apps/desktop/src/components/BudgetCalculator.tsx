import { useState, useEffect } from "react";
import type { ExtractedBudget } from "../lib/commands";
import BankStatementUpload from "./BankStatementUpload";

interface ExpenseCategory {
  key: string;
  label: string;
  placeholder: string;
}

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  { key: "rent", label: "Rent / Mortgage", placeholder: "1200" },
  { key: "utilities", label: "Utilities (electric, water, gas, internet)", placeholder: "200" },
  { key: "groceries", label: "Groceries", placeholder: "400" },
  { key: "transportation", label: "Transportation (car, gas, insurance)", placeholder: "350" },
  { key: "insurance", label: "Insurance (health, life, etc.)", placeholder: "150" },
  { key: "subscriptions", label: "Subscriptions & memberships", placeholder: "50" },
  { key: "other", label: "Other monthly expenses", placeholder: "0" },
];

interface Props {
  totalMinimumPayments: number;
  initialIncome?: number;
  initialExpenses?: Record<string, number>;
  onBudgetCalculated: (availableForDebt: number) => void;
  onBudgetChanged?: (income: number, expenses: Record<string, number>) => void;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function BudgetCalculator({
  totalMinimumPayments,
  initialIncome,
  initialExpenses,
  onBudgetCalculated,
  onBudgetChanged,
}: Props) {
  const [income, setIncome] = useState(
    initialIncome && initialIncome > 0 ? initialIncome.toString() : ""
  );
  const [expenses, setExpenses] = useState<Record<string, string>>(() => {
    if (!initialExpenses) return {};
    const result: Record<string, string> = {};
    for (const [key, val] of Object.entries(initialExpenses)) {
      if (val > 0) result[key] = val.toString();
    }
    return result;
  });
  const [expanded, setExpanded] = useState(true);
  const [showImport, setShowImport] = useState(false);
  const [importDone, setImportDone] = useState(false);

  useEffect(() => {
    if (initialIncome && initialIncome > 0) {
      setIncome(initialIncome.toString());
    }
  }, [initialIncome]);

  useEffect(() => {
    if (initialExpenses) {
      const result: Record<string, string> = {};
      for (const [key, val] of Object.entries(initialExpenses)) {
        if (val > 0) result[key] = val.toString();
      }
      setExpenses(result);
    }
  }, [initialExpenses]);

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

  function getExpensesAsNumbers(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, val] of Object.entries(expenses)) {
      const num = parseFloat(val) || 0;
      if (num > 0) result[key] = num;
    }
    return result;
  }

  function handleCalculate() {
    if (incomeNum <= 0) return;
    onBudgetChanged?.(incomeNum, getExpensesAsNumbers());
    onBudgetCalculated(availableForDebt);
  }

  function handleBankExtracted(budget: ExtractedBudget) {
    if (budget.income != null) setIncome(budget.income.toString());
    const newExpenses: Record<string, string> = { ...expenses };
    for (const cat of EXPENSE_CATEGORIES) {
      const val = budget[cat.key as keyof ExtractedBudget];
      if (typeof val === "number" && val > 0) {
        newExpenses[cat.key] = val.toString();
      }
    }
    setExpenses(newExpenses);
    setShowImport(false);
    setImportDone(true);
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-800">Budget Calculator</h3>
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <p className="text-xs text-gray-400 mb-4">
        Start with what comes in, subtract what goes out. Whatever's left is
        your debt-fighting power.
      </p>

      {showImport && (
        <BankStatementUpload
          onExtracted={handleBankExtracted}
          onCancel={() => setShowImport(false)}
        />
      )}

      {!showImport && !importDone && (
        <button
          onClick={() => setShowImport(true)}
          className="text-xs text-brand-600 hover:text-brand-700 underline mb-4 block"
        >
          Import from a bank statement (PDF)
        </button>
      )}

      {importDone && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-4 flex items-center justify-between">
          <p className="text-xs text-green-700">
            Imported — review the numbers below and adjust if needed.
          </p>
          <button
            onClick={() => {
              setImportDone(false);
              setShowImport(true);
            }}
            className="text-xs text-green-600 hover:text-green-700 underline ml-2"
          >
            Try another
          </button>
        </div>
      )}

      {expanded && (
        <>
          {/* Income */}
          <div className="mb-5">
            <label className="flex flex-col text-sm text-gray-700">
              <span className="font-medium mb-1">Monthly take-home pay</span>
              <div className="flex items-center">
                <span className="text-gray-400 mr-1 text-lg">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  placeholder="e.g. 4500"
                  className="border border-gray-200 rounded-lg px-3 py-2.5 w-48 text-base focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-all"
                />
              </div>
              <span className="text-xs text-gray-400 mt-1">
                After taxes — what actually hits your bank account
              </span>
            </label>
          </div>

          {/* Expenses */}
          <div className="mb-5">
            <h4 className="text-sm font-medium text-gray-700 mb-1">
              Monthly living expenses
            </h4>
            <p className="text-xs text-gray-400 mb-3">
              Don't stress about being exact — rough estimates work great here.
            </p>
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
                      className="border border-gray-200 rounded-lg px-2.5 py-1.5 w-full text-sm text-gray-900 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-all"
                    />
                  </div>
                </label>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Summary */}
      <div className="bg-warm-50 rounded-lg p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Monthly income</span>
          <span className={incomeNum > 0 ? "font-medium" : "text-gray-300"}>
            {incomeNum > 0 ? fmt(incomeNum) : "—"}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-500">Living expenses</span>
          <span
            className={totalExpenses > 0 ? "font-medium text-gray-600" : "text-gray-300"}
          >
            {totalExpenses > 0 ? `- ${fmt(totalExpenses)}` : "—"}
          </span>
        </div>
        <div className="flex justify-between text-base border-t border-warm-200 pt-2">
          <span className="font-semibold text-gray-700">
            Available for debt
          </span>
          <span
            className={`font-bold ${
              availableForDebt > 0 && availableForDebt >= totalMinimumPayments
                ? "text-brand-600"
                : availableForDebt > 0
                ? "text-amber-600"
                : "text-gray-300"
            }`}
          >
            {incomeNum > 0 ? fmt(availableForDebt) : "—"}
          </span>
        </div>

        {incomeNum > 0 && totalMinimumPayments > 0 && shortfall > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-amber-800 font-medium">
              Let's find {fmt(shortfall)} more to cover your minimums
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Your combined minimums are {fmt(totalMinimumPayments)}/mo. Take
              another look at your expenses — even small cuts add up. You can
              also call your card issuers and ask about hardship programs.
            </p>
          </div>
        )}

        {incomeNum > 0 &&
          availableForDebt > 0 &&
          availableForDebt >= totalMinimumPayments && (
            <p className="text-xs text-brand-600 mt-1">
              You've got {fmt(availableForDebt - totalMinimumPayments)} beyond
              minimums to accelerate your payoff. Every extra dollar counts.
            </p>
          )}
      </div>

      {/* Calculate button */}
      <div className="mt-5">
        <button
          onClick={handleCalculate}
          disabled={incomeNum <= 0 || availableForDebt <= 0}
          className="bg-brand-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed w-full transition-colors shadow-sm"
        >
          {availableForDebt > 0
            ? `Show my payoff plan with ${fmt(availableForDebt)}/mo`
            : "Enter your income to get started"}
        </button>
      </div>
    </div>
  );
}
