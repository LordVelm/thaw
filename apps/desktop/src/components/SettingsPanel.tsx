import { useState, useEffect } from "react";
import {
  getGpuStatus,
  setGpuEnabled,
  type GpuStatus,
} from "../lib/commands";

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const [gpu, setGpu] = useState<GpuStatus | null>(null);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    getGpuStatus()
      .then(setGpu)
      .catch(() => {
        // Not available in browser dev mode
      });
  }, []);

  async function handleToggle() {
    if (!gpu || toggling) return;
    setToggling(true);
    setError("");

    try {
      const newState = !gpu.usingGpu;
      await setGpuEnabled(newState);
      setGpu({ ...gpu, usingGpu: newState });
    } catch (e) {
      setError(String(e));
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 flex items-start justify-center pt-24 z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            &times;
          </button>
        </div>

        {/* GPU Section */}
        <div className="border border-gray-200 rounded-lg p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">
            AI Acceleration
          </h3>

          {gpu === null ? (
            <p className="text-xs text-gray-400">Loading GPU status...</p>
          ) : (
            <>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">NVIDIA GPU</span>
                  <span className={gpu.gpuDetected ? "text-green-600 font-medium" : "text-gray-400"}>
                    {gpu.gpuDetected ? "Detected" : "Not detected"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">CUDA build</span>
                  <span className={gpu.cudaBuild ? "text-green-600 font-medium" : "text-gray-400"}>
                    {gpu.cudaBuild ? "Installed" : "Not installed"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Use GPU for AI</span>
                  <button
                    onClick={handleToggle}
                    disabled={!gpu.cudaBuild || toggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gpu.usingGpu
                        ? "bg-blue-600"
                        : "bg-gray-300"
                    } ${(!gpu.cudaBuild || toggling) ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        gpu.usingGpu ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {!gpu.gpuDetected && (
                <p className="text-xs text-gray-400 mt-2">
                  No NVIDIA GPU detected. AI runs on CPU, which is slower but
                  works fine.
                </p>
              )}

              {gpu.gpuDetected && !gpu.cudaBuild && (
                <p className="text-xs text-amber-600 mt-2">
                  GPU detected but CPU build is installed. To use GPU, delete the
                  AI engine files and re-run setup.
                </p>
              )}

              {toggling && (
                <p className="text-xs text-blue-600 mt-2 animate-pulse">
                  Restarting AI engine...
                </p>
              )}

              {error && (
                <p className="text-xs text-red-600 mt-2">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="mt-4 text-right">
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
