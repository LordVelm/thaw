export type Strategy = "avalanche" | "snowball";

export interface BalanceTier {
  id: string;
  label?: string;
  balance: number;
  apr: number;
  promoExpirationDate?: string;
  postPromoApr?: number;
}

export interface DebtAccount {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
  tiers: BalanceTier[];
}

export function ensureTiers(account: DebtAccount): DebtAccount {
  if (account.tiers && account.tiers.length > 0) return account;
  return {
    ...account,
    tiers: [{ id: "tier-1", balance: account.balance, apr: account.apr }],
  };
}

export function normalizeAccount(account: DebtAccount): DebtAccount {
  const totalBalance = account.tiers.reduce((s, t) => s + t.balance, 0);
  const maxApr = account.tiers.length > 0
    ? Math.max(...account.tiers.map((t) => t.apr))
    : 0;
  return { ...account, balance: totalBalance, apr: maxApr };
}

export interface PlanInput {
  monthlyBudget: number;
  strategy: Strategy;
  accounts: DebtAccount[];
}

export interface ScheduleRow {
  monthIndex: number;
  accountId: string;
  payment: number;
  interest: number;
  principal: number;
  endingBalance: number;
}

export interface MonthlyBreakdown {
  monthIndex: number;
  /** Calendar date string (YYYY-MM) for display */
  date: string;
  payments: { accountId: string; amount: number }[];
  totalPayment: number;
  /** Balances at end of this month */
  endingBalances: { accountId: string; balance: number }[];
  /** Accounts that reach $0 this month */
  accountsPaidOff: string[];
}

export interface AccountSummary {
  accountId: string;
  startingBalance: number;
  totalPaid: number;
  totalInterest: number;
  payoffMonth: number;
  payoffDate: string;
  /** 1-based order in which this account is paid off */
  payoffOrder: number;
}

export interface PlanResult {
  strategy: Strategy;
  monthsToPayoff: number;
  totalInterestPaid: number;
  totalPaid: number;
  payoffFeasible: boolean;
  warning?: string;
  schedule: ScheduleRow[];
  monthlyBreakdown: MonthlyBreakdown[];
  accountSummaries: AccountSummary[];
  /** Suggested first month: which account gets the extra payment */
  focusAccountId?: string;
}
