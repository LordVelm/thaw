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
      .catch(() => {});
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
    <div className="fixed inset-0 bg-black/20 flex items-start justify-center pt-24 z-50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-800">Settings</h2>
          <button
            onClick={onClose}
            className="text-gray-300 hover:text-gray-500 text-xl leading-none transition-colors"
          >
            &times;
          </button>
        </div>

        {/* GPU Section */}
        <div className="border border-gray-100 rounded-xl p-4 bg-warm-50">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            AI speed
          </h3>

          {gpu === null ? (
            <p className="text-xs text-gray-400">Checking your hardware...</p>
          ) : (
            <>
              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">NVIDIA GPU</span>
                  <span
                    className={
                      gpu.gpuDetected
                        ? "text-green-600 font-medium"
                        : "text-gray-400"
                    }
                  >
                    {gpu.gpuDetected ? "Detected" : "Not found"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">GPU acceleration</span>
                  <span
                    className={
                      gpu.cudaBuild
                        ? "text-green-600 font-medium"
                        : "text-gray-400"
                    }
                  >
                    {gpu.cudaBuild ? "Available" : "Not available"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Use GPU for AI</span>
                  <button
                    onClick={handleToggle}
                    disabled={!gpu.cudaBuild || toggling}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      gpu.usingGpu ? "bg-brand-500" : "bg-gray-300"
                    } ${
                      !gpu.cudaBuild || toggling
                        ? "opacity-40 cursor-not-allowed"
                        : "cursor-pointer"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform shadow-sm ${
                        gpu.usingGpu ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                </div>
              </div>

              {!gpu.gpuDetected && (
                <p className="text-xs text-gray-400 mt-3">
                  No GPU found — that's totally fine. Everything works on CPU,
                  just a bit slower for statement reading.
                </p>
              )}

              {gpu.gpuDetected && !gpu.cudaBuild && (
                <p className="text-xs text-amber-600 mt-3">
                  GPU found but the CPU version is installed. To switch, remove
                  the AI files and re-run setup.
                </p>
              )}

              {toggling && (
                <p className="text-xs text-brand-600 mt-3 animate-pulse">
                  Restarting the AI engine...
                </p>
              )}

              {error && (
                <p className="text-xs text-amber-600 mt-3">{error}</p>
              )}
            </>
          )}
        </div>

        <div className="mt-5 text-right">
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-gray-600 px-4 py-2 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
