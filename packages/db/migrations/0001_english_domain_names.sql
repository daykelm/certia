-- Rename Spanish domain terms to English: ficha -> measure, expediente -> case, lote -> batch.
ALTER TABLE "expedientes" RENAME TO "cases";--> statement-breakpoint
ALTER TABLE "ficha_versions" RENAME TO "measure_versions";--> statement-breakpoint
ALTER TABLE "lotes" RENAME TO "batches";--> statement-breakpoint
ALTER TABLE "lote_expedientes" RENAME TO "batch_cases";--> statement-breakpoint
ALTER TABLE "cases" RENAME COLUMN "ficha_code" TO "measure_code";--> statement-breakpoint
ALTER TABLE "cases" RENAME COLUMN "ficha_version" TO "measure_version";--> statement-breakpoint
ALTER TABLE "documents" RENAME COLUMN "expediente_id" TO "case_id";--> statement-breakpoint
ALTER TABLE "generated_documents" RENAME COLUMN "expediente_id" TO "case_id";--> statement-breakpoint
ALTER TABLE "generated_documents" RENAME COLUMN "lote_id" TO "batch_id";--> statement-breakpoint
ALTER TABLE "generated_documents" RENAME COLUMN "ficha_code" TO "measure_code";--> statement-breakpoint
ALTER TABLE "generated_documents" RENAME COLUMN "ficha_version" TO "measure_version";--> statement-breakpoint
ALTER TABLE "batches" RENAME COLUMN "ficha_code" TO "measure_code";--> statement-breakpoint
ALTER TABLE "batch_cases" RENAME COLUMN "lote_id" TO "batch_id";--> statement-breakpoint
ALTER TABLE "batch_cases" RENAME COLUMN "expediente_id" TO "case_id";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "expediente_id" TO "case_id";--> statement-breakpoint
ALTER TABLE "tasks" RENAME COLUMN "lote_id" TO "batch_id";--> statement-breakpoint
ALTER TABLE "cases" RENAME CONSTRAINT "expedientes_pkey" TO "cases_pkey";--> statement-breakpoint
ALTER TABLE "measure_versions" RENAME CONSTRAINT "ficha_versions_pkey" TO "measure_versions_pkey";--> statement-breakpoint
ALTER TABLE "batches" RENAME CONSTRAINT "lotes_pkey" TO "batches_pkey";--> statement-breakpoint
ALTER TABLE "documents" RENAME CONSTRAINT "documents_expediente_id_expedientes_id_fk" TO "documents_case_id_cases_id_fk";--> statement-breakpoint
ALTER TABLE "cases" RENAME CONSTRAINT "expedientes_organization_id_organizations_id_fk" TO "cases_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "cases" RENAME CONSTRAINT "expedientes_contact_id_contacts_id_fk" TO "cases_contact_id_contacts_id_fk";--> statement-breakpoint
ALTER TABLE "cases" RENAME CONSTRAINT "expedientes_lead_id_leads_id_fk" TO "cases_lead_id_leads_id_fk";--> statement-breakpoint
ALTER TABLE "cases" RENAME CONSTRAINT "expedientes_assignee_id_users_id_fk" TO "cases_assignee_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "generated_documents" RENAME CONSTRAINT "generated_documents_expediente_id_expedientes_id_fk" TO "generated_documents_case_id_cases_id_fk";--> statement-breakpoint
ALTER TABLE "generated_documents" RENAME CONSTRAINT "generated_documents_lote_id_lotes_id_fk" TO "generated_documents_batch_id_batches_id_fk";--> statement-breakpoint
ALTER TABLE "batch_cases" RENAME CONSTRAINT "lote_expedientes_lote_id_lotes_id_fk" TO "batch_cases_batch_id_batches_id_fk";--> statement-breakpoint
ALTER TABLE "batch_cases" RENAME CONSTRAINT "lote_expedientes_expediente_id_expedientes_id_fk" TO "batch_cases_case_id_cases_id_fk";--> statement-breakpoint
ALTER TABLE "batches" RENAME CONSTRAINT "lotes_organization_id_organizations_id_fk" TO "batches_organization_id_organizations_id_fk";--> statement-breakpoint
ALTER TABLE "batches" RENAME CONSTRAINT "lotes_assignee_id_users_id_fk" TO "batches_assignee_id_users_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_expediente_id_expedientes_id_fk" TO "tasks_case_id_cases_id_fk";--> statement-breakpoint
ALTER TABLE "tasks" RENAME CONSTRAINT "tasks_lote_id_lotes_id_fk" TO "tasks_batch_id_batches_id_fk";--> statement-breakpoint
ALTER TABLE "batch_cases" RENAME CONSTRAINT "lote_expedientes_lote_id_expediente_id_pk" TO "batch_cases_batch_id_case_id_pk";--> statement-breakpoint
ALTER INDEX "documents_expediente_idx" RENAME TO "documents_case_idx";--> statement-breakpoint
ALTER INDEX "expedientes_org_reference_uq" RENAME TO "cases_org_reference_uq";--> statement-breakpoint
ALTER INDEX "expedientes_org_status_idx" RENAME TO "cases_org_status_idx";--> statement-breakpoint
ALTER INDEX "expedientes_grouping_idx" RENAME TO "cases_grouping_idx";--> statement-breakpoint
ALTER INDEX "ficha_versions_code_version_uq" RENAME TO "measure_versions_code_version_uq";--> statement-breakpoint
ALTER INDEX "lote_expedientes_expediente_uq" RENAME TO "batch_cases_case_uq";--> statement-breakpoint
ALTER INDEX "lotes_org_reference_uq" RENAME TO "batches_org_reference_uq";--> statement-breakpoint
ALTER INDEX "lotes_org_status_idx" RENAME TO "batches_org_status_idx";--> statement-breakpoint
UPDATE "cases" SET "status" = 'in_batch' WHERE "status" = 'in_lote';--> statement-breakpoint
UPDATE "events" SET "entity" = 'case' WHERE "entity" = 'expediente';--> statement-breakpoint
UPDATE "events" SET "entity" = 'batch' WHERE "entity" = 'lote';--> statement-breakpoint
UPDATE "events" SET "type" = replace("type", 'expediente.', 'case.') WHERE "type" LIKE 'expediente.%';--> statement-breakpoint
-- The sample electric-vehicle measure is re-published with English field ids by the seed.
DELETE FROM "measure_versions" WHERE "code" = 'TRA-VE';
