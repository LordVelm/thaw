# debt-planner-local

Local-first desktop app to ingest credit card statements, extract debt data, and generate deterministic avalanche/snowball payoff plans.

## Monorepo layout

- `apps/desktop`: Tauri + React desktop UI
- `packages/core-types`: shared data contracts
- `packages/payoff-engine`: deterministic debt simulation logic
- `services/extractor`: placeholder for local PDF/OCR/LLM extraction service
- `docs`: architecture and math notes

## Current status

Initial scaffold with TypeScript workspaces and payoff engine package.

**AI / collaborator handoff:** see [`CLAUDE.md`](./CLAUDE.md) for full context, stack, schema plans, and next steps.
