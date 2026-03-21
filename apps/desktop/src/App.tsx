import { useState, useEffect, useCallback } from "react";
import type { DebtAccount, PlanResult } from "@debt-planner/core-types";
import { generatePlan } from "@debt-planner/payoff-engine";
import {
  checkAiSetup,
  dbGetAccounts,
  dbSaveAccount,
  dbDeleteAccount,
  dbGetBudget,
  dbSaveBudget,
  type ExtractedFields,
} from "./lib/commands";
import SetupScreen from "./components/SetupScreen";
import StatementUpload from "./components/StatementUpload";
import ReviewExtraction from "./components/ReviewExtraction";
import AccountForm from "./components/AccountForm";
import BudgetCalculator from "./components/BudgetCalculator";
import PlanResults from "./components/PlanResults";
import SettingsPanel from "./components/SettingsPanel";

type View = "loading" | "setup" | "main";

export default function App() {
  const [view, setView] = useState<View>("loading");
  const [accounts, setAccounts] = useState<DebtAccount[]>([]);
  const [debtBudget, setDebtBudget] = useState(0);
  const [results, setResults] = useState<{
    avalanche: PlanResult;
    snowball: PlanResult;
  } | null>(null);

  // Budget state loaded from DB
  const [savedIncome, setSavedIncome] = useState<number | undefined>();
  const [savedExpenses, setSavedExpenses] = useState<
    Record<string, number> | undefined
  >();

  // Extraction flow state
  const [extractedFields, setExtractedFields] =
    useState<ExtractedFields | null>(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load saved data on startup
  useEffect(() => {
    async function init() {
      try {
        const status = await checkAiSetup();
        if (!status.modelReady || !status.serverReady) {
          setView("setup");
        } else {
          setView("main");
        }
      } catch {
        setView("main");
      }

      // Load accounts from DB
      try {
        const saved = await dbGetAccounts();
        if (saved.length > 0) {
          setAccounts(
            saved.map((a) => ({
              id: a.id,
              name: a.name,
              balance: a.balance,
              apr: a.apr,
              minimumPayment: a.minimumPayment,
            }))
          );
        }
      } catch {
        // DB not available (browser dev mode)
      }

      // Load budget from DB
      try {
        const budget = await dbGetBudget();
        if (budget.income > 0) {
          setSavedIncome(budget.income);
        }
        if (budget.expenses.length > 0) {
          const expMap: Record<string, number> = {};
          for (const e of budget.expenses) {
            expMap[e.category] = e.amount;
          }
          setSavedExpenses(expMap);
        }
      } catch {
        // DB not available
      }
    }
    init();
  }, []);

  const addAccount = useCallback(
    async (account: DebtAccount) => {
      setAccounts((prev) => [...prev, account]);
      setExtractedFields(null);
      setShowManualForm(false);
      setResults(null);

      try {
        await dbSaveAccount({
          id: account.id,
          name: account.name,
          balance: account.balance,
          apr: account.apr,
          minimumPayment: account.minimumPayment,
        });
      } catch {
        // DB not available
      }
    },
    []
  );

  const removeAccount = useCallback(async (id: string) => {
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setResults(null);

    try {
      await dbDeleteAccount(id);
    } catch {
      // DB not available
    }
  }, []);

  async function handleBudgetChanged(
    income: number,
    expenses: Record<string, number>
  ) {
    setSavedIncome(income);
    setSavedExpenses(expenses);

    try {
      await dbSaveBudget({
        income,
        expenses: Object.entries(expenses).map(([category, amount]) => ({
          category,
          amount,
        })),
      });
    } catch {
      // DB not available
    }
  }

  function handleBudgetCalculated(availableForDebt: number) {
    setDebtBudget(availableForDebt);
    if (availableForDebt <= 0 || accounts.length === 0) return;

    const avalanche = generatePlan({
      monthlyBudget: availableForDebt,
      strategy: "avalanche",
      accounts,
    });
    const snowball = generatePlan({
      monthlyBudget: availableForDebt,
      strategy: "snowball",
      accounts,
    });
    setResults({ avalanche, snowball });
  }

  if (view === "loading") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-400">Loading...</p>
      </div>
    );
  }

  if (view === "setup") {
    return <SetupScreen onComplete={() => setView("main")} />;
  }

  const totalDebt = accounts.reduce((sum, a) => sum + a.balance, 0);
  const totalMinimum = accounts.reduce((sum, a) => sum + a.minimumPayment, 0);

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-1">
        <h1 className="text-2xl font-bold">Debt Planner</h1>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-400 hover:text-gray-600 text-xl p-1"
          title="Settings"
        >
          &#9881;
        </button>
      </div>
      <p className="text-sm text-gray-500 mb-6">
        For planning &amp; education only — not financial advice.
      </p>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Upload / Extraction section */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-2">
            1
          </span>
          Add Your Accounts
        </h2>

        {extractedFields ? (
          <ReviewExtraction
            fields={extractedFields}
            onConfirm={addAccount}
            onCancel={() => setExtractedFields(null)}
          />
        ) : showManualForm ? (
          <div>
            <AccountForm onAdd={addAccount} />
            <button
              onClick={() => setShowManualForm(false)}
              className="text-sm text-gray-400 hover:text-gray-600 mt-3 underline"
            >
              or upload a statement PDF
            </button>
          </div>
        ) : (
          <StatementUpload
            onExtracted={(fields) => setExtractedFields(fields)}
            onManual={() => setShowManualForm(true)}
          />
        )}
      </section>

      {/* Accounts table */}
      {accounts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">Your Accounts</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm border border-gray-200 rounded">
              <thead className="bg-gray-100">
                <tr>
                  <th className="text-left px-3 py-2">Name</th>
                  <th className="text-right px-3 py-2">Balance</th>
                  <th className="text-right px-3 py-2">APR</th>
                  <th className="text-right px-3 py-2">Min Payment</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.id} className="border-t border-gray-200">
                    <td className="px-3 py-2">{a.name}</td>
                    <td className="px-3 py-2 text-right">
                      ${a.balance.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-right">{a.apr}%</td>
                    <td className="px-3 py-2 text-right">
                      ${a.minimumPayment.toFixed(2)}
                    </td>
                    <td className="px-3 py-2 text-center">
                      <button
                        onClick={() => removeAccount(a.id)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50 font-medium">
                <tr className="border-t border-gray-300">
                  <td className="px-3 py-2">Total</td>
                  <td className="px-3 py-2 text-right">
                    ${totalDebt.toFixed(2)}
                  </td>
                  <td className="px-3 py-2"></td>
                  <td className="px-3 py-2 text-right">
                    ${totalMinimum.toFixed(2)}
                  </td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}

      {/* Budget Calculator */}
      {accounts.length > 0 && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-2">
              2
            </span>
            Build Your Budget
          </h2>
          <BudgetCalculator
            totalMinimumPayments={totalMinimum}
            initialIncome={savedIncome}
            initialExpenses={savedExpenses}
            onBudgetCalculated={handleBudgetCalculated}
            onBudgetChanged={handleBudgetChanged}
          />
        </section>
      )}

      {/* Plan Results */}
      {results && (
        <section>
          <h2 className="text-lg font-semibold mb-3">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mr-2">
              3
            </span>
            Your Payoff Plan
          </h2>
          <PlanResults
            results={results}
            accounts={accounts}
            monthlyBudget={debtBudget}
          />
        </section>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-gray-100 text-center">
        <a
          href="https://buymeacoffee.com/lordvelm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-4 py-2 transition-colors"
        >
          <span className="text-lg">&#9749;</span>
          Buy me a coffee
        </a>
        <p className="text-xs text-gray-400 mt-3">
          Debt Planner is free and open source. Your data never leaves your
          computer.
        </p>
      </footer>
    </div>
  );
}
