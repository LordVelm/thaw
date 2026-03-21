import { useState } from "react";
import type { ExtractedFields } from "../lib/commands";
import type { DebtAccount } from "@debt-planner/core-types";

interface Props {
  fields: ExtractedFields;
  onConfirm: (account: DebtAccount) => void;
  onCancel: () => void;
}

let nextId = 1;

export default function ReviewExtraction({
  fields,
  onConfirm,
  onCancel,
}: Props) {
  const isDeferred = fields.isDeferredInterest === true;

  const [cardName, setCardName] = useState(fields.cardName ?? "");
  const [balance, setBalance] = useState(
    fields.statementBalance?.toString() ?? ""
  );
  // For deferred interest: default APR to the deferred rate (what they'll actually pay)
  const [apr, setApr] = useState(() => {
    if (isDeferred && fields.deferredInterestApr != null) {
      return fields.deferredInterestApr.toString();
    }
    return fields.apr?.toString() ?? "";
  });
  const [minPayment, setMinPayment] = useState(
    fields.minimumPayment?.toString() ?? ""
  );
  const [useDeferred, setUseDeferred] = useState(isDeferred);
  const [error, setError] = useState("");

  function handleConfirm() {
    const b = parseFloat(balance);
    const a = parseFloat(apr);
    const m = parseFloat(minPayment);

    if (!cardName.trim()) {
      setError("Card name is required");
      return;
    }
    if (isNaN(b) || b <= 0) {
      setError("Enter a valid balance");
      return;
    }
    if (isNaN(a) || a < 0) {
      setError("Enter a valid APR");
      return;
    }
    if (isNaN(m) || m <= 0) {
      setError("Enter a valid minimum payment");
      return;
    }

    setError("");
    onConfirm({
      id: `card-${nextId++}`,
      name: cardName.trim(),
      balance: b,
      apr: a,
      minimumPayment: m,
    });
  }

  function fieldStatus(value: string | number | boolean | null | undefined) {
    if (value == null) return "text-amber-500";
    if (typeof value === "number") return "text-green-600"; // 0 is a valid found value
    if (typeof value === "boolean") return value ? "text-green-600" : "text-amber-500";
    return String(value) ? "text-green-600" : "text-amber-500";
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6">
      <h3 className="font-semibold text-base mb-1">Review Extracted Data</h3>
      <p className="text-xs text-gray-500 mb-4">
        Verify the fields below and correct anything the AI got wrong.
      </p>

      {isDeferred && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4">
          <p className="text-sm font-medium text-amber-800">
            Deferred Interest Detected
          </p>
          <p className="text-xs text-amber-700 mt-1">
            This balance is under a promotional/deferred interest plan.
            {fields.deferredInterestEndDate && (
              <>
                {" "}Interest will be charged at{" "}
                <strong>{fields.deferredInterestApr ?? "?"}%</strong> if not
                paid in full by{" "}
                <strong>{fields.deferredInterestEndDate}</strong>.
              </>
            )}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <label className="flex items-center gap-1.5 text-xs text-amber-800 cursor-pointer">
              <input
                type="radio"
                name="aprChoice"
                checked={useDeferred}
                onChange={() => {
                  setUseDeferred(true);
                  setApr(
                    (fields.deferredInterestApr ?? fields.apr ?? 0).toString()
                  );
                }}
              />
              Use deferred rate ({fields.deferredInterestApr ?? "?"}%) for
              worst-case planning
            </label>
            <label className="flex items-center gap-1.5 text-xs text-amber-800 cursor-pointer">
              <input
                type="radio"
                name="aprChoice"
                checked={!useDeferred}
                onChange={() => {
                  setUseDeferred(false);
                  setApr("0");
                }}
              />
              Use 0% (plan to pay off before promo ends)
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1">
            Card Name
            <span className={fieldStatus(fields.cardName)}>
              {fields.cardName ? "  found" : "  not found"}
            </span>
          </span>
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 mt-1 text-sm text-gray-900"
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1">
            Statement Balance ($)
            <span className={fieldStatus(fields.statementBalance)}>
              {fields.statementBalance != null ? "  found" : "  not found"}
            </span>
          </span>
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 mt-1 text-sm text-gray-900"
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1">
            APR (%)
            {isDeferred ? (
              <span className="text-amber-500">
                {useDeferred ? "  using deferred rate" : "  using 0% promo"}
              </span>
            ) : (
              <span className={fieldStatus(fields.apr)}>
                {fields.apr != null ? "  found" : "  not found"}
              </span>
            )}
          </span>
          <input
            type="number"
            step="0.01"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 mt-1 text-sm text-gray-900"
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1">
            Minimum Payment ($)
            <span className={fieldStatus(fields.minimumPayment)}>
              {fields.minimumPayment != null ? "  found" : "  not found"}
            </span>
          </span>
          <input
            type="number"
            step="0.01"
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 mt-1 text-sm text-gray-900"
          />
        </label>

        {fields.dueDate && (
          <div className="flex flex-col text-xs text-gray-600">
            <span>Due Date</span>
            <p className="border border-gray-100 bg-gray-50 rounded px-3 py-2 mt-1 text-sm text-gray-700">
              {fields.dueDate}
            </p>
          </div>
        )}

        {fields.lastFour && (
          <div className="flex flex-col text-xs text-gray-600">
            <span>Card ending in</span>
            <p className="border border-gray-100 bg-gray-50 rounded px-3 py-2 mt-1 text-sm text-gray-700">
              ****{fields.lastFour}
            </p>
          </div>
        )}

        {isDeferred && fields.deferredInterestEndDate && (
          <div className="flex flex-col text-xs text-gray-600">
            <span>Promo Expires</span>
            <p className="border border-amber-100 bg-amber-50 rounded px-3 py-2 mt-1 text-sm text-amber-800 font-medium">
              {fields.deferredInterestEndDate}
            </p>
          </div>
        )}
      </div>

      {error && <p className="text-red-500 text-xs mb-3">{error}</p>}

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          className="bg-blue-600 text-white px-5 py-2 rounded text-sm hover:bg-blue-700"
        >
          Add Account
        </button>
        <button
          onClick={onCancel}
          className="text-gray-500 px-5 py-2 rounded text-sm hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
