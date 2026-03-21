# Architecture Notes

## Local-first flow

1. User uploads statements from desktop UI.
2. Local extractor parses and normalizes statement fields.
3. Confirmed fields persist in encrypted SQLite.
4. Deterministic payoff engine computes snowball/avalanche schedules.
5. UI shows recommendation and projected payoff timeline.

## Trust model

- Keep debt math deterministic and testable.
- Show extraction provenance for all parsed fields.
- Require review for low-confidence values.
