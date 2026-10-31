# Measure definitions

Each YAML file defines **one version** of a standardised measure (a *ficha* in the official Spanish catalog) and must satisfy the schema in `packages/core/src/measure/schema.ts`.

Rules:

- One folder per measure and one file per version: `<measure>/v<N>.yaml`.
- **A published version is never edited.** A regulatory change creates a new file with the next version.
- Every version includes at least one calculation test case.
- Quote formulas and conditions that contain `?`, `:` or `#` so YAML parses them as strings.
- `pnpm measures:check` validates every measure and runs its tests; CI requires it to pass before deploying.
- Everything is written in English (field ids, labels, document types). Spanish user-facing text will come from i18n.
- Build definitions only from public sources (the official catalog and regulation), never from a client's confidential material.

> ⚠️ The electric vehicle measure included here is a **sample template**: the factors, formula and documents are illustrative. Replace them with those of the official ficha in the Ministry's catalog before using them with real cases.
