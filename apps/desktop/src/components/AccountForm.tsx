import { useState } from "react";
import type { DebtAccount, BalanceTier } from "@debt-planner/core-types";

let nextId = 1;
let nextTierId = 1;

interface TierInput {
  id: string;
  label: string;
  balance: string;
  apr: string;
  promoDate: string;
  postPromoApr: string;
}

function emptyTier(): TierInput {
  return {
    id: `tier-${nextTierId++}`,
    label: "",
    balance: "",
    apr: "",
    promoDate: "",
    postPromoApr: "",
  };
}

interface Props {
  onAdd: (account: DebtAccount) => void;
}

export default function AccountForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [tiers, setTiers] = useState<TierInput[]>([emptyTier()]);
  const [error, setError] = useState("");

  const inputClass =
    "border border-gray-200 rounded-lg px-2.5 py-2 mt-0.5 text-base text-gray-900 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-all";

  function updateTier(index: number, field: keyof TierInput, value: string) {
    setTiers((prev) =>
      prev.map((t, i) => (i === index ? { ...t, [field]: value } : t))
    );
  }

  function addTier() {
    setTiers((prev) => [...prev, emptyTier()]);
  }

  function removeTier(index: number) {
    if (tiers.length <= 1) return;
    setTiers((prev) => prev.filter((_, i) => i !== index));
  }

  function handleAdd() {
    if (!name.trim()) {
      setError("What's the name of this card?");
      return;
    }

    const m = parseFloat(minPayment);
    if (isNaN(m) || m <= 0) {
      setError("What's the minimum monthly payment?");
      return;
    }

    const parsedTiers: BalanceTier[] = [];
    for (let i = 0; i < tiers.length; i++) {
      const t = tiers[i];
      const b = parseFloat(t.balance);
      const a = parseFloat(t.apr);
      if (isNaN(b) || b <= 0) {
        setError(`Tier ${i + 1}: enter a balance.`);
        return;
      }
      if (isNaN(a) || a < 0) {
        setError(`Tier ${i + 1}: enter the APR (use 0 for promo rates).`);
        return;
      }
      const tier: BalanceTier = {
        id: t.id,
        balance: b,
        apr: a,
      };
      if (t.label.trim()) tier.label = t.label.trim();
      if (t.promoDate.trim()) {
        tier.promoExpirationDate = t.promoDate.trim();
        const postApr = parseFloat(t.postPromoApr);
        if (!isNaN(postApr) && postApr > 0) tier.postPromoApr = postApr;
      }
      parsedTiers.push(tier);
    }

    const totalBalance = parsedTiers.reduce((s, t) => s + t.balance, 0);
    const maxApr = Math.max(...parsedTiers.map((t) => t.apr));

    setError("");
    onAdd({
      id: `card-${nextId++}`,
      name: name.trim(),
      balance: totalBalance,
      apr: maxApr,
      minimumPayment: m,
      tiers: parsedTiers,
    });

    setName("");
    setMinPayment("");
    setTiers([emptyTier()]);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    handleAdd();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5"
    >
      <p className="text-xs text-gray-400 mb-3">
        You'll find these numbers on your latest statement or in your card's
        app.
      </p>

      {/* Card name + minimum payment */}
      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="flex flex-col text-xs text-gray-600">
          Card Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Chase Sapphire"
            className={`${inputClass} w-44`}
          />
        </label>
        <label className="flex flex-col text-xs text-gray-600">
          Min Payment ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
            placeholder="25"
            className={`${inputClass} w-28`}
          />
        </label>
      </div>

      {/* Balance tiers */}
      <div className="space-y-3 mb-4">
        <p className="text-xs font-medium text-gray-600">
          {tiers.length === 1 ? "Balance & APR" : "Balance tiers"}
        </p>
        {tiers.map((tier, i) => (
          <div
            key={tier.id}
            className="flex flex-wrap gap-2 items-end bg-warm-50 rounded-lg p-3"
          >
            {tiers.length > 1 && (
              <label className="flex flex-col text-xs text-gray-600">
                Label
                <input
                  value={tier.label}
                  onChange={(e) => updateTier(i, "label", e.target.value)}
                  placeholder="e.g. Purchases"
                  className={`${inputClass} w-28`}
                />
              </label>
            )}
            <label className="flex flex-col text-xs text-gray-600">
              Balance ($)
              <input
                type="number"
                min="0"
                step="0.01"
                value={tier.balance}
                onChange={(e) => updateTier(i, "balance", e.target.value)}
                placeholder="5000"
                className={`${inputClass} w-28`}
              />
            </label>
            <label className="flex flex-col text-xs text-gray-600">
              APR (%)
              <input
                type="number"
                min="0"
                step="0.01"
                value={tier.apr}
                onChange={(e) => updateTier(i, "apr", e.target.value)}
                placeholder="22.99"
                className={`${inputClass} w-24`}
              />
            </label>
            <label className="flex flex-col text-xs text-gray-600">
              Promo expires
              <input
                type="date"
                value={tier.promoDate}
                onChange={(e) => updateTier(i, "promoDate", e.target.value)}
                className={`${inputClass} w-36`}
              />
            </label>
            {tier.promoDate && (
              <label className="flex flex-col text-xs text-gray-600">
                Post-promo APR (%)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.postPromoApr}
                  onChange={(e) =>
                    updateTier(i, "postPromoApr", e.target.value)
                  }
                  placeholder="24.99"
                  className={`${inputClass} w-24`}
                />
              </label>
            )}
            {tiers.length > 1 && (
              <button
                type="button"
                onClick={() => removeTier(i)}
                className="text-xs text-gray-300 hover:text-red-400 transition-colors pb-2"
              >
                Remove
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={addTier}
          className="text-xs text-brand-600 hover:text-brand-700 underline"
        >
          + Add another rate tier
        </button>
      </div>

      <button
        type="button"
        onClick={handleAdd}
        className="bg-brand-600 text-white text-sm px-5 py-2 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-sm"
      >
        Add account
      </button>

      {error && <p className="text-amber-600 text-xs mt-2">{error}</p>}
    </form>
  );
}
