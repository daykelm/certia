# Ficha definitions

Each YAML file defines **one version** of a ficha and must satisfy the schema in `packages/core/src/ficha/schema.ts`.

Rules:

- One folder per ficha and one file per version: `<ficha>/v<N>.yaml`.
- **A published version is never edited.** A regulatory change creates a new file with the next version.
- Every version includes at least one calculation test case.
- Quote formulas and conditions that contain `?`, `:` or `#` so YAML parses them as strings.
- `pnpm fichas:check` validates every ficha and runs its tests; CI requires it to pass before deploying.

Schema keys are in English. Field ids, labels and document types stay in Spanish on purpose: they mirror the official ficha and are shown to Spanish-speaking users.

> ⚠️ The electric vehicle fichas included here are **sample templates**: the code, factors, formula and documents are illustrative. Replace them with those of the official ficha in the Ministry's catalog before using them with real expedientes.
