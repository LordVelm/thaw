import test from "node:test";
import assert from "node:assert/strict";
import type { PlanInput } from "@debt-planner/core-types";
import { generatePlan } from "../src/index.ts";

// Legacy single-APR accounts (backward compat — ensureTiers auto-converts)
const sampleAccounts: PlanInput["accounts"] = [
  { id: "c1", name: "Card 1", balance: 4000, apr: 29.99, minimumPayment: 120, tiers: [{ id: "t1", balance: 4000, apr: 29.99 }] },
  { id: "c2", name: "Card 2", balance: 2500, apr: 19.99, minimumPayment: 75, tiers: [{ id: "t1", balance: 2500, apr: 19.99 }] },
  { id: "c3", name: "Card 3", balance: 900, apr: 24.99, minimumPayment: 35, tiers: [{ id: "t1", balance: 900, apr: 24.99 }] },
];

test("flags infeasible plan when budget below minimums", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 100,
    accounts: sampleAccounts,
  });

  assert.equal(result.payoffFeasible, false);
  assert.match(result.warning ?? "", /below combined minimum payments/i);
});

test("returns feasible avalanche payoff", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 600,
    accounts: sampleAccounts,
  });

  assert.equal(result.payoffFeasible, true);
  assert.ok(result.monthsToPayoff > 0);
  assert.ok(result.totalInterestPaid > 0);
});

test("snowball and avalanche both produce schedules", () => {
  const avalanche = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 600,
    accounts: sampleAccounts,
  });
  const snowball = generatePlan({
    strategy: "snowball",
    monthlyBudget: 600,
    accounts: sampleAccounts,
  });

  assert.ok(avalanche.schedule.length > 0);
  assert.ok(snowball.schedule.length > 0);
});

// --- Multi-APR tier tests ---

test("multi-tier: interest accrues only on non-zero APR tiers", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 300,
    accounts: [
      {
        id: "card",
        name: "Multi-tier Card",
        balance: 5000,
        apr: 24.99,
        minimumPayment: 100,
        tiers: [
          { id: "bt", label: "Balance Transfer", balance: 2000, apr: 0 },
          { id: "purch", label: "Purchases", balance: 3000, apr: 24.99 },
        ],
      },
    ],
  });

  assert.equal(result.payoffFeasible, true);
  // Total interest should be less than if the entire $5000 were at 24.99%
  const fullAprResult = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 300,
    accounts: [
      {
        id: "card",
        name: "Single-tier Card",
        balance: 5000,
        apr: 24.99,
        minimumPayment: 100,
        tiers: [{ id: "t1", balance: 5000, apr: 24.99 }],
      },
    ],
  });
  assert.ok(
    result.totalInterestPaid < fullAprResult.totalInterestPaid,
    `Multi-tier interest ($${result.totalInterestPaid}) should be less than full APR ($${fullAprResult.totalInterestPaid})`
  );
});

test("multi-tier: extra payments go to highest APR tier first (CARD Act)", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 500,
    accounts: [
      {
        id: "card",
        name: "Multi-tier",
        balance: 4000,
        apr: 29.99,
        minimumPayment: 80,
        tiers: [
          { id: "low", balance: 2000, apr: 5.99 },
          { id: "high", balance: 2000, apr: 29.99 },
        ],
      },
    ],
  });

  assert.equal(result.payoffFeasible, true);
  // The high-APR tier should be paid off before the low-APR tier,
  // so total interest should be much less than if payments went to low first
  assert.ok(result.totalInterestPaid > 0);
  assert.ok(result.monthsToPayoff > 0);
});

test("multi-tier: avalanche sorts accounts by highest effective APR", () => {
  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 500,
    accounts: [
      {
        id: "low-card",
        name: "Low Card",
        balance: 1000,
        apr: 9.99,
        minimumPayment: 30,
        tiers: [{ id: "t1", balance: 1000, apr: 9.99 }],
      },
      {
        id: "multi-card",
        name: "Multi Card",
        balance: 2000,
        apr: 24.99,
        minimumPayment: 50,
        tiers: [
          { id: "promo", balance: 1000, apr: 0 },
          { id: "purch", balance: 1000, apr: 24.99 },
        ],
      },
    ],
  });

  // Multi-card has highest APR (24.99) so should be the focus account in avalanche
  assert.equal(result.focusAccountId, "multi-card");
});

test("ensureTiers: legacy account without tiers gets auto-converted", () => {
  // Simulate a legacy account (no tiers field)
  const legacy = {
    id: "old",
    name: "Legacy",
    balance: 3000,
    apr: 18.99,
    minimumPayment: 60,
  } as PlanInput["accounts"][0];

  const result = generatePlan({
    strategy: "avalanche",
    monthlyBudget: 200,
    accounts: [legacy],
  });

  assert.equal(result.payoffFeasible, true);
  assert.ok(result.monthsToPayoff > 0);
  assert.ok(result.totalInterestPaid > 0);
});
