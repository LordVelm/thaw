import type {
  DebtAccount,
  BalanceTier,
  PlanInput,
  PlanResult,
  ScheduleRow,
  MonthlyBreakdown,
  AccountSummary,
  Strategy,
} from "@debt-planner/core-types";
import { ensureTiers } from "@debt-planner/core-types";

type MutableTier = BalanceTier & { currentBalance: number };
type MutableAccount = Omit<DebtAccount, "tiers"> & {
  currentBalance: number;
  workingTiers: MutableTier[];
};

const CENTS = 100;
const MAX_MONTHS = 1200;

function roundMoney(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

function monthsUntilDate(dateStr: string): number {
  const now = new Date();
  const target = new Date(dateStr);
  return (
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())
  );
}

function getTierApr(tier: MutableTier, monthIndex: number): number {
  if (!tier.promoExpirationDate || tier.postPromoApr == null) return tier.apr;
  const expirationMonth = monthsUntilDate(tier.promoExpirationDate);
  if (monthIndex > expirationMonth) return tier.postPromoApr;
  return tier.apr;
}

function getEffectiveHighestApr(
  account: MutableAccount,
  monthIndex: number
): number {
  const openTiers = account.workingTiers.filter((t) => t.currentBalance > 0);
  if (openTiers.length === 0) return 0;
  return Math.max(...openTiers.map((t) => getTierApr(t, monthIndex)));
}

function sortForStrategy(
  strategy: Strategy,
  accounts: MutableAccount[],
  monthIndex: number
): MutableAccount[] {
  if (strategy === "avalanche") {
    return [...accounts].sort(
      (a, b) =>
        getEffectiveHighestApr(b, monthIndex) -
          getEffectiveHighestApr(a, monthIndex) ||
        b.currentBalance - a.currentBalance
    );
  }
  return [...accounts].sort(
    (a, b) =>
      a.currentBalance - b.currentBalance ||
      getEffectiveHighestApr(b, monthIndex) -
        getEffectiveHighestApr(a, monthIndex)
  );
}

function syncAccountBalance(account: MutableAccount): void {
  account.currentBalance = roundMoney(
    account.workingTiers.reduce(
      (s, t) => s + Math.max(0, t.currentBalance),
      0
    )
  );
}

/** Apply minimum payment to lowest-APR tiers first (issuer default) */
function applyMinimumToAccount(
  account: MutableAccount,
  minPayment: number,
  monthIndex: number
): number {
  let remaining = Math.min(minPayment, account.currentBalance);
  const sorted = [...account.workingTiers]
    .filter((t) => t.currentBalance > 0)
    .sort((a, b) => getTierApr(a, monthIndex) - getTierApr(b, monthIndex));

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, tier.currentBalance);
    tier.currentBalance = roundMoney(tier.currentBalance - applied);
    remaining = roundMoney(remaining - applied);
  }

  syncAccountBalance(account);
  return roundMoney(Math.min(minPayment, account.currentBalance + minPayment) - remaining);
}

/** Apply extra payment to highest-APR tiers first (CARD Act) */
function applyExtraToAccount(
  account: MutableAccount,
  payment: number,
  monthIndex: number
): number {
  let remaining = Math.min(payment, account.currentBalance);
  const sorted = [...account.workingTiers]
    .filter((t) => t.currentBalance > 0)
    .sort((a, b) => getTierApr(b, monthIndex) - getTierApr(a, monthIndex));

  for (const tier of sorted) {
    if (remaining <= 0) break;
    const applied = Math.min(remaining, tier.currentBalance);
    tier.currentBalance = roundMoney(tier.currentBalance - applied);
    remaining = roundMoney(remaining - applied);
  }

  syncAccountBalance(account);
  return roundMoney(payment - remaining);
}

function getDateString(monthsFromNow: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function generatePlan(input: PlanInput): PlanResult {
  const working: MutableAccount[] = input.accounts.map((a) => {
    const acct = ensureTiers(a);
    const workingTiers: MutableTier[] = acct.tiers.map((t) => ({
      ...t,
      currentBalance: roundMoney(t.balance),
    }));
    const currentBalance = roundMoney(
      workingTiers.reduce((s, t) => s + t.currentBalance, 0)
    );
    return {
      id: acct.id,
      name: acct.name,
      balance: currentBalance,
      apr: acct.apr,
      minimumPayment: acct.minimumPayment,
      currentBalance,
      workingTiers,
    };
  });

  const schedule: ScheduleRow[] = [];
  const monthlyBreakdown: MonthlyBreakdown[] = [];

  const interestByAccount = new Map<string, number>();
  const paidByAccount = new Map<string, number>();
  const payoffMonths = new Map<string, number>();
  const payoffOrderList: string[] = [];

  for (const a of working) {
    interestByAccount.set(a.id, 0);
    paidByAccount.set(a.id, 0);
  }

  const minimumTotal = roundMoney(
    working.reduce((acc, x) => acc + x.minimumPayment, 0)
  );

  if (input.monthlyBudget < minimumTotal) {
    return {
      strategy: input.strategy,
      monthsToPayoff: 0,
      totalInterestPaid: 0,
      totalPaid: 0,
      payoffFeasible: false,
      warning: `Monthly budget ($${input.monthlyBudget.toFixed(2)}) is below combined minimum payments ($${minimumTotal.toFixed(2)}).`,
      schedule,
      monthlyBreakdown,
      accountSummaries: [],
    };
  }

  let month = 0;
  let totalInterestPaid = 0;
  let totalPaid = 0;

  const focusSorted = sortForStrategy(input.strategy, [...working], 1);
  const focusAccountId =
    focusSorted.length > 0 ? focusSorted[0].id : undefined;

  while (month < MAX_MONTHS) {
    const openAccounts = working.filter((a) => a.currentBalance > 0);
    if (openAccounts.length === 0) break;

    month += 1;

    const monthInterest = new Map<string, number>();

    // Step 1: Accrue interest per tier
    for (const account of openAccounts) {
      let accountInterest = 0;
      for (const tier of account.workingTiers) {
        if (tier.currentBalance <= 0) continue;
        const effectiveApr = getTierApr(tier, month);
        const monthlyRate = effectiveApr / 100 / 12;
        const interest = roundMoney(tier.currentBalance * monthlyRate);
        tier.currentBalance = roundMoney(tier.currentBalance + interest);
        accountInterest = roundMoney(accountInterest + interest);
      }
      syncAccountBalance(account);
      totalInterestPaid = roundMoney(totalInterestPaid + accountInterest);
      monthInterest.set(account.id, accountInterest);
      interestByAccount.set(
        account.id,
        roundMoney((interestByAccount.get(account.id) ?? 0) + accountInterest)
      );
    }

    const monthPayments = new Map<string, number>();
    let monthTotalPayment = 0;

    // Step 2: Pay minimums (lowest APR tier first per CARD Act)
    for (const account of openAccounts) {
      const minDue = Math.min(account.minimumPayment, account.currentBalance);
      if (minDue <= 0) continue;
      const paid = applyMinimumToAccount(account, minDue, month);
      monthPayments.set(account.id, (monthPayments.get(account.id) ?? 0) + paid);
      monthTotalPayment = roundMoney(monthTotalPayment + paid);
    }

    // Step 3: Allocate surplus by strategy (highest APR tier first per CARD Act)
    let remainingBudget = roundMoney(input.monthlyBudget - monthTotalPayment);
    const priority = sortForStrategy(
      input.strategy,
      working.filter((a) => a.currentBalance > 0),
      month
    );

    for (const account of priority) {
      if (remainingBudget <= 0) break;
      const extra = Math.min(remainingBudget, account.currentBalance);
      if (extra <= 0) continue;
      const paid = applyExtraToAccount(account, extra, month);
      remainingBudget = roundMoney(remainingBudget - paid);
      monthPayments.set(
        account.id,
        roundMoney((monthPayments.get(account.id) ?? 0) + paid)
      );
      monthTotalPayment = roundMoney(monthTotalPayment + paid);
    }

    totalPaid = roundMoney(totalPaid + monthTotalPayment);

    for (const [id, payment] of monthPayments) {
      paidByAccount.set(id, roundMoney((paidByAccount.get(id) ?? 0) + payment));
    }

    const paidOffThisMonth: string[] = [];
    for (const account of working) {
      if (account.currentBalance <= 0 && !payoffMonths.has(account.id)) {
        payoffMonths.set(account.id, month);
        payoffOrderList.push(account.id);
        paidOffThisMonth.push(account.id);
      }
    }

    for (const [accountId, payment] of monthPayments) {
      const interest = monthInterest.get(accountId) ?? 0;
      const principal = roundMoney(payment - interest);
      const account = working.find((a) => a.id === accountId)!;
      schedule.push({
        monthIndex: month,
        accountId,
        payment,
        interest,
        principal: Math.max(0, principal),
        endingBalance: Math.max(0, account.currentBalance),
      });
    }

    const payments = [...monthPayments.entries()].map(
      ([accountId, amount]) => ({ accountId, amount })
    );
    const endingBalances = working.map((a) => ({
      accountId: a.id,
      balance: Math.max(0, a.currentBalance),
    }));

    monthlyBreakdown.push({
      monthIndex: month,
      date: getDateString(month),
      payments,
      totalPayment: monthTotalPayment,
      endingBalances,
      accountsPaidOff: paidOffThisMonth,
    });
  }

  const accountSummaries: AccountSummary[] = input.accounts.map((a) => {
    const orderIndex = payoffOrderList.indexOf(a.id);
    return {
      accountId: a.id,
      startingBalance: a.balance,
      totalPaid: paidByAccount.get(a.id) ?? 0,
      totalInterest: interestByAccount.get(a.id) ?? 0,
      payoffMonth: payoffMonths.get(a.id) ?? MAX_MONTHS,
      payoffDate: getDateString(payoffMonths.get(a.id) ?? MAX_MONTHS),
      payoffOrder: orderIndex >= 0 ? orderIndex + 1 : 0,
    };
  });

  const allPaidOff = working.every((a) => a.currentBalance <= 0);

  return {
    strategy: input.strategy,
    monthsToPayoff: allPaidOff ? month : MAX_MONTHS,
    totalInterestPaid: roundMoney(totalInterestPaid),
    totalPaid: roundMoney(totalPaid),
    payoffFeasible: allPaidOff,
    warning: allPaidOff
      ? undefined
      : "Payoff simulation exceeded maximum timeline.",
    schedule,
    monthlyBreakdown,
    accountSummaries,
    focusAccountId,
  };
}
