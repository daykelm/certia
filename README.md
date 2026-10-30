# Certia

Platform to manage **Energy Savings Certificate (CAE, *Certificados de Ahorro Energético*)** files in Spain: from capturing the beneficiary and collecting documents to building lotes, verification and issuance.

Certia separates a **generic engine** (expedientes, documents, workflows, lotes, tasks) from the actuación **fichas**, which are defined as configuration. Adding a new kind of actuación (electric vehicle, heat pump, building envelope, appliances…) means adding a ficha, not writing code.

> Status: **MVP in progress.** First supported ficha: electric vehicle (previous and current version).

Project documentation (in Spanish, for the client):

- [PROJECT.md](./PROJECT.md): context, goals, scope, architecture and delivery plan.
- [FEATURE.md](./FEATURE.md): MVP features with priority and acceptance criteria.

## Glossary

The domain vocabulary is kept in Spanish in code and data, because it mirrors the regulation and is what users see.

| Term | Meaning |
|---|---|
| CAE | Energy savings certificate; 1 CAE = 1 kWh of final energy saved |
| Ficha | Official catalog sheet defining how the savings of a kind of actuación are calculated and documented |
| Actuación / expediente | One energy efficiency action and its case file |
| Lote | Group of expedientes sent together to verification and issuance |
| Verificador | ENAC-accredited body that issues the *dictamen* (verification opinion) |
| Gestor autonómico | Regional authority that issues the CAE |
| Subsanación | Correction requested by the verifier or the regional authority |
| Acuerdo de cesión | Agreement by which the beneficiary assigns their savings |
| Semáforo | Traffic-light view of stalled expedientes and lotes |

---

## Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (Node.js 22 LTS) |
| API | Fastify |
| Frontend | React + Vite |
| Database | PostgreSQL 16 + Drizzle ORM |
| Validation | Zod (shared between frontend and API) |
| Background jobs | Own worker with a Postgres queue (Cloud Tasks optional in production) |
| File storage | Google Cloud Storage (local disk in development) |
| PDF and templates | docxtemplater + Gotenberg |
| Data extraction | Vision model through Vertex AI |
| Authentication | Google sign-in (OIDC), restricted to the organization's domain |
| Tests | Vitest |
| Monorepo | pnpm workspaces |
| Infrastructure | Docker · Google Cloud Run · Cloud SQL · `europe-southwest1` region (Madrid) |

## Structure

```
certia/
├── apps/
│   ├── web/          # React + Vite frontend (static)
│   ├── api/          # REST API (Fastify)
│   └── worker/       # Background jobs: AI extraction, PDFs, alerts
├── packages/
│   ├── core/         # Pure domain: fichas, calculation, workflows, lotes (no infrastructure deps)
│   ├── db/           # Drizzle schema and migrations
│   ├── fichas/       # YAML ficha definitions + validation
│   ├── adapters/     # Storage, queues, AI, email, PDF, encryption (interfaces + implementations)
│   └── shared/       # Shared types and Zod schemas
├── docker/
│   ├── Dockerfile    # One image for the api (with the frontend), worker and migrations
│   ├── start.mjs     # Starts the right process based on APP_MODE
│   └── compose.yml   # Postgres and Gotenberg locally (+ "app" profile with the image)
├── PROJECT.md
├── FEATURE.md
└── pnpm-workspace.yaml
```

Dependency rules:

- `core` never imports from `db`, `adapters` or the apps.
- Apps depend on `core`, `db`, `adapters` and `shared`.
- Every external integration (GCP, AI, email) goes through an interface in `adapters`.

## Local setup

Requirements: Docker, Node.js 22 and pnpm 10 (`corepack enable`).

```bash
git clone https://github.com/daykelm/certia.git
cd certia
cp .env.example .env                          # set ENCRYPTION_KEY with: openssl rand -base64 32
pnpm install
docker compose -f docker/compose.yml up -d   # postgres and gotenberg
pnpm db:migrate
pnpm db:seed                                  # organization, admin user and fichas
pnpm dev                                      # api + worker + web in dev mode
```

- Web: http://localhost:5180
- API: http://localhost:3100 (health: `/api/health`)
- Gotenberg: http://localhost:3001

In development, documents are stored in `.storage/` and every request is identified as `DEV_USER_EMAIL` until Google sign-in is implemented (F-01).

### First time in the repository

The skeleton was created without access to the npm registry, so two generated files are missing. After the first `pnpm install`:

```bash
pnpm db:generate                 # creates the initial migration in packages/db/migrations
git add pnpm-lock.yaml packages/db/migrations
git commit -m "chore: lockfile and initial migration"
```

### Run the production image locally

```bash
docker compose -f docker/compose.yml --profile app up --build
# http://localhost:8080 (API + frontend)
```

## Scripts

| Script | Description |
|---|---|
| `pnpm dev` | Starts api, worker and web with hot reload |
| `pnpm build` | Builds the web, api and worker |
| `pnpm test` | Runs the tests (Vitest) |
| `pnpm lint` | ESLint + type checking |
| `pnpm db:generate` | Generates a migration from the schema |
| `pnpm db:migrate` | Applies pending migrations |
| `pnpm db:seed` | Loads development data |
| `pnpm fichas:check` | Validates the YAML fichas and runs their calculation test cases |

## Environment variables

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `APP_MODE` | `api`, `worker` or `migrate` (the same image runs in all three modes) |
| `PUBLIC_URL` | Public base URL used in links sent to users (e.g. `https://app.certia-es.com`) |
| `MAIL_FROM` | Sender for transactional email (`no-reply@certia-es.com`) |
| `DEV_USER_EMAIL` | Development only: user every request is identified as |
| `AUTH_GOOGLE_CLIENT_ID` / `AUTH_GOOGLE_CLIENT_SECRET` | Google OIDC credentials |
| `AUTH_ALLOWED_DOMAIN` | Email domain allowed to sign in |
| `STORAGE_DRIVER` / `STORAGE_LOCAL_DIR` | `local` in development (folder on disk) or `gcs` |
| `STORAGE_BUCKET` | Document bucket (with `gcs`) |
| `QUEUE_DRIVER` | `postgres` or `cloudtasks` |
| `GOTENBERG_URL` | Internal Gotenberg URL |
| `AI_PROVIDER` / `AI_MODEL` | Extraction provider and model |
| `ENCRYPTION_KEY` | Base64 encryption key (32 bytes), local only |
| `ENCRYPTION_KEY_REF` | Production: reference to the key in Cloud KMS |

Never commit `.env`.

## Domains

The project's domain is **certia-es.com**.

| Host | Use |
|---|---|
| `certia-es.com` | Product website (reserved; redirects to the app for now) |
| `app.certia-es.com` | Production app (API + frontend) |
| `staging.certia-es.com` | Staging environment |
| `no-reply@certia-es.com` | Sender of transactional email (beneficiary portal links, alerts) |

Setup checklist:

- [ ] DNS for the domain managed in Cloud DNS (or the current registrar).
- [ ] `app` and `staging` pointing to Cloud Run through a global external Application Load Balancer with Google-managed certificates (Cloud Run domain mapping is not available in every region).
- [ ] `PUBLIC_URL` set per environment.
- [ ] SPF, DKIM and DMARC records for `certia-es.com` before sending email from it.

## Deployment

GitHub Actions, on every push to `main`:

1. Lint, types and tests (including `fichas:check`).
2. Builds the image and pushes it to Artifact Registry.
3. Applies migrations in **staging** and deploys `api` and `worker` to Cloud Run.
4. Promotion to **production** is manual (approval in GitHub).

Steps 2–4 are pending until the Google Cloud project exists.

Google Cloud services:

- Cloud Run: `certia-api`, `certia-worker`, `certia-gotenberg` (internal ingress only).
- Cloud SQL (PostgreSQL), private connection.
- Cloud Storage: private buckets for documents.
- Cloud Tasks and Cloud Scheduler for jobs and alerts.
- Secret Manager and Cloud KMS for secrets and sensitive data encryption.

## Conventions

- **Language:** code (identifiers, files, database tables and columns, API routes), technical documentation, comments, commit messages and logs are in English. Domain terms that have no good English equivalent stay in Spanish (`ficha`, `expediente`, `lote`; see the glossary), as do ficha data (field ids, labels, document types) and user-facing messages.
- Branches: `main` (deployable), `feat/*`, `fix/*`.
- Commits: [Conventional Commits](https://www.conventionalcommits.org/).
- Every new feature references its ID from [FEATURE.md](./FEATURE.md) (e.g. `feat(lotes): F-10 automatic lote proposals`).
- Published ficha versions are immutable: a regulatory change creates a **new version**.
- Sensitive personal data (DNI, IBAN) is encrypted at the application level and never appears in logs.

## License

Private. All rights reserved.
