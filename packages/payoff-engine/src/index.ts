import type {
  DebtAccount,
  PlanInput,
  PlanResult,
  ScheduleRow,
  MonthlyBreakdown,
  AccountSummary,
  Strategy,
} from "@debt-planner/core-types";

type MutableAccount = DebtAccount & { currentBalance: number };

const CENTS = 100;
const MAX_MONTHS = 1200;

function roundMoney(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

function sortForStrategy(
  strategy: Strategy,
  accounts: MutableAccount[]
): MutableAccount[] {
  if (strategy === "avalanche") {
    return [...accounts].sort(
      (a, b) => b.apr - a.apr || b.currentBalance - a.currentBalance
    );
  }
  return [...accounts].sort(
    (a, b) => a.currentBalance - b.currentBalance || b.apr - a.apr
  );
}

function getDateString(monthsFromNow: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function generatePlan(input: PlanInput): PlanResult {
  const working = input.accounts.map((a) => ({
    ...a,
    currentBalance: roundMoney(a.balance),
  }));

  const schedule: ScheduleRow[] = [];
  const monthlyBreakdown: MonthlyBreakdown[] = [];

  // Track per-account interest
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

  // Determine which account gets extra payments first
  const focusSorted = sortForStrategy(input.strategy, [...working]);
  const focusAccountId = focusSorted.length > 0 ? focusSorted[0].id : undefined;

  while (month < MAX_MONTHS) {
    const openAccounts = working.filter((a) => a.currentBalance > 0);
    if (openAccounts.length === 0) break;

    month += 1;

    // Track interest accrued this month per account
    const monthInterest = new Map<string, number>();

    // Step 1: Accrue interest
    for (const account of openAccounts) {
      const monthlyRate = account.apr / 100 / 12;
      const interest = roundMoney(account.currentBalance * monthlyRate);
      account.currentBalance = roundMoney(account.currentBalance + interest);
      totalInterestPaid = roundMoney(totalInterestPaid + interest);
      monthInterest.set(account.id, interest);
      interestByAccount.set(
        account.id,
        roundMoney((interestByAccount.get(account.id) ?? 0) + interest)
      );
    }

    // Track payments this month for breakdown
    const monthPayments = new Map<string, number>();
    let monthTotalPayment = 0;

    // Step 2: Pay minimums
    for (const account of openAccounts) {
      const minDue = Math.min(account.minimumPayment, account.currentBalance);
      if (minDue <= 0) continue;
      account.currentBalance = roundMoney(account.currentBalance - minDue);
      monthPayments.set(account.id, (monthPayments.get(account.id) ?? 0) + minDue);
      monthTotalPayment = roundMoney(monthTotalPayment + minDue);
    }

    // Step 3: Allocate surplus by strategy
    let remainingBudget = roundMoney(input.monthlyBudget - monthTotalPayment);
    const priority = sortForStrategy(
      input.strategy,
      working.filter((a) => a.currentBalance > 0)
    );

    for (const account of priority) {
      if (remainingBudget <= 0) break;
      const extra = Math.min(remainingBudget, account.currentBalance);
      if (extra <= 0) continue;
      account.currentBalance = roundMoney(account.currentBalance - extra);
      remainingBudget = roundMoney(remainingBudget - extra);
      monthPayments.set(account.id, roundMoney((monthPayments.get(account.id) ?? 0) + extra));
      monthTotalPayment = roundMoney(monthTotalPayment + extra);
    }

    totalPaid = roundMoney(totalPaid + monthTotalPayment);

    // Update per-account paid totals
    for (const [id, payment] of monthPayments) {
      paidByAccount.set(id, roundMoney((paidByAccount.get(id) ?? 0) + payment));
    }

    // Check for accounts just paid off
    const paidOffThisMonth: string[] = [];
    for (const account of working) {
      if (account.currentBalance <= 0 && !payoffMonths.has(account.id)) {
        payoffMonths.set(account.id, month);
        payoffOrderList.push(account.id);
        paidOffThisMonth.push(account.id);
      }
    }

    // Build schedule rows (one per account per month, with interest)
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

    // Build monthly breakdown
    const payments = [...monthPayments.entries()].map(([accountId, amount]) => ({
      accountId,
      amount,
    }));
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

  // Build account summaries
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
    warning: allPaidOff ? undefined : "Payoff simulation exceeded maximum timeline.",
    schedule,
    monthlyBreakdown,
    accountSummaries,
    focusAccountId,
  };
}
