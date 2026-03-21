import { useState, useEffect } from "react";
import {
  setupAi,
  onDownloadProgress,
  type DownloadProgress,
} from "../lib/commands";

interface Props {
  onComplete: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return (bytes / Math.pow(1024, i)).toFixed(1) + " " + units[i];
}

export default function SetupScreen({ onComplete }: Props) {
  const [status, setStatus] = useState<"ready" | "downloading" | "error">(
    "ready"
  );
  const [progress, setProgress] = useState<DownloadProgress | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const unlisten = onDownloadProgress((p) => setProgress(p));
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function handleSetup() {
    setStatus("downloading");
    setError("");
    try {
      await setupAi();
      onComplete();
    } catch (e) {
      setError(String(e));
      setStatus("error");
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-warm-50">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
        <p className="text-4xl mb-4">&#127793;</p>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Welcome to Thaw
        </h1>
        <p className="text-gray-500 text-sm mb-6 leading-relaxed">
          Before we get started, the app needs to download a small AI model
          (~2 GB) so it can read your credit card statements. This is a
          one-time thing.
        </p>

        {status === "ready" && (
          <button
            onClick={handleSetup}
            className="bg-brand-600 text-white px-6 py-3 rounded-xl text-sm font-semibold hover:bg-brand-700 w-full transition-colors shadow-sm"
          >
            Get started
          </button>
        )}

        {status === "downloading" && progress && (
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              {progress.stage}
            </p>
            <div className="w-full bg-warm-100 rounded-full h-3 mb-2">
              <div
                className="bg-brand-500 h-3 rounded-full transition-all duration-300"
                style={{ width: `${Math.min(progress.percent, 100)}%` }}
              />
            </div>
            <p className="text-xs text-gray-400">
              {formatBytes(progress.downloaded)}
              {progress.total > 0 && <> / {formatBytes(progress.total)}</>}
              {" — "}
              {progress.percent.toFixed(0)}%
            </p>
          </div>
        )}

        {status === "downloading" && !progress && (
          <p className="text-sm text-gray-400 animate-pulse">
            Getting things ready...
          </p>
        )}

        {status === "error" && (
          <div>
            <p className="text-amber-600 text-sm mb-3">{error}</p>
            <button
              onClick={handleSetup}
              className="bg-brand-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        <p className="text-xs text-gray-300 mt-6">
          Everything runs on your computer. No cloud, no accounts, no data
          leaves your machine.
        </p>
      </div>
    </div>
  );
}
