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
import ThawLogo from "./components/ThawLogo";

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
              tiers: a.tiers.map((t) => ({
                id: t.id,
                label: t.label ?? undefined,
                balance: t.balance,
                apr: t.apr,
                promoExpirationDate: t.promoExpirationDate ?? undefined,
                postPromoApr: t.postPromoApr ?? undefined,
              })),
            }))
          );
        }
      } catch {
        // DB not available (browser dev mode)
      }

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

  const addAccount = useCallback(async (account: DebtAccount) => {
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
        tiers: (account.tiers ?? []).map((t) => ({
          id: t.id,
          label: t.label ?? null,
          balance: t.balance,
          apr: t.apr,
          promoExpirationDate: t.promoExpirationDate ?? null,
          postPromoApr: t.postPromoApr ?? null,
        })),
      });
    } catch {
      // DB not available
    }
  }, []);

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
  const hasAccounts = accounts.length > 0;

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <ThawLogo size={36} />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thaw</h1>
            <p className="text-sm text-gray-400">
              Your data stays on your computer. Always.
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowSettings(true)}
          className="text-gray-300 hover:text-gray-500 text-xl p-3 rounded-lg hover:bg-warm-100 transition-colors"
          title="Settings"
        >
          &#9881;
        </button>
      </div>

      {showSettings && (
        <SettingsPanel onClose={() => setShowSettings(false)} />
      )}

      {/* Welcome — only when no accounts */}
      {!hasAccounts && !extractedFields && !showManualForm && (
        <div className="mt-8 mb-10 text-center">
          <ThawLogo size={64} className="mx-auto mb-2" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            You're taking the first step
          </h2>
          <p className="text-gray-500 max-w-md mx-auto leading-relaxed">
            That takes courage. Let's look at where you stand and build a clear
            plan to get you out of debt — one month at a time.
          </p>
        </div>
      )}

      {/* Upload / Extraction section */}
      <section className="mb-8">
        {!hasAccounts && !extractedFields && !showManualForm && (
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Let's start with your statements
          </h2>
        )}

        {hasAccounts && !extractedFields && !showManualForm && (
          <h2 className="text-lg font-semibold text-gray-700 mb-3">
            Add another account
          </h2>
        )}

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
              className="text-sm text-gray-400 hover:text-gray-600 mt-3 underline py-2"
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
      {hasAccounts && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-gray-700">
              Your accounts
            </h2>
            <p className="text-sm text-gray-400">
              {accounts.length} account{accounts.length !== 1 ? "s" : ""} &middot;{" "}
              ${totalDebt.toLocaleString("en-US", { minimumFractionDigits: 2 })} total
            </p>
          </div>
          <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Name
                  </th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    APR
                  </th>
                  <th className="text-right px-4 py-3 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Min Payment
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr
                    key={a.id}
                    className="border-b border-gray-50 hover:bg-warm-50 transition-colors"
                  >
                    <td className="px-4 py-3 font-medium">{a.name}</td>
                    <td className="px-4 py-3 text-right">
                      ${a.balance.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {a.tiers && a.tiers.length > 1
                        ? `${a.apr}% (${a.tiers.length} tiers)`
                        : `${a.apr}%`}
                    </td>
                    <td className="px-4 py-3 text-right">
                      ${a.minimumPayment.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => removeAccount(a.id)}
                        className="text-gray-300 hover:text-red-400 text-xs transition-colors"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {accounts.length === 1 && (
            <p className="text-sm text-gray-400 mt-3 text-center">
              Have more cards? Add them all for the most accurate plan.
            </p>
          )}
        </section>
      )}

      {/* Budget Calculator */}
      {hasAccounts && (
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-gray-700 mb-1">
            What can you put toward debt?
          </h2>
          <p className="text-sm text-gray-400 mb-3">
            Let's figure out your real number — no guessing.
          </p>
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
        <section className="mb-8">
          <PlanResults
            results={results}
            accounts={accounts}
            monthlyBudget={debtBudget}
          />
        </section>
      )}

      {/* Footer */}
      <footer className="mt-12 pt-6 border-t border-warm-200 text-center space-y-3">
        <a
          href="https://buymeacoffee.com/lordvelm"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg px-4 py-2 transition-colors"
        >
          <span className="text-lg">&#9749;</span>
          Buy me a coffee
        </a>
        <p className="text-xs text-gray-300">
          Free and open source. Not financial advice. Your data never leaves
          your computer.
        </p>
      </footer>
    </div>
  );
}
