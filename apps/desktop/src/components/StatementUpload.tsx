import { useState, useRef } from "react";
import { extractTextFromPdf } from "../lib/pdf";
import { extractStatement, type ExtractedFields } from "../lib/commands";

interface Props {
  onExtracted: (fields: ExtractedFields) => void;
  onManual: () => void;
}

export default function StatementUpload({ onExtracted, onManual }: Props) {
  const [status, setStatus] = useState<
    "idle" | "reading" | "extracting" | "error"
  >("idle");
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFile(file: File) {
    if (file.type !== "application/pdf") {
      setError("Please upload a PDF file.");
      setStatus("error");
      return;
    }

    try {
      setStatus("reading");
      setError("");
      const text = await extractTextFromPdf(file);

      if (text.trim().length < 50) {
        setError(
          "Could not extract enough text from this PDF. It may be a scanned image — try a digital statement instead."
        );
        setStatus("error");
        return;
      }

      setStatus("extracting");
      const fields = await extractStatement(text);
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
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 hover:border-gray-400 bg-white"
        }`}
      >
        {status === "idle" && (
          <>
            <div className="text-4xl mb-3 text-gray-400">&#128196;</div>
            <p className="font-medium text-gray-700">
              Drop a credit card statement PDF here
            </p>
            <p className="text-sm text-gray-400 mt-1">or click to browse</p>
          </>
        )}

        {status === "reading" && (
          <div>
            <div className="text-4xl mb-3 animate-pulse">&#128196;</div>
            <p className="text-gray-600">Reading PDF...</p>
          </div>
        )}

        {status === "extracting" && (
          <div>
            <div className="text-4xl mb-3 animate-pulse">&#129302;</div>
            <p className="text-gray-600">
              AI is extracting account details...
            </p>
            <p className="text-xs text-gray-400 mt-1">
              This may take a moment on first run
            </p>
          </div>
        )}

        {status === "error" && (
          <div>
            <p className="text-red-600 text-sm mb-2">{error}</p>
            <p className="text-gray-500 text-sm">Click to try another file</p>
          </div>
        )}
      </div>

      <button
        onClick={onManual}
        className="text-sm text-gray-400 hover:text-gray-600 mt-3 underline"
      >
        or add account manually
      </button>
    </div>
  );
}
