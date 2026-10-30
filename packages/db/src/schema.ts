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
 * Esquema de Certia. Ver PROJECT.md §8.
 *
 * Convenciones:
 * - Todas las tablas de negocio llevan organization_id (decisión D10).
 * - Los datos propios de cada ficha van en `datos` (JSONB) y se validan con la ficha.
 * - Los campos *_cifrado guardan valores cifrados a nivel de aplicación (F-16).
 * - Cada cambio relevante se registra en `events` (F-02).
 */

const id = () => uuid("id").primaryKey().defaultRandom();
const org = () =>
  uuid("organization_id")
    .notNull()
    .references(() => organizations.id);
const creado = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const actualizado = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

export const organizations = pgTable("organizations", {
  id: id(),
  nombre: text("nombre").notNull(),
  dominio: text("dominio").notNull().unique(),
  createdAt: creado(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    organizationId: org(),
    email: text("email").notNull(),
    nombre: text("nombre").notNull(),
    activo: boolean("activo").notNull().default(true),
    createdAt: creado(),
  },
  (t) => [uniqueIndex("users_org_email_uq").on(t.organizationId, t.email)],
);

export const userRoles = pgTable(
  "user_roles",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    rol: text("rol").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.rol] })],
);

export const contacts = pgTable(
  "contacts",
  {
    id: id(),
    organizationId: org(),
    nombre: text("nombre").notNull(),
    apellidos: text("apellidos"),
    email: text("email"),
    telefono: text("telefono"),
    dniCifrado: text("dni_cifrado"),
    /** Hash con clave para buscar por DNI sin descifrar. */
    dniHash: text("dni_hash"),
    ibanCifrado: text("iban_cifrado"),
    titularCuentaCifrado: text("titular_cuenta_cifrado"),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("contacts_org_dni_hash_idx").on(t.organizationId, t.dniHash)],
);

export const leads = pgTable(
  "leads",
  {
    id: id(),
    organizationId: org(),
    contactId: uuid("contact_id").references(() => contacts.id),
    canal: text("canal"),
    /** nuevo | contactado | convertido | descartado */
    estado: text("estado").notNull().default("nuevo"),
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("leads_org_estado_idx").on(t.organizationId, t.estado)],
);

/** Copia publicada de cada versión de ficha. Inmutable (decisión D3). */
export const fichaVersions = pgTable(
  "ficha_versions",
  {
    id: id(),
    codigo: text("codigo").notNull(),
    version: integer("version").notNull(),
    nombre: text("nombre").notNull(),
    hash: text("hash").notNull(),
    definicion: jsonb("definicion").notNull(),
    publicadaAt: timestamp("publicada_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ficha_versions_codigo_version_uq").on(t.codigo, t.version)],
);

export const actuaciones = pgTable(
  "actuaciones",
  {
    id: id(),
    organizationId: org(),
    referencia: text("referencia").notNull(),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => contacts.id),
    leadId: uuid("lead_id").references(() => leads.id),
    fichaCodigo: text("ficha_codigo").notNull(),
    fichaVersion: integer("ficha_version").notNull(),
    estado: text("estado").notNull().default("lead"),
    /** Momento del último cambio de estado: base del semáforo (F-13). */
    estadoDesde: timestamp("estado_desde", { withTimezone: true }).notNull().defaultNow(),
    comunidadAutonoma: text("comunidad_autonoma"),
    anio: integer("anio"),
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull().default({}),
    ahorroKwh: numeric("ahorro_kwh", { precision: 14, scale: 3, mode: "number" }),
    responsableId: uuid("responsable_id").references(() => users.id),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    uniqueIndex("actuaciones_org_referencia_uq").on(t.organizationId, t.referencia),
    index("actuaciones_org_estado_idx").on(t.organizationId, t.estado, t.estadoDesde),
    index("actuaciones_agrupacion_idx").on(t.organizationId, t.fichaCodigo, t.comunidadAutonoma, t.anio),
  ],
);

export const documents = pgTable(
  "documents",
  {
    id: id(),
    organizationId: org(),
    actuacionId: uuid("actuacion_id")
      .notNull()
      .references(() => actuaciones.id),
    tipo: text("tipo").notNull(),
    estado: text("estado").notNull().default("subido"),
    nombreOriginal: text("nombre_original").notNull(),
    rutaOriginal: text("ruta_original").notNull(),
    rutaNormalizada: text("ruta_normalizada"),
    mime: text("mime"),
    bytes: integer("bytes"),
    datosExtraidos: jsonb("datos_extraidos").$type<Record<string, unknown>>(),
    confianza: jsonb("confianza").$type<Record<string, number>>(),
    motivoRechazo: text("motivo_rechazo"),
    /** Null si lo subió el beneficiario desde el portal. */
    subidoPor: uuid("subido_por").references(() => users.id),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("documents_actuacion_idx").on(t.actuacionId, t.tipo)],
);

export const generatedDocuments = pgTable("generated_documents", {
  id: id(),
  organizationId: org(),
  actuacionId: uuid("actuacion_id").references(() => actuaciones.id),
  loteId: uuid("lote_id").references(() => lotes.id),
  plantillaId: text("plantilla_id").notNull(),
  fichaCodigo: text("ficha_codigo").notNull(),
  fichaVersion: integer("ficha_version").notNull(),
  opciones: jsonb("opciones").$type<Record<string, unknown>>().notNull().default({}),
  ruta: text("ruta").notNull(),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: creado(),
});

export const lotes = pgTable(
  "lotes",
  {
    id: id(),
    organizationId: org(),
    referencia: text("referencia").notNull(),
    fichaCodigo: text("ficha_codigo").notNull(),
    /** Valores de las claves de agrupación, p. ej. { comunidad_autonoma, anio }. */
    clave: jsonb("clave").$type<Record<string, string>>().notNull(),
    estado: text("estado").notNull().default("borrador"),
    estadoDesde: timestamp("estado_desde", { withTimezone: true }).notNull().defaultNow(),
    verificador: text("verificador"),
    totalKwh: numeric("total_kwh", { precision: 14, scale: 3, mode: "number" }).notNull().default(0),
    responsableId: uuid("responsable_id").references(() => users.id),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [
    uniqueIndex("lotes_org_referencia_uq").on(t.organizationId, t.referencia),
    index("lotes_org_estado_idx").on(t.organizationId, t.estado, t.estadoDesde),
  ],
);

export const loteActuaciones = pgTable(
  "lote_actuaciones",
  {
    loteId: uuid("lote_id")
      .notNull()
      .references(() => lotes.id, { onDelete: "cascade" }),
    actuacionId: uuid("actuacion_id")
      .notNull()
      .references(() => actuaciones.id),
    createdAt: creado(),
  },
  (t) => [
    primaryKey({ columns: [t.loteId, t.actuacionId] }),
    // Un expediente solo puede estar en un lote.
    uniqueIndex("lote_actuaciones_actuacion_uq").on(t.actuacionId),
  ],
);

export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    organizationId: org(),
    actuacionId: uuid("actuacion_id").references(() => actuaciones.id),
    loteId: uuid("lote_id").references(() => lotes.id),
    titulo: text("titulo").notNull(),
    descripcion: text("descripcion"),
    origen: text("origen").notNull().default("interno"),
    /** 1 = máxima. */
    prioridad: integer("prioridad").notNull().default(3),
    responsableId: uuid("responsable_id").references(() => users.id),
    venceAt: timestamp("vence_at", { withTimezone: true }),
    abierta: boolean("abierta").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: creado(),
    cerradaAt: timestamp("cerrada_at", { withTimezone: true }),
  },
  (t) => [index("tasks_responsable_idx").on(t.organizationId, t.responsableId, t.abierta)],
);

/** Registro append-only de todo lo que pasa (F-02). Fuente del historial, semáforo y KPIs. */
export const events = pgTable(
  "events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    organizationId: org(),
    entidad: text("entidad").notNull(),
    entidadId: uuid("entidad_id").notNull(),
    tipo: text("tipo").notNull(),
    actorId: uuid("actor_id").references(() => users.id),
    datos: jsonb("datos").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: creado(),
  },
  (t) => [
    index("events_entidad_idx").on(t.entidad, t.entidadId, t.createdAt),
    index("events_org_tipo_idx").on(t.organizationId, t.tipo, t.createdAt),
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
    mes: date("mes").notNull(),
    metrica: text("metrica").notNull(),
    objetivo: integer("objetivo").notNull(),
  },
  (t) => [uniqueIndex("objectives_uq").on(t.userId, t.mes, t.metrica)],
);

/** Cola de tareas en Postgres para desarrollo y entornos sin Cloud Tasks. */
export const jobs = pgTable(
  "jobs",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tipo: text("tipo").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** pendiente | en_curso | hecho | error */
    estado: text("estado").notNull().default("pendiente"),
    intentos: integer("intentos").notNull().default(0),
    ejecutarDesde: timestamp("ejecutar_desde", { withTimezone: true }).notNull().defaultNow(),
    error: text("error"),
    createdAt: creado(),
    updatedAt: actualizado(),
  },
  (t) => [index("jobs_pendientes_idx").on(t.estado, t.ejecutarDesde).where(sql`estado = 'pendiente'`)],
);
