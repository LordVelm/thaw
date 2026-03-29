import { useState, useRef } from "react";
import { extractTextFromPdf } from "../lib/pdf";
import { extractBankStatement, type ExtractedBudget } from "../lib/commands";

interface Props {
  onExtracted: (budget: ExtractedBudget) => void;
  onCancel: () => void;
}

export default function BankStatementUpload({ onExtracted, onCancel }: Props) {
  const [status, setStatus] = useState<
    "idle" | "reading" | "ocr" | "extracting" | "error"
  >("idle");
  const [progressMsg, setProgressMsg] = useState("");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("That doesn't look like a PDF. Try a different file?");
      setStatus("error");
      return;
    }

    try {
      setStatus("reading");
      setError("");
      setProgressMsg("");

      const result = await extractTextFromPdf(file, (msg) => {
        setStatus("ocr");
        setProgressMsg(msg);
      });

      if (result.text.trim().length < 50) {
        setError(
          "We couldn't read enough from this PDF. It might be corrupted or not a bank statement."
        );
        setStatus("error");
        return;
      }

      setStatus("extracting");
      const budget = await extractBankStatement(result.text);
      onExtracted(budget);
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  return (
    <div className="mb-4">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
        className="hidden"
        onChange={handleFileSelect}
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-brand-400 bg-brand-50"
            : "border-gray-200 hover:border-brand-300 hover:bg-warm-50 bg-white"
        }`}
      >
        {status === "idle" && (
          <>
            <p className="text-sm font-medium text-gray-600">
              Drop a bank statement here, or click to browse
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Checking or savings — PDF format
            </p>
          </>
        )}

        {status === "reading" && (
          <p className="text-sm text-gray-600 animate-pulse">
            Reading your statement...
          </p>
        )}

        {status === "ocr" && (
          <div>
            <p className="text-sm text-gray-600 animate-pulse">
              {progressMsg || "Scanning your document..."}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Scanned PDFs take a bit longer
            </p>
          </div>
        )}

        {status === "extracting" && (
          <p className="text-sm text-gray-600 animate-pulse">
            Finding your income and expenses...
          </p>
        )}

        {status === "error" && (
          <div>
            <p className="text-sm text-amber-600 mb-1">{error}</p>
            <p className="text-xs text-gray-400">Click to try another file</p>
          </div>
        )}
      </div>

      <button
        onClick={onCancel}
        className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline"
      >
        Cancel
      </button>
    </div>
  );
}
