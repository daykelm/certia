# Rules for AI assistants working on Certia

## Data handling

- Screenshots, recordings and documents from existing systems are **reference only**: use them to understand flows, screens and processes, never as content.
- **Never copy, store or reuse personal data** that appears in them: names, ID numbers (DNI/NIE/CIF), phone numbers, emails, addresses, IBANs, licence plates or case notes about real people. Not in code, fixtures, tests, docs, commit messages, issues or memory.
- **Never commit confidential material from third parties** (client templates, internal documents, architecture diagrams, exports) unless a written agreement allows it. Describe what was learned in generic, sector-wide terms instead.
- Seed data, tests and examples use **fictitious data only** (e.g. `12345678Z`, `Persona Ejemplo`, `ejemplo@certia-es.com`).

## Conventions

Everything is in English: code, data, database, API, UI and docs. Use the glossary in [README.md](./README.md) to map English terms (measure, case, batch) to the Spanish regulation (ficha, expediente, lote). See the "Conventions" section of the README.
