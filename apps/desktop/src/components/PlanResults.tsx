import { useState } from "react";
import type {
  DebtAccount,
  PlanResult,
} from "@debt-planner/core-types";

interface Props {
  results: { avalanche: PlanResult; snowball: PlanResult };
  accounts: DebtAccount[];
  monthlyBudget: number;
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function fmtDate(dateStr: string) {
  const [year, month] = dateStr.split("-");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[parseInt(month) - 1]} ${year}`;
}

function monthsLabel(m: number) {
  const years = Math.floor(m / 12);
  const months = m % 12;
  if (years === 0) return `${months} month${months !== 1 ? "s" : ""}`;
  if (months === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years} yr ${months} mo`;
}

// --- Progress Ring ---
function ProgressRing({
  percent,
  size = 120,
}: {
  percent: number;
  size?: number;
}) {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#f0ebe4"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#0b8fef"
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-all duration-1000 ease-out"
      />
    </svg>
  );
}

// --- Strategy Card ---
function StrategyCard({
  plan,
  friendlyName,
  description,
  isBetter,
  isSelected,
  onSelect,
}: {
  plan: PlanResult;
  friendlyName: string;
  description: string;
  isBetter: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`border rounded-xl p-5 flex-1 text-left transition-all ${
        isSelected
          ? "border-brand-400 ring-2 ring-brand-100 bg-brand-50"
          : isBetter
          ? "border-brand-200 bg-white hover:border-brand-300 shadow-sm"
          : "border-gray-200 bg-white hover:border-gray-300 shadow-sm"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-base text-gray-800">
          {friendlyName}
        </h3>
        {isBetter && (
          <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full font-medium">
            Recommended
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-3">{description}</p>

      {!plan.payoffFeasible ? (
        <p className="text-amber-600 text-sm">{plan.warning}</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-400">Debt-free in:</span>{" "}
            <strong className="text-gray-800">
              {monthsLabel(plan.monthsToPayoff)}
            </strong>
          </p>
          <p>
            <span className="text-gray-400">Interest cost:</span>{" "}
            <strong className="text-amber-600">
              {fmt(plan.totalInterestPaid)}
            </strong>
          </p>
          <p>
            <span className="text-gray-400">Total paid:</span>{" "}
            <strong className="text-gray-800">{fmt(plan.totalPaid)}</strong>
          </p>
        </div>
      )}
    </button>
  );
}

// --- This Month Card ---
function ThisMonthCard({
  plan,
  accountMap,
  monthlyBudget,
}: {
  plan: PlanResult;
  accountMap: Map<string, DebtAccount>;
  monthlyBudget: number;
}) {
  if (!plan.payoffFeasible || plan.monthlyBreakdown.length === 0) return null;

  const firstMonth = plan.monthlyBreakdown[0];

  return (
    <div className="bg-brand-50 border border-brand-200 rounded-xl p-5">
      <h3 className="font-semibold text-sm text-brand-800 mb-1">
        Here's what to pay this month
      </h3>
      <p className="text-xs text-brand-600 mb-3">
        {fmt(monthlyBudget)}/mo budget &middot;{" "}
        {plan.strategy === "avalanche"
          ? "Targeting highest interest first"
          : "Targeting smallest balance first"}
      </p>

      <div className="space-y-2">
        {firstMonth.payments.map(({ accountId, amount }) => {
          const account = accountMap.get(accountId);
          const name = account?.name ?? accountId;
          const isFocus = accountId === plan.focusAccountId;
          const minPayment = account?.minimumPayment ?? 0;
          const extraAmount = amount - minPayment;

          return (
            <div
              key={accountId}
              className={`flex items-center justify-between rounded-lg px-4 py-3 ${
                isFocus
                  ? "bg-white border border-brand-300 shadow-sm"
                  : "bg-brand-50/50 border border-brand-100"
              }`}
            >
              <div>
                <span className="font-medium text-sm text-gray-800">
                  {name}
                </span>
                {isFocus && extraAmount > 0 && (
                  <span className="text-xs text-brand-600 ml-2">
                    {fmt(minPayment)} min + {fmt(extraAmount)} extra
                  </span>
                )}
              </div>
              <span className="font-bold text-base text-gray-900">
                {fmt(amount)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-3 pt-3 border-t border-brand-200 text-sm">
        <span className="text-brand-700 font-medium">Total this month</span>
        <span className="font-bold text-brand-800">
          {fmt(firstMonth.totalPayment)}
        </span>
      </div>
    </div>
  );
}

// --- Payoff Timeline ---
function PayoffTimeline({
  plan,
  accountMap,
}: {
  plan: PlanResult;
  accountMap: Map<string, DebtAccount>;
}) {
  const sorted = [...plan.accountSummaries].sort(
    (a, b) => a.payoffOrder - b.payoffOrder
  );

  const barColors = [
    "bg-brand-500",
    "bg-indigo-400",
    "bg-purple-400",
    "bg-teal-400",
    "bg-pink-400",
  ];

  return (
    <div className="space-y-4">
      {sorted.map((summary, i) => {
        const account = accountMap.get(summary.accountId);
        const name = account?.name ?? summary.accountId;
        const pct =
          plan.monthsToPayoff > 0
            ? (summary.payoffMonth / plan.monthsToPayoff) * 100
            : 100;

        return (
          <div key={summary.accountId}>
            <div className="flex justify-between text-sm mb-1.5">
              <span className="font-medium text-gray-700">
                {i + 1}. {name}
              </span>
              <span className="text-gray-400">
                {fmtDate(summary.payoffDate)}
              </span>
            </div>
            <div className="w-full bg-warm-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${barColors[i % barColors.length]} transition-all duration-700`}
                style={{ width: `${Math.max(pct, 4)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>
                {fmt(summary.startingBalance)} balance &middot;{" "}
                {fmt(summary.totalInterest)} interest
              </span>
              <span>{fmt(summary.totalPaid)} total</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// --- Monthly Schedule ---
function MonthlyScheduleTable({
  plan,
  accountMap,
}: {
  plan: PlanResult;
  accountMap: Map<string, DebtAccount>;
}) {
  const [expanded, setExpanded] = useState(false);

  if (!plan.payoffFeasible) return null;

  const breakdown = plan.monthlyBreakdown;
  const milestoneMonths = new Set(
    breakdown
      .filter((m) => m.accountsPaidOff.length > 0)
      .map((m) => m.monthIndex)
  );

  const displayMonths = expanded
    ? breakdown
    : breakdown.filter(
        (m) => m.monthIndex <= 12 || milestoneMonths.has(m.monthIndex)
      );

  const allAccountIds = [...accountMap.keys()];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-semibold text-sm text-gray-700">
          Month-by-month breakdown
        </h3>
        {breakdown.length > 12 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-brand-600 hover:text-brand-700 underline"
          >
            {expanded
              ? "Show key months only"
              : `Show all ${breakdown.length} months`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto bg-white rounded-xl border border-gray-200 shadow-sm">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-3 py-2 sticky left-0 bg-white text-gray-500 font-medium uppercase tracking-wider text-[10px]">
                Month
              </th>
              {allAccountIds.map((id) => (
                <th key={id} className="text-right px-3 py-2 text-gray-500 font-medium uppercase tracking-wider text-[10px]">
                  {accountMap.get(id)?.name ?? id}
                </th>
              ))}
              <th className="text-right px-3 py-2 text-gray-500 font-medium uppercase tracking-wider text-[10px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {displayMonths.map((month, idx) => {
              const paymentMap = new Map(
                month.payments.map((p) => [p.accountId, p.amount])
              );
              const balanceMap = new Map(
                month.endingBalances.map((b) => [b.accountId, b.balance])
              );
              const isPaidOff = month.accountsPaidOff.length > 0;

              const prevIdx = idx > 0 ? displayMonths[idx - 1].monthIndex : 0;
              const showGap = !expanded && month.monthIndex > prevIdx + 1;

              return [
                showGap && (
                  <tr key={`gap-${month.monthIndex}`}>
                    <td
                      colSpan={allAccountIds.length + 2}
                      className="text-center text-gray-300 py-1 text-xs border-t border-dashed border-gray-100"
                    >
                      &middot;&middot;&middot;
                    </td>
                  </tr>
                ),
                <tr
                  key={month.monthIndex}
                  className={`border-t ${
                    isPaidOff
                      ? "bg-green-50/50 border-green-100"
                      : "border-gray-50"
                  }`}
                >
                  <td className="px-3 py-2 sticky left-0 bg-inherit whitespace-nowrap">
                    <span className="font-medium text-gray-700">
                      {fmtDate(month.date)}
                    </span>
                    {isPaidOff && (
                      <span className="ml-1.5 text-green-600 text-[10px] font-semibold">
                        &#127881;{" "}
                        {month.accountsPaidOff
                          .map((id) => accountMap.get(id)?.name ?? id)
                          .join(", ")}{" "}
                        done!
                      </span>
                    )}
                  </td>
                  {allAccountIds.map((id) => {
                    const payment = paymentMap.get(id);
                    const balance = balanceMap.get(id) ?? 0;
                    return (
                      <td key={id} className="text-right px-3 py-2">
                        {payment != null && payment > 0 ? (
                          <div>
                            <div className="font-medium text-gray-800">
                              {fmt(payment)}
                            </div>
                            <div className="text-gray-300 text-[10px]">
                              {fmt(balance)} left
                            </div>
                          </div>
                        ) : balance > 0 ? (
                          <span className="text-gray-300 text-[10px]">
                            {fmt(balance)} left
                          </span>
                        ) : (
                          <span className="text-green-400 text-[10px]">
                            &#10003;
                          </span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right px-3 py-2 font-medium text-gray-700">
                    {fmt(month.totalPayment)}
                  </td>
                </tr>,
              ];
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// --- Main Results Component ---
export default function PlanResults({
  results,
  accounts,
  monthlyBudget,
}: Props) {
  const { avalanche, snowball } = results;
  const avalancheWins =
    avalanche.payoffFeasible &&
    avalanche.totalInterestPaid <= snowball.totalInterestPaid;

  const [selectedStrategy, setSelectedStrategy] = useState<
    "avalanche" | "snowball"
  >(avalancheWins ? "avalanche" : "snowball");

  const selectedPlan =
    selectedStrategy === "avalanche" ? avalanche : snowball;

  const accountMap = new Map(accounts.map((a) => [a.id, a]));

  const interestSaved =
    avalanche.payoffFeasible && snowball.payoffFeasible
      ? Math.abs(avalanche.totalInterestPaid - snowball.totalInterestPaid)
      : 0;

  const totalDebt = accounts.reduce((sum, a) => sum + a.balance, 0);
  const principalPaidPercent = selectedPlan.payoffFeasible
    ? Math.round((totalDebt / selectedPlan.totalPaid) * 100)
    : 0;

  // Find the payoff date
  const payoffDate =
    selectedPlan.payoffFeasible && selectedPlan.monthlyBreakdown.length > 0
      ? fmtDate(
          selectedPlan.monthlyBreakdown[
            selectedPlan.monthlyBreakdown.length - 1
          ].date
        )
      : null;

  return (
    <div className="space-y-8">
      {/* Hero — Debt-free date */}
      {selectedPlan.payoffFeasible && payoffDate && (
        <div className="text-center py-6">
          <div className="inline-flex items-center justify-center mb-4">
            <div className="relative">
              <ProgressRing percent={principalPaidPercent} />
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold text-brand-600">
                  {monthsLabel(selectedPlan.monthsToPayoff)}
                </span>
              </div>
            </div>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">
            You could be debt-free by {payoffDate}
          </h2>
          <p className="text-sm text-gray-400">
            With {fmt(monthlyBudget)}/mo, you'll pay{" "}
            {fmt(selectedPlan.totalInterestPaid)} in interest on{" "}
            {fmt(totalDebt)} of debt.
          </p>
        </div>
      )}

      {/* Strategy comparison */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Pick your approach
        </h3>
        <div className="flex gap-3">
          <StrategyCard
            plan={avalanche}
            friendlyName="Save the most money"
            description="Targets highest-interest debt first (Avalanche method)"
            isBetter={avalancheWins}
            isSelected={selectedStrategy === "avalanche"}
            onSelect={() => setSelectedStrategy("avalanche")}
          />
          <StrategyCard
            plan={snowball}
            friendlyName="Build momentum fast"
            description="Pays off smallest balances first for quick wins (Snowball method)"
            isBetter={!avalancheWins}
            isSelected={selectedStrategy === "snowball"}
            onSelect={() => setSelectedStrategy("snowball")}
          />
        </div>

        {interestSaved > 0 && (
          <p className="text-sm text-gray-500 mt-3 text-center">
            {avalancheWins ? "\"Save the most money\"" : "\"Build momentum fast\""} saves you{" "}
            <strong className="text-brand-600">{fmt(interestSaved)}</strong> in
            interest.
          </p>
        )}
      </div>

      {/* This month action card */}
      {selectedPlan.payoffFeasible && (
        <ThisMonthCard
          plan={selectedPlan}
          accountMap={accountMap}
          monthlyBudget={monthlyBudget}
        />
      )}

      {/* Payoff timeline */}
      {selectedPlan.payoffFeasible && (
        <div>
          <h3 className="font-semibold text-sm text-gray-700 mb-1">
            Your payoff order
          </h3>
          <p className="text-xs text-gray-400 mb-3">
            Each account you pay off frees up more money for the next one.
          </p>
          <PayoffTimeline plan={selectedPlan} accountMap={accountMap} />
        </div>
      )}

      {/* Monthly schedule */}
      {selectedPlan.payoffFeasible && (
        <MonthlyScheduleTable plan={selectedPlan} accountMap={accountMap} />
      )}

      {/* Account details */}
      {selectedPlan.payoffFeasible && (
        <div>
          <h3 className="font-semibold text-sm text-gray-700 mb-2">
            Account breakdown
          </h3>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Account
                  </th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Interest
                  </th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Total Paid
                  </th>
                  <th className="text-right px-4 py-2.5 text-gray-500 font-medium text-xs uppercase tracking-wider">
                    Paid Off
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...selectedPlan.accountSummaries]
                  .sort((a, b) => a.payoffOrder - b.payoffOrder)
                  .map((s) => (
                    <tr
                      key={s.accountId}
                      className="border-b border-gray-50 hover:bg-warm-50 transition-colors"
                    >
                      <td className="px-4 py-2.5 font-medium">
                        {accountMap.get(s.accountId)?.name ?? s.accountId}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {fmt(s.startingBalance)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-amber-600">
                        {fmt(s.totalInterest)}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {fmt(s.totalPaid)}
                      </td>
                      <td className="px-4 py-2.5 text-right text-gray-500">
                        {fmtDate(s.payoffDate)}
                      </td>
                    </tr>
                  ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 bg-warm-50 font-semibold">
                  <td className="px-4 py-2.5">Total</td>
                  <td className="px-4 py-2.5 text-right">
                    {fmt(
                      selectedPlan.accountSummaries.reduce(
                        (sum, s) => sum + s.startingBalance,
                        0
                      )
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right text-amber-600">
                    {fmt(selectedPlan.totalInterestPaid)}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {fmt(selectedPlan.totalPaid)}
                  </td>
                  <td className="px-4 py-2.5 text-right text-gray-500">
                    {payoffDate}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-300 mt-4 text-center">
        Based on a fixed {fmt(monthlyBudget)}/mo budget. Actual minimums may
        vary. This is a planning tool, not financial advice. You've got this.
      </p>
    </div>
  );
}
