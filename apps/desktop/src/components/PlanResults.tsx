import { useState } from "react";
import type {
  DebtAccount,
  PlanResult,
  MonthlyBreakdown,
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
  return `${years}yr ${months}mo`;
}

function StrategyCard({
  plan,
  label,
  description,
  isBetter,
  isSelected,
  onSelect,
}: {
  plan: PlanResult;
  label: string;
  description: string;
  isBetter: boolean;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`border rounded-lg p-5 flex-1 text-left transition-all ${
        isSelected
          ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50"
          : isBetter
          ? "border-green-400 bg-green-50 hover:border-green-500"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        <h3 className="font-semibold text-base">{label}</h3>
        {isBetter && (
          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
            Recommended
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500 mb-3">{description}</p>

      {!plan.payoffFeasible ? (
        <p className="text-red-600 text-sm">{plan.warning}</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Debt-free in:</span>{" "}
            <strong>{monthsLabel(plan.monthsToPayoff)}</strong>
          </p>
          <p>
            <span className="text-gray-500">Total interest:</span>{" "}
            <strong className={isBetter ? "text-green-700" : ""}>
              {fmt(plan.totalInterestPaid)}
            </strong>
          </p>
          <p>
            <span className="text-gray-500">Total paid:</span>{" "}
            <strong>{fmt(plan.totalPaid)}</strong>
          </p>
        </div>
      )}
    </button>
  );
}

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

  return (
    <div className="space-y-3">
      {sorted.map((summary, i) => {
        const account = accountMap.get(summary.accountId);
        const name = account?.name ?? summary.accountId;
        const pct =
          plan.monthsToPayoff > 0
            ? (summary.payoffMonth / plan.monthsToPayoff) * 100
            : 100;

        return (
          <div key={summary.accountId}>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium">
                {i + 1}. {name}
              </span>
              <span className="text-gray-500">
                {fmtDate(summary.payoffDate)} (month {summary.payoffMonth})
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-3">
              <div
                className={`h-3 rounded-full ${
                  i === 0
                    ? "bg-blue-500"
                    : i === 1
                    ? "bg-indigo-500"
                    : i === 2
                    ? "bg-purple-500"
                    : "bg-gray-500"
                }`}
                style={{ width: `${Math.max(pct, 3)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>
                {fmt(summary.startingBalance)} balance | {fmt(summary.totalInterest)} interest
              </span>
              <span>{fmt(summary.totalPaid)} total paid</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
      <h3 className="font-semibold text-sm text-blue-900 mb-1">
        Your Action Plan — This Month
      </h3>
      <p className="text-xs text-blue-700 mb-3">
        Budget: {fmt(monthlyBudget)}/mo | Strategy:{" "}
        {plan.strategy === "avalanche"
          ? "Highest APR first"
          : "Lowest balance first"}
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
              className={`flex items-center justify-between rounded-lg px-4 py-2.5 ${
                isFocus ? "bg-blue-100 border border-blue-300" : "bg-white border border-blue-100"
              }`}
            >
              <div>
                <span className="font-medium text-sm text-gray-900">
                  {name}
                </span>
                {isFocus && extraAmount > 0 && (
                  <span className="text-xs text-blue-600 ml-2">
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

      <div className="flex justify-between mt-3 pt-2 border-t border-blue-200 text-sm">
        <span className="text-blue-800">Total this month</span>
        <span className="font-bold text-blue-900">
          {fmt(firstMonth.totalPayment)}
        </span>
      </div>
    </div>
  );
}

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
  // Show first 12 months + milestone months (when accounts are paid off)
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
        <h3 className="font-semibold text-sm">Monthly Payment Schedule</h3>
        {breakdown.length > 12 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {expanded
              ? "Show key months only"
              : `Show all ${breakdown.length} months`}
          </button>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs border border-gray-200 rounded">
          <thead className="bg-gray-100">
            <tr>
              <th className="text-left px-2 py-1.5 sticky left-0 bg-gray-100">
                Month
              </th>
              {allAccountIds.map((id) => (
                <th key={id} className="text-right px-2 py-1.5">
                  {accountMap.get(id)?.name ?? id}
                </th>
              ))}
              <th className="text-right px-2 py-1.5">Total</th>
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

              // Check if this is a gap row (non-consecutive with previous)
              const prevIdx = idx > 0 ? displayMonths[idx - 1].monthIndex : 0;
              const showGap = !expanded && month.monthIndex > prevIdx + 1;

              return [
                showGap && (
                  <tr key={`gap-${month.monthIndex}`}>
                    <td
                      colSpan={allAccountIds.length + 2}
                      className="text-center text-gray-400 py-1 text-xs border-t border-dashed border-gray-200"
                    >
                      ···
                    </td>
                  </tr>
                ),
                <tr
                  key={month.monthIndex}
                  className={`border-t ${
                    isPaidOff
                      ? "bg-green-50 border-green-200"
                      : "border-gray-200"
                  }`}
                >
                  <td className="px-2 py-1.5 sticky left-0 bg-inherit whitespace-nowrap">
                    <span className="font-medium">{fmtDate(month.date)}</span>
                    {isPaidOff && (
                      <span className="ml-1 text-green-600 font-medium">
                        {month.accountsPaidOff
                          .map(
                            (id) => accountMap.get(id)?.name ?? id
                          )
                          .join(", ")}{" "}
                        paid off!
                      </span>
                    )}
                  </td>
                  {allAccountIds.map((id) => {
                    const payment = paymentMap.get(id);
                    const balance = balanceMap.get(id) ?? 0;
                    return (
                      <td key={id} className="text-right px-2 py-1.5">
                        {payment != null && payment > 0 ? (
                          <div>
                            <div className="font-medium">{fmt(payment)}</div>
                            <div className="text-gray-400">
                              bal: {fmt(balance)}
                            </div>
                          </div>
                        ) : balance > 0 ? (
                          <span className="text-gray-300">
                            bal: {fmt(balance)}
                          </span>
                        ) : (
                          <span className="text-green-500 text-xs">Paid</span>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-right px-2 py-1.5 font-medium">
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

  return (
    <section className="space-y-6">
      {/* Strategy comparison */}
      <div>
        <h2 className="text-lg font-semibold mb-3">
          Choose Your Strategy
        </h2>
        <div className="flex gap-4">
          <StrategyCard
            plan={avalanche}
            label="Avalanche"
            description="Pay highest APR first — saves the most money"
            isBetter={avalancheWins}
            isSelected={selectedStrategy === "avalanche"}
            onSelect={() => setSelectedStrategy("avalanche")}
          />
          <StrategyCard
            plan={snowball}
            label="Snowball"
            description="Pay lowest balance first — quick wins for motivation"
            isBetter={!avalancheWins}
            isSelected={selectedStrategy === "snowball"}
            onSelect={() => setSelectedStrategy("snowball")}
          />
        </div>

        {interestSaved > 0 && (
          <p className="text-sm text-gray-600 mt-3">
            {avalancheWins ? "Avalanche" : "Snowball"} saves you{" "}
            <strong className="text-green-700">{fmt(interestSaved)}</strong> in
            interest over {avalancheWins ? "Snowball" : "Avalanche"}.
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
          <h3 className="font-semibold text-sm mb-3">Payoff Order & Timeline</h3>
          <PayoffTimeline plan={selectedPlan} accountMap={accountMap} />
        </div>
      )}

      {/* Monthly schedule */}
      {selectedPlan.payoffFeasible && (
        <MonthlyScheduleTable plan={selectedPlan} accountMap={accountMap} />
      )}

      {/* Account details table */}
      {selectedPlan.payoffFeasible && (
        <div>
          <h3 className="font-semibold text-sm mb-2">Account Breakdown</h3>
          <table className="w-full text-sm border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2">Account</th>
                <th className="text-right px-3 py-2">Starting Balance</th>
                <th className="text-right px-3 py-2">Interest Paid</th>
                <th className="text-right px-3 py-2">Total Paid</th>
                <th className="text-right px-3 py-2">Paid Off</th>
              </tr>
            </thead>
            <tbody>
              {[...selectedPlan.accountSummaries]
                .sort((a, b) => a.payoffOrder - b.payoffOrder)
                .map((s) => (
                  <tr key={s.accountId} className="border-t border-gray-200">
                    <td className="px-3 py-2">
                      {accountMap.get(s.accountId)?.name ?? s.accountId}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {fmt(s.startingBalance)}
                    </td>
                    <td className="px-3 py-2 text-right text-red-600">
                      {fmt(s.totalInterest)}
                    </td>
                    <td className="px-3 py-2 text-right">{fmt(s.totalPaid)}</td>
                    <td className="px-3 py-2 text-right">
                      {fmtDate(s.payoffDate)}
                    </td>
                  </tr>
                ))}
            </tbody>
            <tfoot className="bg-gray-50 font-medium">
              <tr className="border-t border-gray-300">
                <td className="px-3 py-2">Total</td>
                <td className="px-3 py-2 text-right">
                  {fmt(
                    selectedPlan.accountSummaries.reduce(
                      (sum, s) => sum + s.startingBalance,
                      0
                    )
                  )}
                </td>
                <td className="px-3 py-2 text-right text-red-600">
                  {fmt(selectedPlan.totalInterestPaid)}
                </td>
                <td className="px-3 py-2 text-right">
                  {fmt(selectedPlan.totalPaid)}
                </td>
                <td className="px-3 py-2 text-right">
                  {selectedPlan.monthlyBreakdown.length > 0 &&
                    fmtDate(
                      selectedPlan.monthlyBreakdown[
                        selectedPlan.monthlyBreakdown.length - 1
                      ].date
                    )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-4">
        Assumes a fixed monthly budget of {fmt(monthlyBudget)}. Actual minimum
        payments may vary. This tool is for planning and educational purposes
        only — not financial or legal advice.
      </p>
    </section>
  );
}
