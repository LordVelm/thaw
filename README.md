# Thaw

Local-first debt payoff planner. Upload your credit card statements or type in your balances, set a budget, and get a clear month-by-month plan to become debt-free.

Your data stays on your computer. Always.

## Features

- **PDF statement extraction** with local AI (Qwen2.5-3B via llama-server, no cloud)
- **Manual entry** with multi-tier balance support (promo APR + standard APR)
- **Budget calculator** with income/expense breakdown
- **Avalanche vs Snowball** strategy comparison with month-by-month schedule
- **GPU acceleration** with NVIDIA CUDA auto-detection, CPU fallback

## Tech stack

- **Desktop:** Tauri v2 + React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Backend:** Rust (Tauri commands, SQLite, LLM management)
- **AI:** llama.cpp (bundled, runs locally) + pdfjs-dist + Tesseract.js
- **Math:** Deterministic payoff engine with CARD Act tier-aware payment allocation

## Project structure

```
apps/desktop/          Tauri + React desktop app
packages/core-types/   Shared TypeScript type definitions
packages/payoff-engine/ Deterministic debt simulation logic (tested)
```

## Development

```bash
npm install
cd apps/desktop
npx tauri dev
```

## License

MIT
