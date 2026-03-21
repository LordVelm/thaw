import test from "node:test";
import assert from "node:assert/strict";
import type { PlanInput } from "@debt-planner/core-types";
import { generatePlan } from "../src/index.ts";

const sampleAccounts: PlanInput["accounts"] = [
  { id: "c1", name: "Card 1", balance: 4000, apr: 29.99, minimumPayment: 120 },
  { id: "c2", name: "Card 2", balance: 2500, apr: 19.99, minimumPayment: 75 },
  { id: "c3", name: "Card 3", balance: 900, apr: 24.99, minimumPayment: 35 }
];

test("flags infeasible plan when budget below minimums", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 100,
    accounts: sampleAccounts
  });

  assert.equal(result.payoffFeasible, false);
  assert.match(result.warning ?? "", /below combined minimum payments/i);
});

test("returns feasible avalanche payoff", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 600,
    accounts: sampleAccounts
  });

  assert.equal(result.payoffFeasible, true);
  assert.ok(result.monthsToPayoff > 0);
  assert.ok(result.totalInterestPaid > 0);
});

test("snowball and avalanche both produce schedules", () => {
  const avalanche = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 600,
    accounts: sampleAccounts
  });
  const snowball = generatePlan({
    strategy: "snowball",
    monthlyBudget: 600,
    accounts: sampleAccounts
  });

  assert.ok(avalanche.schedule.length > 0);
  assert.ok(snowball.schedule.length > 0);
});
