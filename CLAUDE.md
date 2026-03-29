# Claude handoff — debt-planner-local

Use this file as the single source of context for continuing this project. Path on disk: `C:\Users\Kareem\projects\debt-planner-local`.

---

## Product vision

- **What:** A **local-first** desktop program for people with many credit cards / credit card debt.
- **Flow:** User uploads **PDF statements** → a **lightweight local pipeline** (text extraction, OCR if needed, optional local LLM) extracts structured fields (balances, APRs, minimums, card names, due dates, etc.) → app shows a **debt payoff plan** with **avalanche** vs **snowball** comparison and **projected payoff date** if the user sticks to a monthly budget.
- **Why local:** Privacy — data stays on the machine; no cloud requirement by default.
- **Trust:** Debt **math must be deterministic** (not LLM-generated). LLM is for **extraction/normalization** only, with **provenance** (page, snippet) and **human review** for low-confidence fields.
- **Disclaimer:** Planning/educational tool only — not financial or legal advice.

---

## Planned stack (not all built yet)

| Layer | Choice | Notes |
|--------|--------|--------|
| Desktop shell | **Tauri v2** + **React 19** + **TypeScript** + **Vite 6** + **Tailwind 3** | `apps/desktop` — **fully scaffolded and building** |
| Monorepo | **npm workspaces** (root `package.json`) | `pnpm-workspace.yaml` exists but **`pnpm` was not available** on the dev machine; root scripts use `npm` |
| Shared types | `packages/core-types` | Implemented |
| Payoff engine | `packages/payoff-engine` | Implemented (v1) |
| DB (planned) | **SQLite** + encryption (**sqlcipher** or equivalent) | Not implemented |
| PDF extraction | **pdfjs-dist** in frontend + **llama-server** (llama.cpp) as subprocess | PDF text extraction + local LLM field extraction — **implemented** |
| Local LLM | **Qwen2.5-3B-Instruct** (Q4_K_M GGUF) via bundled **llama-server** | Auto-downloaded on first run (~2 GB); runs on CPU |

---

## Repository layout (current)

```
debt-planner-local/
  package.json              # npm workspaces root
  pnpm-workspace.yaml       # optional; aligns with folder glob pattern
  tsconfig.base.json
  README.md
  CLAUDE.md                 # this file
  apps/
    desktop/                # Tauri + React + Vite desktop app
      src/                  # React frontend
        App.tsx             # Main app with setup/upload/plan flow
        components/         # SetupScreen, StatementUpload, ReviewExtraction, AccountForm, BudgetCalculator, PlanResults, SettingsPanel
        lib/                # commands.ts (Tauri IPC + DB + GPU), pdf.ts (pdfjs-dist + Tesseract.js OCR)
      src-tauri/            # Rust backend
        src/lib.rs          # Tauri commands (AI, DB, GPU)
        src/llm.rs          # LLM management (download, server lifecycle, inference, GPU)
        src/db.rs           # SQLite database (accounts, budget)
        src/main.rs         # Binary entry point
  packages/
    core-types/             # shared TS types
    payoff-engine/          # generatePlan() + tests
  services/
    extractor/              # README placeholder — superseded by in-app extraction
  docs/
    architecture.md
    payoff-math.md
```

---

## What is already implemented

### `packages/core-types`

- Exports: `Strategy`, `DebtAccount`, `PlanInput`, `ScheduleRow`, `PlanResult`.
- File: `packages/core-types/src/index.ts`.

### `packages/payoff-engine`

- **`generatePlan(input: PlanInput): PlanResult`** in `packages/payoff-engine/src/index.ts`.
- **Behavior (v1):**
  - Monthly loop, max **1200** months safety cap.
  - If `monthlyBudget` **< sum of minimum payments** → `payoffFeasible: false`, warning string.
  - Each month: accrue interest on open balances (`apr / 100 / 12`), pay **minimums** first (capped at current balance), then allocate **remaining budget** to one target account by strategy:
    - **Avalanche:** highest APR first (tie-break: higher balance).
    - **Snowball:** lowest balance first (tie-break: higher APR).
  - Money rounded to **cents** (`roundMoney`).
- **Caveat for future work:** `ScheduleRow.interest` is often **0** on payment lines; interest is applied at the **start** of the month but **not** split per payment row in the schedule yet — improve if UI needs per-line interest attribution.
- **Tests:** `packages/payoff-engine/tests/payoff.test.ts` (Node built-in `node:test`, uses `tsx` import).

### `apps/desktop`

- **Tauri v2 desktop app** with React 19 + Vite 6 + Tailwind CSS 3.
- **First-run onboarding:** Downloads llama-server (from llama.cpp GitHub releases) and Qwen2.5-3B-Instruct GGUF model (~2 GB) to app data directory. Progress bar UI.
- **PDF upload flow:** User drops/selects a PDF statement → pdfjs-dist extracts text (OCR fallback via Tesseract.js for scanned PDFs) → llama-server runs structured extraction with confidence scores and source snippets → review screen with editable fields → confirm to add account.
- **Manual fallback:** User can also add accounts by hand.
- **Budget calculator:** Guided income/expenses breakdown to compute available debt budget. Categories: rent, utilities, groceries, transportation, insurance, subscriptions, other. Warns if budget is below combined minimums.
- **Payoff plan:** Runs both avalanche and snowball via `generatePlan()`. Redesigned results: strategy picker, "This Month" action card, visual payoff timeline with calendar dates, month-by-month payment schedule, per-account breakdown table.
- **Persistence:** SQLite database (rusqlite bundled) stores accounts and budget config. Data loads automatically on app startup.
- **Settings panel:** GPU/CPU toggle for AI acceleration. Auto-detects NVIDIA GPU and CUDA build. Restarts AI engine on toggle.
- **LLM lifecycle:** llama-server spawned as child process on first extraction, kept running for session, killed on app exit.
- **Rust backend commands:** `check_ai_setup`, `setup_ai`, `extract_statement`, `get_gpu_status`, `set_gpu_enabled`, `db_*` in `src-tauri/src/lib.rs`.

### Docs

- `docs/architecture.md` — high-level local flow and trust model.
- `docs/payoff-math.md` — assumptions and strategy definitions.

---

## Planned data model (SQLite — not migrated yet)

Rough schema agreed in design; **no migration files exist** — implement when desktop app + DB land.

- **users** — `id`, `created_at`, `currency` (default USD).
- **accounts** — issuer, card name, last4, links to user.
- **statements** — period, due date, file path, hash, parse status.
- **statement_metrics** — balance, APR(s), minimum payment, fees, interest charged, etc.
- **extraction_fields** — field name, raw/normalized value, **confidence**, **page_number**, **source_snippet**, `needs_review`.
- **plan_runs** — inputs, strategy, projected payoff, total interest, assumptions JSON.
- **plan_schedule_items** — month index, per-account payment/interest/principal/ending balance.

---

## Environment / setup

- **Node.js LTS** (v24+) and **Rust** (v1.94+) are installed via `winget`.
- PATH may need manual addition in new terminal sessions:
  - Node: `C:\Program Files\nodejs`
  - Rust: `%USERPROFILE%\.cargo\bin`
- From repo root:

```bash
cd C:\Users\Kareem\projects\debt-planner-local
npm install
npm run test
npm run typecheck
npm run build
```

- Workspace dependency `@debt-planner/core-types` uses `"*"` (npm workspaces), not `"workspace:*"` (pnpm).
- To run the desktop app in dev mode: `cd apps/desktop && npx tauri dev`
- To build installers: `cd apps/desktop && npx tauri build`

---

## Recommended next steps (priority order)

1. ~~Install Node LTS; verify tests pass.~~ **Done**
2. ~~Scaffold Tauri + React + Vite in `apps/desktop`.~~ **Done**
3. ~~Minimal UI: account entry + payoff plan display.~~ **Done**
4. ~~PDF upload + local LLM extraction pipeline.~~ **Done**
5. ~~Add **SQLite** and persistence for accounts/budget config.~~ **Done** — rusqlite bundled, accounts + budget saved to `debt_planner.db` in app data dir.
6. ~~Improve extraction accuracy: confidence scoring, source snippet highlighting.~~ **Done** — LLM returns per-field confidence (high/medium/low) and source snippets shown in review UI.
7. ~~OCR fallback for scanned/image-only PDF statements.~~ **Done** — Tesseract.js auto-detects scanned PDFs and runs OCR with page-by-page progress.
8. ~~GPU acceleration option.~~ **Done** — Settings panel with GPU/CPU toggle, auto-restarts AI engine.
9. ~~UI/UX enhancements.~~ **Done** — Warm color palette, encouraging tone, progress ring, milestone celebrations, conversational copy, renamed to **Thaw**.
10. ~~**Custom logo/icon**~~ **Done** — Custom Thaw droplet icon (SVG component + all Tauri platform icons). Replaced emoji placeholders in header, welcome page, and setup screen.
11. ~~**Bank statement import**~~ **Done** — Upload bank statement PDF to auto-populate budget calculator. Reuses PDF extraction + LLM pipeline with a bank-statement-specific prompt. Extracts income and categorized expenses, pre-fills fields for user review.
12. ~~DB encryption (sqlcipher) for sensitive data at rest.~~ **Skipped** — Adds UX friction (password prompts or key management) for marginal security on a local-only app. Not worth complicating the experience for users already dealing with stress.
13. **Multi-APR support** (multiple balances with different rates on one card).
14. **Statement history and trend tracking.**

---

## Conventions

- **Deterministic financial logic:** TypeScript (`payoff-engine`) or later Rust in Tauri backend — **not** LLM.
- **Extraction:** schema-validated JSON; show user **where** each number came from.
- **Security:** encrypt DB at rest; avoid logging full statement text by default.

---

## Files to read first when coding

1. `apps/desktop/src/App.tsx` — main app flow (setup → upload → plan)
2. `apps/desktop/src-tauri/src/llm.rs` — LLM download/server/inference logic
3. `apps/desktop/src-tauri/src/lib.rs` — Tauri commands
4. `packages/payoff-engine/src/index.ts` — deterministic payoff math
5. `packages/core-types/src/index.ts` — shared types
6. `packages/payoff-engine/tests/payoff.test.ts`
7. `docs/architecture.md` / `docs/payoff-math.md`

---

## GPU note

Local LLM inference benefits from a **discrete GPU** (e.g. 8GB+ VRAM for 7B/8B-class models). **Not required** for payoff math; optional for faster statement field extraction.
