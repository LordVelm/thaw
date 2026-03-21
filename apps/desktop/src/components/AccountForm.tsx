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

  function handleAdd() {
    const b = parseFloat(balance);
    const a = parseFloat(apr);
    const m = parseFloat(minPayment);

    if (!name.trim()) { setError("Enter a card name"); return; }
    if (isNaN(b) || b <= 0) { setError("Enter a valid balance"); return; }
    if (isNaN(a) || a < 0) { setError("Enter a valid APR"); return; }
    if (isNaN(m) || m <= 0) { setError("Enter a valid min payment"); return; }

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
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-2 items-end">
      <label className="flex flex-col text-xs text-gray-600">
        Card Name
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Chase Sapphire"
          className="border border-gray-300 rounded px-2 py-1.5 mt-0.5 w-44 text-sm text-gray-900"
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
          className="border border-gray-300 rounded px-2 py-1.5 mt-0.5 w-28 text-sm text-gray-900"
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
          className="border border-gray-300 rounded px-2 py-1.5 mt-0.5 w-24 text-sm text-gray-900"
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
          className="border border-gray-300 rounded px-2 py-1.5 mt-0.5 w-28 text-sm text-gray-900"
        />
      </label>
      <button
        type="button"
        onClick={handleAdd}
        className="bg-gray-800 text-white text-sm px-4 py-1.5 rounded hover:bg-gray-900"
      >
        Add Account
      </button>
      {error && <p className="w-full text-red-500 text-xs mt-1">{error}</p>}
    </form>
  );
}
