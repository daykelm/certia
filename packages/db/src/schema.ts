import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Certia database schema. See PROJECT.md §8.
 *
 * Conventions:
 * - Every business table has organization_id (decision D10).
 * - Measure-specific data lives in `data` (JSONB) and is validated against the measure.
 * - *_encrypted columns hold values encrypted at the application level (F-16).
 * - Every relevant change is recorded in `events` (F-02).
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const org = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id);
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  domain: text("domain").notNull().unique(),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    organizationId: org(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_org_email_uq").on(t.organizationId, t.email)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    organizationId: org(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name"),
    email: text("email"),
    phone: text("phone"),
    dniEncrypted: text("dni_encrypted"),
    /** Keyed hash used to search by DNI without decrypting. */
    dniHash: text("dni_hash"),
    ibanEncrypted: text("iban_encrypted"),
    accountHolderEncrypted: text("account_holder_encrypted"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("contacts_org_dni_hash_idx").on(t.organizationId, t.dniHash)],
);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    organizationId: org(),
    contactId: uuid("contact_id").references(() => contacts.id),
    channel: text("channel"),
    /** new | contacted | converted | discarded */
    status: text("status").notNull().default("new"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("leads_org_status_idx").on(t.organizationId, t.status)],
);

/** Published copy of each measure version. Immutable (decision D3). */
export const measureVersions = pgTable(
  "measure_versions",
  {
    id: id(),
    code: text("code").notNull(),
    version: integer("version").notNull(),
    name: text("name").notNull(),
    hash: text("hash").notNull(),
    definition: jsonb("definition").notNull(),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("measure_versions_code_version_uq").on(t.code, t.version)],
);

export const cases = pgTable(
  "cases",
  {
    id: id(),
    organizationId: org(),
    reference: text("reference").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    leadId: uuid("lead_id").references(() => leads.id),
    measureCode: text("measure_code").notNull(),
    measureVersion: integer("measure_version").notNull(),
    status: text("status").notNull().default("lead"),
    /** Time of the last status change: drives the traffic light (F-13). */
    statusSince: timestamp("status_since", { withTimezone: true }).notNull().defaultNow(),
    /** Autonomous community (INE code). */
    region: text("region"),
    year: integer("year"),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    savingsKwh: numeric("savings_kwh", { precision: 14, scale: 3, mode: "number" }),
    assigneeId: uuid("assignee_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("cases_org_reference_uq").on(t.organizationId, t.reference),
    index("cases_org_status_idx").on(t.organizationId, t.status, t.statusSince),
    index("cases_grouping_idx").on(t.organizationId, t.measureCode, t.region, t.year),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    organizationId: org(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    type: text("type").notNull(),
    status: text("status").notNull().default("uploaded"),
    originalName: text("original_name").notNull(),
    originalPath: text("original_path").notNull(),
    normalizedPath: text("normalized_path"),
    mime: text("mime"),
    bytes: integer("bytes"),
    extractedData: jsonb("extracted_data").$type<Record<string, unknown>>(),
    confidence: jsonb("confidence").$type<Record<string, number>>(),
    rejectionReason: text("rejection_reason"),
    /** Null when uploaded by the beneficiary through the portal. */
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("documents_case_idx").on(t.caseId, t.type)],
);

export const generatedDocuments = pgTable("generated_documents", {
  id: id(),
  organizationId: org(),
  caseId: uuid("case_id").references(() => cases.id),
  batchId: uuid("batch_id").references(() => batches.id),
  templateId: text("template_id").notNull(),
  measureCode: text("measure_code").notNull(),
  measureVersion: integer("measure_version").notNull(),
  options: jsonb("options").$type<Record<string, unknown>>().notNull().default({}),
  path: text("path").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const batches = pgTable(
  "batches",
  {
    id: id(),
    organizationId: org(),
    reference: text("reference").notNull(),
    measureCode: text("measure_code").notNull(),
    /** Grouping key values, e.g. { region, year }. */
    key: jsonb("key").$type<Record<string, string>>().notNull(),
    status: text("status").notNull().default("draft"),
    statusSince: timestamp("status_since", { withTimezone: true }).notNull().defaultNow(),
    verifier: text("verifier"),
    totalKwh: numeric("total_kwh", { precision: 14, scale: 3, mode: "number" }).notNull().default(0),
    assigneeId: uuid("assignee_id").references(() => users.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("batches_org_reference_uq").on(t.organizationId, t.reference),
    index("batches_org_status_idx").on(t.organizationId, t.status, t.statusSince),
  ],
);

export const batchCases = pgTable(
  "batch_cases",
  {
    batchId: uuid("batch_id")
      .notNull()
      .references(() => batches.id, { onDelete: "cascade" }),
    caseId: uuid("case_id")
      .notNull()
      .references(() => cases.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.batchId, t.caseId] }),
    // A case can only belong to one batch.
    uniqueIndex("batch_cases_case_uq").on(t.caseId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    organizationId: org(),
    caseId: uuid("case_id").references(() => cases.id),
    batchId: uuid("batch_id").references(() => batches.id),
    title: text("title").notNull(),
    description: text("description"),
    origin: text("origin").notNull().default("internal"),
    /** 1 = highest. */
    priority: integer("priority").notNull().default(3),
    assigneeId: uuid("assignee_id").references(() => users.id),
    dueAt: timestamp("due_at", { withTimezone: true }),
    open: boolean("open").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [index("tasks_assignee_idx").on(t.organizationId, t.assigneeId, t.open)],
);

/** Append-only log of everything that happens (F-02). Source for history, traffic light and KPIs. */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: org(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id").notNull(),
    type: text("type").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    data: jsonb("data").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [
    index("events_entity_idx").on(t.entity, t.entityId, t.createdAt),
    index("events_org_type_idx").on(t.organizationId, t.type, t.createdAt),
  ],
);

export const objectives = pgTable(
  "objectives",
  {
    id: id(),
    organizationId: org(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    month: date("month").notNull(),
    metric: text("metric").notNull(),
    target: integer("target").notNull(),
  },
  (t) => [uniqueIndex("objectives_uq").on(t.userId, t.month, t.metric)],
);

/** Postgres-backed job queue for development and environments without Cloud Tasks. */
export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    type: text("type").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** pending | running | done | failed */
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("jobs_pending_idx").on(t.status, t.runAt).where(sql`status = 'pending'`)],
);
