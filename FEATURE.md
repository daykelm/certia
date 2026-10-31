# Certia — MVP features

Priorities:

- **P0**: required for the pilot with the design partners.
- **P1**: in the MVP if the plan holds; the first thing to cut.
- **Phase 2**: out of the MVP, documented so it is not lost.

Every feature has an ID (`F-xx`) used in branches, commits and tasks.

## Summary

| ID | Feature | Priority | Weeks |
|---|---|---|---|
| F-01 | Sign-in, organizations, users and roles | P0 | 1–2 |
| F-02 | Event log and auditing | P0 | 1–2 |
| F-03 | Measure engine and savings calculation | P0 | 3–4 |
| F-04 | Contacts, leads and cases | P0 | 3–4 |
| F-05 | AI data extraction and review | P1 | 15–21 |
| F-06 | Upload portal and document normalization | P0 | 5–7 |
| F-07 | Measure version comparator | P1 | 15–21 |
| F-08 | Document checklist | P0 | 5–7 |
| F-09 | Document generation from templates | P0 | 8–9 |
| F-10 | Batches | P0 | 10–11 |
| F-11 | Verification and issuance packages | P0 | 10–11 |
| F-12 | Tasks and correction requests | P0 | 12 |
| F-13 | Stalled-items traffic light | P0 | 12 |
| F-14 | KPIs and objectives per person | P1 | 15–21 |
| F-15 | Case import | P0 | 13–14 |
| F-16 | Encryption of sensitive data | P0 | 1–14 |
| F-17 | Search and filterable lists | P0 | 3–12 |

---

## F-01 · Sign-in, organizations, users and roles — P0

**As** a team member at a customer company, **I want** to sign in with my corporate account **so that** I do not manage another password and only see my company's data.

Acceptance criteria:

- Each organization has its email domain; only accounts from that domain can sign in.
- Google sign-in in the MVP; Microsoft in a later phase.
- No user can see or change another organization's data; tests check this on every endpoint.
- The Certia team creates organizations and their first admin.
- An organization admin assigns one or more roles: admin, director, case manager, verifier, viewer.
- A user deactivated in their identity provider loses access on their next request.
- Every API endpoint checks the role; hiding a button in the UI is not enough.
- The beneficiary accesses **only** their portal through a signed, expiring link, without an account.

## F-02 · Event log and auditing — P0

**As** a director, **I want** to know who changed what and when **so that** there is traceability without relying on manual notes.

Acceptance criteria:

- Every creation, status change, field edit, upload or document generation creates an event.
- Events cannot be edited or deleted from the application.
- Every case and every batch shows its chronological history.
- Access to sensitive data (ID numbers, IBANs) is also recorded.

## F-03 · Measure engine and savings calculation — P0

**As** the technical team, **I want** to define each measure as configuration **so that** new kinds of efficiency actions can be added without changing the engine's code.

Acceptance criteria:

- A measure defines: code, version, validity, fields, formula, required documents, grouping rules, templates, packaging rules and workflow.
- Measures are validated at startup and in CI (`pnpm measures:check`); an invalid measure blocks the deployment.
- Every measure includes calculation test cases that must pass in CI.
- The formula is evaluated with a safe evaluator, without running arbitrary code.
- A case is pinned to a specific measure version.
- MVP: electric vehicle measure in its previous and current version.

## F-04 · Contacts, leads and cases — P0

**As** a case manager, **I want** to see and work on each case in a single screen **so that** I do not have to update several spreadsheets.

Acceptance criteria:

- Web forms create the lead directly in Certia through a public endpoint protected against abuse.
- The lead's source channel is stored.
- Converting a lead creates the contact and the case with the chosen measure.
- The case shows: beneficiary data, measure fields, documents, calculated savings, status, assignee, tasks and history.
- Status changes follow the transitions defined in the measure and explain what is missing when a transition is not possible.
- A case can be reassigned.
- **Beneficiary type**: individual or legal entity. The type determines the identification fields (national ID or company tax ID and legal representative) and the documents the checklist asks for (F-08), for example a power of attorney only for legal entities.
- **Notes as history**: each note is saved with an automatic date and author, and shown in chronological order next to status changes. The latest note is visible in the list (F-17). Nobody types the date by hand or edits other people's notes.

## F-05 · AI data extraction and review — P1

**As** a case manager, **I want** data to be filled in from the documents **so that** I review instead of typing.

Acceptance criteria:

- When a document is uploaded, the worker classifies it by type and extracts the fields the measure links to that type.
- Each extracted field stores its value, the source document and a confidence level.
- The review screen shows the document next to the fields, with doubtful ones highlighted.
- No extracted value is considered valid until a person confirms it.
- If extraction fails, the document is flagged for manual entry without blocking the case.
- **Plan B if cut:** manual entry form with the document visible alongside.

## F-06 · Upload portal and document normalization — P0

**As** a beneficiary, **I want** to upload my documents from my phone **so that** I do not have to send them by email.

Acceptance criteria:

- The portal shows which documents are missing, in plain language.
- Accepts PDF, JPG, PNG and HEIC, including phone photos.
- Each file is converted to PDF, renamed according to the convention and compressed below the configured limit (10 MB by default).
- The original is kept alongside the normalized version.
- The team can also upload documents from the case screen.
- Documents are stored in a private bucket and only served through temporary links.

## F-07 · Measure version comparator — P1

**As** a case manager, **I want** to see a case's savings with the previous and the current version of the measure **so that** I can pick the most favorable one for the beneficiary.

Acceptance criteria:

- For a case, shows side by side the savings and estimated payout with each applicable version.
- Shows which additional data or documents each version requires.
- Changing the case's version is recorded as an event.

## F-08 · Document checklist — P0

**As** a case manager, **I want** to see at a glance what is missing in each case **so that** I can request it from the beneficiary as soon as possible.

Acceptance criteria:

- The checklist is built from the documents the measure requires, including conditional ones.
- Each document has a status: pending, uploaded, validated or rejected (with a reason).
- From the checklist, an email listing what is missing and the portal link can be sent to the beneficiary.
- A case can only move to "complete" when every required document is validated.

## F-09 · Document generation from templates — P0

**As** a case manager, **I want** to generate the savings assignment agreement and the responsible declaration in one click **so that** I do not edit templates by hand.

Acceptance criteria:

- Templates are Word files with variables, versioned with the measure.
- Optional clauses are switched on with checkboxes when generating, without editing the template.
- The generated document is stored in the case as a PDF, with the template, version and options used.
- If data required by the template is missing, generation is blocked and the missing data is listed.
- Only admins can change templates.

## F-10 · Batches — P0

**As** the person in charge of verification, **I want** the system to propose batches **so that** I do not calculate them by hand.

Acceptance criteria:

- View of complete cases grouped by the measure's keys (region and year), with the accumulated savings against the minimum.
- Also shows almost-complete cases that could join each group.
- Create a batch from a proposal or by selecting cases manually.
- A batch cannot move to "ready" if it does not reach the minimum or mixes incompatible keys.
- Cases can be added or removed until the batch has been sent.
- The batch records the verifier and the dates sent and answered.

## F-11 · Verification and issuance packages — P0

**As** the person in charge of verification, **I want** to generate a batch's package in one click **so that** I avoid rejections because of format.

Acceptance criteria:

- Generates the ZIP with the folder structure, naming and annexes the measure requires.
- Validates names (forbidden characters, length) and sizes before generating it, with an error report.
- Generates the batch's agreement or summary document from its template.
- Separate packages for verification and for issuance.
- Each generated package is stored and linked to the batch, with its date.

## F-12 · Tasks and correction requests — P0

**As** the person in charge of verification, **I want** to log each correction request as a task assigned to case management **so that** nothing gets lost between teams.

Acceptance criteria:

- A task is linked to a case or a batch.
- Fields: description, origin (preventive, verifier, regional authority), assignee, priority and due date.
- Tasks from the regional authority get the highest priority by default.
- A batch or case with open tasks shows it clearly.
- "My tasks" view for each user, ordered by priority and due date.
- Completing a task is recorded in the history.

## F-13 · Stalled-items traffic light — P0

**As** a director, **I want** to see what has been idle for too long **so that** I can act on the most urgent items.

Acceptance criteria:

- List of cases and batches ordered by days without a status change, colored by thresholds configurable per status.
- Filters by assignee, status, region and verifier.
- Statuses that depend on third parties (for example, in issuance) are distinguished from those that depend on the team.
- Calculated automatically from events, with no manual entry.

## F-14 · KPIs and objectives per person — P1

**As** a director, **I want** to see each person's progress against their monthly objective **so that** I can manage bonuses without separate spreadsheets.

Acceptance criteria:

- Monthly objectives configurable per user and metric (for example, cases with a favorable opinion, cases issued, verification requests).
- Progress calculated from events, with an end-of-month projection.
- Each user sees their own KPIs; directors see everyone's.
- CSV export.

## F-15 · Case import — P0

**As** the admin of a new organization, **I want** to import my existing cases and batches **so that** I can start using Certia without losing history.

Acceptance criteria:

- Import from CSV or Excel files exported from the customer's current tools.
- Configurable mapping of columns and of old statuses to new ones.
- Dry-run mode showing a report of what would be imported and the errors, without writing anything.
- Idempotent import: running it again does not duplicate records.
- Import of existing documents from a ZIP file or a folder, linked to their case.

## F-16 · Encryption of sensitive data — P0

**As** the data protection officer, **I want** ID numbers and bank details to be encrypted **so that** the impact of any leak is limited.

Acceptance criteria:

- ID numbers, IBANs and account holders are encrypted before being stored; the key is not in the database.
- Searching by ID number uses a hash, never the plain value.
- Only authorized roles see decrypted values, and every access is recorded.
- Sensitive data never appears in logs or error messages.
- Identity documents are only accessible through temporary links.

## F-17 · Search and filterable lists — P0

**As** a user, **I want** to find any case or batch quickly **so that** I stop searching through spreadsheets.

Acceptance criteria:

- Search by name, ID number (exact), plate number, case or batch reference.
- Lists filtered by status, assignee, measure, region, year and batch.
- Filters can be saved as personal views.
- Export of the filtered list to CSV.

---

## Phase 2 (out of the MVP)

| ID | Feature | Note |
|---|---|---|
| F-18 | Self-service organization sign-up | Registration, domain verification and first admin without the Certia team |
| F-19 | Subscription and service billing | Plans, invoices with VAT and recurring payment |
| F-20 | Payments to beneficiaries | Account holder validation, duplicate checks, payment status per batch |
| F-21 | SEPA payment remittances | Remittance file for the bank from approved payments |
| F-22 | CAE sales and invoicing | Buyers, contracts, invoices |
| F-23 | Accounting or ERP integration | Depends on each customer's system |
| F-24 | New measures | Prioritized by demand; the second one very different from the first to validate the engine |
| F-25 | Visual measure editor | Only if the volume of changes justifies it |
| F-26 | Automatic reminders to verifiers | Built on the traffic light (F-13) |
| F-27 | WhatsApp and calls from the case | Integration with a provider to be chosen |
| F-28 | Verifier portal | Direct package download with controlled access |
| F-29 | Electronic signature | Only where regulation allows it |
| F-30 | External lead capture forms | Forms on the customer's website (WordPress or others) send leads to Certia through an embeddable form or an endpoint with a key per organization |
| F-31 | Temporary spreadsheet sync | During the transition, read from and write to the customer's current spreadsheet (Google Sheets) to coexist with it until it is retired |
| F-32 | Document inbox | One email address per organization: documents received by email are linked to the case by reference or sender |
| F-33 | Email from the customer's account | Send emails to beneficiaries from the customer's own mailbox (Google or Microsoft) through its API, without storing passwords |
| F-34 | Case agent | Workflow with AI steps that moves each case forward and proposes; a person confirms. Details below |
| F-35 | Knowledge base with RAG | Shared regulation with citations and per-organization memory of correction requests. Details below |

### F-34 · Case agent

**As** a case manager, **I want** each case to be reviewed automatically when documents arrive **so that** I spend my time confirming and handling exceptions, not typing.

Built in phases:

1. **Automatic review** (extends F-05): when a document arrives, through the portal or by email (F-32), it is classified, the measure's fields are extracted and documents are cross-checked (same owner, same tax ID, same plate number, dates within deadlines). Savings and the checklist are recalculated.
2. **Proposed next step**: if something is missing or inconsistent, it drafts the request to the beneficiary; if everything is in place, it proposes moving the case to "complete".
3. **Correction requests**: it reads requests from verifiers and regional authorities, creates the tasks (F-12) and proposes which document or answer addresses each one, drawing on F-35.

Acceptance criteria:

- It is a defined workflow with AI steps, run by the worker; not a free agent that decides what to do.
- The agent **proposes and a person confirms**: it does not send emails, change critical statuses or send packages without approval.
- Each proposal stores its origin, confidence and justification; who approved or corrected it is recorded in the history (F-02).
- The agent's tools are Certia functions (read the case and documents, calculate, check the checklist, create a proposal, draft an email), always limited to the case's organization.
- What to extract and what to validate comes from the measure: a new measure does not require reprogramming the agent.
- AI provider deployed in the EU, with a contract that forbids using the data for training.

### F-35 · Knowledge base with RAG

**As** a case manager, **I want** to ask regulatory questions and see how similar cases were resolved **so that** I can decide quickly and on solid grounds.

Two separate spaces:

1. **Shared regulation**: Royal Decree 36/2023, the catalog of measures with all their versions, each region's procedures, official FAQs and criteria published by verifiers. Public sources only.
2. **Each organization's memory**: correction requests received and how they were resolved, visible only to that organization.

Acceptance criteria:

- In-app assistant that **always answers with a citation** (document and section); if there is no source, it says so instead of making something up.
- Regulation is versioned by date: a question about a case uses the rules in force on its date.
- Change alerts when a new version of a measure or procedure is published.
- Indexes in Postgres with pgvector, in the same database; each organization's memory is always filtered by `organization_id`.
- No personal data in the indexes: from correction requests, the content is indexed, never names, ID numbers or addresses.
- The savings calculation **never** depends on RAG: it is always done by the measure engine (F-03).
