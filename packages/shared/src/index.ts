import { z } from "zod";

/** Roles de usuario (F-01). Un usuario puede tener varios. */
export const ROLES = ["admin", "direccion", "gestion", "verificacion", "lectura"] as const;
export const RolSchema = z.enum(ROLES);
export type Rol = z.infer<typeof RolSchema>;

/** Estados del expediente (actuación). Ver PROJECT.md §6. */
export const ESTADOS_EXPEDIENTE = [
  "lead",
  "pendiente_documentacion",
  "pendiente_revision",
  "incompleto",
  "completo",
  "en_lote",
  "verificado",
  "emitido",
  "descartado",
] as const;
export const EstadoExpedienteSchema = z.enum(ESTADOS_EXPEDIENTE);
export type EstadoExpediente = z.infer<typeof EstadoExpedienteSchema>;

/** Estados del lote. Ver PROJECT.md §6. */
export const ESTADOS_LOTE = [
  "borrador",
  "preparado_verificacion",
  "en_verificacion",
  "subsanacion_verificacion",
  "dictamen_favorable",
  "preparado_emision",
  "en_emision",
  "subsanacion_emision",
  "emitido",
] as const;
export const EstadoLoteSchema = z.enum(ESTADOS_LOTE);
export type EstadoLote = z.infer<typeof EstadoLoteSchema>;

/** Estado de cada documento dentro de la checklist (F-08). */
export const ESTADOS_DOCUMENTO = ["pendiente", "subido", "validado", "rechazado"] as const;
export const EstadoDocumentoSchema = z.enum(ESTADOS_DOCUMENTO);
export type EstadoDocumento = z.infer<typeof EstadoDocumentoSchema>;

/** Origen de una tarea o subsanación (F-12). */
export const ORIGENES_TAREA = ["interno", "prevision", "verificador", "gestor_autonomico"] as const;
export const OrigenTareaSchema = z.enum(ORIGENES_TAREA);
export type OrigenTarea = z.infer<typeof OrigenTareaSchema>;

/** Comunidades y ciudades autónomas (códigos INE). */
export const CCAA = [
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
export const CcaaSchema = z.enum(CCAA);
export type Ccaa = z.infer<typeof CcaaSchema>;

// --- DTOs de la API ---

export const CrearActuacionSchema = z.object({
  fichaCodigo: z.string().min(1),
  fichaVersion: z.number().int().positive(),
  contacto: z.object({
    nombre: z.string().min(1),
    apellidos: z.string().optional(),
    email: z.string().email().optional(),
    telefono: z.string().optional(),
  }),
  comunidadAutonoma: CcaaSchema.optional(),
  anio: z.number().int().min(2023).optional(),
  datos: z.record(z.unknown()).default({}),
  canal: z.string().optional(),
});
export type CrearActuacion = z.infer<typeof CrearActuacionSchema>;

export const TransicionSchema = z.object({
  destino: EstadoExpedienteSchema,
  comentario: z.string().optional(),
});
export type Transicion = z.infer<typeof TransicionSchema>;

export const CalcularSchema = z.object({
  datos: z.record(z.unknown()),
});
