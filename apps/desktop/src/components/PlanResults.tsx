import type { DebtAccount, PlanResult } from "@debt-planner/core-types";

interface Props {
  results: { avalanche: PlanResult; snowball: PlanResult };
  accounts: DebtAccount[];
}

function fmt(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function monthsLabel(m: number) {
  const years = Math.floor(m / 12);
  const months = m % 12;
  if (years === 0) return `${months} mo`;
  if (months === 0) return `${years} yr`;
  return `${years} yr ${months} mo`;
}

function StrategyCard({
  plan,
  label,
  isBetter,
}: {
  plan: PlanResult;
  label: string;
  isBetter: boolean;
}) {
  return (
    <div
      className={`border rounded-lg p-5 flex-1 ${
        isBetter
          ? "border-green-400 bg-green-50"
          : "border-gray-200 bg-white"
      }`}
    >
      <div className="flex items-center gap-2 mb-3">
        <h3 className="font-semibold text-base">{label}</h3>
        {isBetter && (
          <span className="text-xs bg-green-200 text-green-800 px-2 py-0.5 rounded-full">
            Saves more
          </span>
        )}
      </div>

      {!plan.payoffFeasible ? (
        <p className="text-red-600 text-sm">{plan.warning}</p>
      ) : (
        <div className="space-y-1 text-sm">
          <p>
            <span className="text-gray-500">Payoff in:</span>{" "}
            <strong>{monthsLabel(plan.monthsToPayoff)}</strong>
          </p>
          <p>
            <span className="text-gray-500">Total interest:</span>{" "}
            <strong>{fmt(plan.totalInterestPaid)}</strong>
          </p>
        </div>
      )}
    </div>
  );
}

export default function PlanResults({ results, accounts }: Props) {
  const { avalanche, snowball } = results;
  const avalancheWins =
    avalanche.payoffFeasible &&
    avalanche.totalInterestPaid <= snowball.totalInterestPaid;

  const accountMap = new Map(accounts.map((a) => [a.id, a.name]));

  // Build per-account summary from the better plan
  const bestPlan = avalancheWins ? avalanche : snowball;
  const accountSummaries = new Map<
    string,
    { lastMonth: number; totalPaid: number }
  >();
  for (const row of bestPlan.schedule) {
    const existing = accountSummaries.get(row.accountId) ?? {
      lastMonth: 0,
      totalPaid: 0,
    };
    existing.lastMonth = Math.max(existing.lastMonth, row.monthIndex);
    existing.totalPaid += row.payment;
    accountSummaries.set(row.accountId, existing);
  }

  return (
    <section>
      <h2 className="text-lg font-semibold mb-3">Payoff Comparison</h2>
      <div className="flex gap-4 mb-6">
        <StrategyCard
          plan={avalanche}
          label="Avalanche (highest APR first)"
          isBetter={avalancheWins}
        />
        <StrategyCard
          plan={snowball}
          label="Snowball (lowest balance first)"
          isBetter={!avalancheWins}
        />
      </div>

      {avalanche.payoffFeasible && snowball.payoffFeasible && (
        <p className="text-sm text-gray-600 mb-6">
          Choosing{" "}
          <strong>{avalancheWins ? "Avalanche" : "Snowball"}</strong> saves you{" "}
          <strong>
            {fmt(
              Math.abs(
                avalanche.totalInterestPaid - snowball.totalInterestPaid
              )
            )}
          </strong>{" "}
          in interest.
        </p>
      )}

      {bestPlan.payoffFeasible && (
        <>
          <h3 className="font-semibold text-sm mb-2">
            Per-Account Summary ({avalancheWins ? "Avalanche" : "Snowball"})
          </h3>
          <table className="w-full text-sm border border-gray-200 rounded">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-3 py-2">Account</th>
                <th className="text-right px-3 py-2">Paid Off By</th>
                <th className="text-right px-3 py-2">Total Paid</th>
              </tr>
            </thead>
            <tbody>
              {[...accountSummaries.entries()].map(([id, s]) => (
                <tr key={id} className="border-t border-gray-200">
                  <td className="px-3 py-2">
                    {accountMap.get(id) ?? id}
                  </td>
                  <td className="px-3 py-2 text-right">
                    Month {s.lastMonth}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {fmt(s.totalPaid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <p className="text-xs text-gray-400 mt-6">
        This tool is for planning and educational purposes only. It does not
        constitute financial or legal advice.
      </p>
    </section>
  );
}
