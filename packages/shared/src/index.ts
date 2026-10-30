import { z } from "zod";

/** User roles (F-01). A user can have several. */
export const ROLES = ["admin", "director", "case_manager", "verifier", "viewer"] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

/** Expediente states. See PROJECT.md §6. */
export const EXPEDIENTE_STATUSES = [
  "lead",
  "awaiting_documents",
  "pending_review",
  "incomplete",
  "complete",
  "in_lote",
  "verified",
  "issued",
  "discarded",
] as const;
export const ExpedienteStatusSchema = z.enum(EXPEDIENTE_STATUSES);
export type ExpedienteStatus = z.infer<typeof ExpedienteStatusSchema>;

/** Lote states. See PROJECT.md §6. */
export const LOTE_STATUSES = [
  "draft",
  "ready_for_verification",
  "in_verification",
  "verification_corrections",
  "favorable_opinion",
  "ready_for_issuance",
  "in_issuance",
  "issuance_corrections",
  "issued",
] as const;
export const LoteStatusSchema = z.enum(LOTE_STATUSES);
export type LoteStatus = z.infer<typeof LoteStatusSchema>;

/** State of each document in the checklist (F-08). */
export const DOCUMENT_STATUSES = ["pending", "uploaded", "validated", "rejected"] as const;
export const DocumentStatusSchema = z.enum(DOCUMENT_STATUSES);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

/** Origin of a task or subsanación (F-12). */
export const TASK_ORIGINS = ["internal", "preventive", "verifier", "regional_authority"] as const;
export const TaskOriginSchema = z.enum(TASK_ORIGINS);
export type TaskOrigin = z.infer<typeof TaskOriginSchema>;

/** Spanish autonomous communities and cities (INE codes). Values are data, kept in Spanish. */
export const REGIONS = [
  "01-andalucia",
  "02-aragon",
  "03-asturias",
  "04-baleares",
  "05-canarias",
  "06-cantabria",
  "07-castilla-leon",
  "08-castilla-la-mancha",
  "09-cataluna",
  "10-comunidad-valenciana",
  "11-extremadura",
  "12-galicia",
  "13-madrid",
  "14-murcia",
  "15-navarra",
  "16-pais-vasco",
  "17-la-rioja",
  "18-ceuta",
  "19-melilla",
] as const;
export const RegionSchema = z.enum(REGIONS);
export type Region = z.infer<typeof RegionSchema>;

// --- API DTOs ---

export const CreateExpedienteSchema = z.object({
  fichaCode: z.string().min(1),
  fichaVersion: z.number().int().positive(),
  contact: z.object({
    firstName: z.string().min(1),
    lastName: z.string().optional(),
    email: z.string().email().optional(),
    phone: z.string().optional(),
  }),
  region: RegionSchema.optional(),
  year: z.number().int().min(2023).optional(),
  data: z.record(z.unknown()).default({}),
  channel: z.string().optional(),
});
export type CreateExpediente = z.infer<typeof CreateExpedienteSchema>;

export const TransitionSchema = z.object({
  to: ExpedienteStatusSchema,
  comment: z.string().optional(),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const CalculateSchema = z.object({
  data: z.record(z.unknown()),
});
