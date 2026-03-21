import { useState } from "react";
import type { ExtractedFields, FieldMeta } from "../lib/commands";
import type { DebtAccount } from "@debt-planner/core-types";

interface Props {
  fields: ExtractedFields;
  onConfirm: (account: DebtAccount) => void;
  onCancel: () => void;
}

let nextId = 1;

function ConfidenceBadge({ meta }: { meta?: FieldMeta | null }) {
  if (!meta?.confidence) return null;

  const colors = {
    high: "bg-green-50 text-green-600",
    medium: "bg-amber-50 text-amber-600",
    low: "bg-orange-50 text-orange-600",
  };

  return (
    <span
      className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
        colors[meta.confidence] ?? "bg-gray-100 text-gray-400"
      }`}
      title={meta.source ? `Found: "${meta.source}"` : undefined}
    >
      {meta.confidence}
    </span>
  );
}

function SourceSnippet({ meta }: { meta?: FieldMeta | null }) {
  if (!meta?.source) return null;

  return (
    <span
      className="text-[10px] text-gray-300 block mt-0.5 truncate"
      title={meta.source}
    >
      &ldquo;{meta.source}&rdquo;
    </span>
  );
}

export default function ReviewExtraction({
  fields,
  onConfirm,
  onCancel,
}: Props) {
  const isDeferred = fields.isDeferredInterest === true;
  const meta = fields.fieldMeta;

  const [cardName, setCardName] = useState(fields.cardName ?? "");
  const [balance, setBalance] = useState(
    fields.statementBalance?.toString() ?? ""
  );
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
      setError("What's the name of this card?");
      return;
    }
    if (isNaN(b) || b <= 0) {
      setError("We need a valid balance to work with.");
      return;
    }
    if (isNaN(a) || a < 0) {
      setError("Please enter a valid APR (you can use 0 for promo rates).");
      return;
    }
    if (isNaN(m) || m <= 0) {
      setError("What's the minimum payment on this card?");
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

  function fieldLabel(value: string | number | boolean | null | undefined) {
    if (value == null) return { text: "needs your help", color: "text-amber-500" };
    if (typeof value === "number") return { text: "found", color: "text-green-500" };
    if (typeof value === "boolean") return value
      ? { text: "found", color: "text-green-500" }
      : { text: "needs your help", color: "text-amber-500" };
    return String(value)
      ? { text: "found", color: "text-green-500" }
      : { text: "needs your help", color: "text-amber-500" };
  }

  const inputClass =
    "border border-gray-200 rounded-lg px-3 py-2 mt-1 text-sm text-gray-900 focus:ring-2 focus:ring-brand-200 focus:border-brand-400 outline-none transition-all";

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
      <h3 className="font-semibold text-base text-gray-800 mb-1">
        Here's what we found
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Double-check these numbers and fix anything that doesn't look right.
      </p>

      {isDeferred && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
          <p className="text-sm font-medium text-amber-800">
            This looks like a promotional financing plan
          </p>
          <p className="text-xs text-amber-700 mt-1 leading-relaxed">
            The balance has deferred interest — meaning no interest now, but
            it kicks in if not paid off in time.
            {fields.deferredInterestEndDate && (
              <>
                {" "}The rate jumps to{" "}
                <strong>{fields.deferredInterestApr ?? "?"}%</strong> if not
                cleared by{" "}
                <strong>{fields.deferredInterestEndDate}</strong>.
              </>
            )}
          </p>
          <div className="flex flex-col gap-2 mt-3">
            <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer">
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
              Plan for worst case — use {fields.deferredInterestApr ?? "?"}% rate
            </label>
            <label className="flex items-center gap-2 text-xs text-amber-800 cursor-pointer">
              <input
                type="radio"
                name="aprChoice"
                checked={!useDeferred}
                onChange={() => {
                  setUseDeferred(false);
                  setApr("0");
                }}
              />
              I'll pay it off before the promo ends — use 0%
            </label>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            Card Name
            <span className={fieldLabel(fields.cardName).color}>
              {fieldLabel(fields.cardName).text}
            </span>
            <ConfidenceBadge meta={meta?.cardName} />
          </span>
          <SourceSnippet meta={meta?.cardName} />
          <input
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            Statement Balance ($)
            <span className={fieldLabel(fields.statementBalance).color}>
              {fieldLabel(fields.statementBalance).text}
            </span>
            <ConfidenceBadge meta={meta?.statementBalance} />
          </span>
          <SourceSnippet meta={meta?.statementBalance} />
          <input
            type="number"
            step="0.01"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            APR (%)
            {isDeferred ? (
              <span className="text-amber-500">
                {useDeferred ? "using deferred rate" : "using 0% promo"}
              </span>
            ) : (
              <>
                <span className={fieldLabel(fields.apr).color}>
                  {fieldLabel(fields.apr).text}
                </span>
                <ConfidenceBadge meta={meta?.apr} />
              </>
            )}
          </span>
          {!isDeferred && <SourceSnippet meta={meta?.apr} />}
          <input
            type="number"
            step="0.01"
            value={apr}
            onChange={(e) => setApr(e.target.value)}
            className={inputClass}
          />
        </label>

        <label className="flex flex-col text-xs text-gray-600">
          <span className="flex items-center gap-1.5">
            Minimum Payment ($)
            <span className={fieldLabel(fields.minimumPayment).color}>
              {fieldLabel(fields.minimumPayment).text}
            </span>
            <ConfidenceBadge meta={meta?.minimumPayment} />
          </span>
          <SourceSnippet meta={meta?.minimumPayment} />
          <input
            type="number"
            step="0.01"
            value={minPayment}
            onChange={(e) => setMinPayment(e.target.value)}
            className={inputClass}
          />
        </label>

        {fields.dueDate && (
          <div className="flex flex-col text-xs text-gray-600">
            <span className="flex items-center gap-1.5">
              Due Date
              <ConfidenceBadge meta={meta?.dueDate} />
            </span>
            <SourceSnippet meta={meta?.dueDate} />
            <p className="border border-gray-100 bg-warm-50 rounded-lg px-3 py-2 mt-1 text-sm text-gray-700">
              {fields.dueDate}
            </p>
          </div>
        )}

        {fields.lastFour && (
          <div className="flex flex-col text-xs text-gray-600">
            <span>Card ending in</span>
            <p className="border border-gray-100 bg-warm-50 rounded-lg px-3 py-2 mt-1 text-sm text-gray-700">
              ****{fields.lastFour}
            </p>
          </div>
        )}

        {isDeferred && fields.deferredInterestEndDate && (
          <div className="flex flex-col text-xs text-gray-600">
            <span>Promo expires</span>
            <p className="border border-amber-100 bg-amber-50 rounded-lg px-3 py-2 mt-1 text-sm text-amber-800 font-medium">
              {fields.deferredInterestEndDate}
            </p>
          </div>
        )}
      </div>

      {error && (
        <p className="text-amber-600 text-xs mb-3">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          onClick={handleConfirm}
          className="bg-brand-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
        >
          Looks good — add this account
        </button>
        <button
          onClick={onCancel}
          className="text-gray-400 px-5 py-2.5 rounded-xl text-sm hover:text-gray-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
