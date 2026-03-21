import { useState, useRef } from "react";
import { extractTextFromPdf } from "../lib/pdf";
import { extractStatement, type ExtractedFields } from "../lib/commands";

interface Props {
  onExtracted: (fields: ExtractedFields) => void;
  onManual: () => void;
}

export default function StatementUpload({ onExtracted, onManual }: Props) {
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
          "We couldn't read enough from this PDF. It might be corrupted or not a credit card statement. You can always enter your details by hand."
        );
        setStatus("error");
        return;
      }

      setStatus("extracting");
      const fields = await extractStatement(result.text);
      onExtracted(fields);
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
    <div>
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
        className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
          dragOver
            ? "border-brand-400 bg-brand-50"
            : "border-gray-200 hover:border-brand-300 hover:bg-warm-50 bg-white"
        }`}
      >
        {status === "idle" && (
          <>
            <div className="text-4xl mb-3 text-gray-300">&#128196;</div>
            <p className="font-medium text-gray-700">
              Drop a credit card statement here
            </p>
            <p className="text-sm text-gray-400 mt-1">
              or click to browse — digital and scanned PDFs both work
            </p>
          </>
        )}

        {status === "reading" && (
          <div>
            <div className="text-4xl mb-3 animate-pulse">&#128196;</div>
            <p className="text-gray-600">Reading your statement...</p>
          </div>
        )}

        {status === "ocr" && (
          <div>
            <div className="text-4xl mb-3 animate-pulse">&#128065;</div>
            <p className="text-gray-600">
              {progressMsg || "Scanning your document..."}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Scanned PDFs take a bit longer — hang tight
            </p>
          </div>
        )}

        {status === "extracting" && (
          <div>
            <div className="text-4xl mb-3 animate-pulse">&#129302;</div>
            <p className="text-gray-600">
              Pulling out the important numbers...
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Almost there
            </p>
          </div>
        )}

        {status === "error" && (
          <div>
            <p className="text-amber-600 text-sm mb-2">{error}</p>
            <p className="text-gray-400 text-sm">
              Click to try another file
            </p>
          </div>
        )}
      </div>

      <button
        onClick={onManual}
        className="text-sm text-gray-400 hover:text-gray-600 mt-3 underline"
      >
        I'd rather type it in myself
      </button>
    </div>
  );
}
