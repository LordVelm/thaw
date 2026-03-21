import type { DebtAccount, PlanInput, PlanResult, Strategy } from "@debt-planner/core-types";

type MutableAccount = DebtAccount & { currentBalance: number };

const CENTS = 100;
const MAX_MONTHS = 1200;

function roundMoney(value: number): number {
  return Math.round(value * CENTS) / CENTS;
}

function sortForStrategy(strategy: Strategy, accounts: MutableAccount[]): MutableAccount[] {
  if (strategy === "avalanche") {
    return [...accounts].sort((a, b) => b.apr - a.apr || b.currentBalance - a.currentBalance);
  }
  return [...accounts].sort((a, b) => a.currentBalance - b.currentBalance || b.apr - a.apr);
}

export function generatePlan(input: PlanInput): PlanResult {
  const working = input.accounts.map((a) => ({ ...a, currentBalance: roundMoney(a.balance) }));
  const schedule: PlanResult["schedule"] = [];

  const minimumTotal = roundMoney(working.reduce((acc, x) => acc + x.minimumPayment, 0));
  if (input.monthlyBudget < minimumTotal) {
    return {
      strategy: input.strategy,
      monthsToPayoff: 0,
      totalInterestPaid: 0,
      payoffFeasible: false,
      warning: "Monthly budget is below combined minimum payments.",
      schedule
    };
  }

  let month = 0;
  let totalInterestPaid = 0;

  while (month < MAX_MONTHS) {
    const openAccounts = working.filter((a) => a.currentBalance > 0);
    if (openAccounts.length === 0) {
      return {
        strategy: input.strategy,
        monthsToPayoff: month,
        totalInterestPaid: roundMoney(totalInterestPaid),
        payoffFeasible: true,
        schedule
      };
    }

    month += 1;
    let remainingBudget = roundMoney(input.monthlyBudget);

    for (const account of openAccounts) {
      const monthlyRate = account.apr / 100 / 12;
      const interest = roundMoney(account.currentBalance * monthlyRate);
      account.currentBalance = roundMoney(account.currentBalance + interest);
      totalInterestPaid = roundMoney(totalInterestPaid + interest);
    }

    for (const account of openAccounts) {
      const minDue = Math.min(account.minimumPayment, account.currentBalance);
      if (minDue <= 0) continue;
      account.currentBalance = roundMoney(account.currentBalance - minDue);
      remainingBudget = roundMoney(remainingBudget - minDue);
      schedule.push({
        monthIndex: month,
        accountId: account.id,
        payment: minDue,
        interest: 0,
        principal: minDue,
        endingBalance: account.currentBalance
      });
    }

    const priority = sortForStrategy(input.strategy, working.filter((a) => a.currentBalance > 0));
    for (const account of priority) {
      if (remainingBudget <= 0) break;
      const extra = Math.min(remainingBudget, account.currentBalance);
      account.currentBalance = roundMoney(account.currentBalance - extra);
      remainingBudget = roundMoney(remainingBudget - extra);
      schedule.push({
        monthIndex: month,
        accountId: account.id,
        payment: extra,
        interest: 0,
        principal: extra,
        endingBalance: account.currentBalance
      });
    }
  }

  return {
    strategy: input.strategy,
    monthsToPayoff: MAX_MONTHS,
    totalInterestPaid: roundMoney(totalInterestPaid),
    payoffFeasible: false,
    warning: "Payoff simulation exceeded maximum timeline.",
    schedule
  };
}
