export type Strategy = "avalanche" | "snowball";

export interface DebtAccount {
  id: string;
  name: string;
  balance: number;
  apr: number;
  minimumPayment: number;
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

export interface PlanResult {
  strategy: Strategy;
  monthsToPayoff: number;
  totalInterestPaid: number;
  payoffFeasible: boolean;
  warning?: string;
  schedule: ScheduleRow[];
}
