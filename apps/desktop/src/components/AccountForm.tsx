import { useState } from "react";
import type { DebtAccount } from "@debt-planner/core-types";

let nextId = 1;

interface Props {
  onAdd: (account: DebtAccount) => void;
}

export default function AccountForm({ onAdd }: Props) {
  const [name, setName] = useState("");
  const [balance, setBalance] = useState("");
  const [apr, setApr] = useState("");
  const [minPayment, setMinPayment] = useState("");
  const [error, setError] = useState("");

  const inputClass =
    "border border-gray-200 rounded-lg px-2.5 py-2 mt-0.5 text-sm text-gray-900 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-all";

  function handleAdd() {
    const b = parseFloat(balance);
    const a = parseFloat(apr);
    const m = parseFloat(minPayment);

    if (!name.trim()) { setError("What's the name of this card?"); return; }
    if (isNaN(b) || b <= 0) { setError("Enter the current balance."); return; }
    if (isNaN(a) || a < 0) { setError("Enter the APR (use 0 for promo rates)."); return; }
    if (isNaN(m) || m <= 0) { setError("What's the minimum monthly payment?"); return; }

    setError("");
    onAdd({
      id: `card-${nextId++}`,
      name: name.trim(),
      balance: b,
      apr: a,
      minimumPayment: m,
    });

    setName("");
    setBalance("");
    setApr("");
    setMinPayment("");
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
      <div className="flex flex-wrap gap-3 items-end">
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
          Balance ($)
          <input
            type="number"
            min="0"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
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
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            placeholder="22.99"
            className={`${inputClass} w-24`}
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
        <button
          type="button"
          onClick={handleAdd}
          className="bg-brand-600 text-white text-sm px-5 py-2 rounded-xl font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          Add account
        </button>
      </div>
      {error && (
        <p className="text-amber-600 text-xs mt-2">{error}</p>
      )}
    </form>
  );
}
