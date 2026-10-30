import { z } from "zod";

/**
 * Definición de una ficha de actuación (F-03).
 *
 * Una ficha es configuración, no código: añadir un tipo de actuación nuevo
 * consiste en escribir un archivo que cumpla este esquema.
 * Las versiones publicadas son inmutables (PROJECT.md, decisión D3).
 */

const IDENTIFICADOR = /^[a-z][a-z0-9_]*$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const TIPOS_CAMPO = ["texto", "numero", "entero", "booleano", "fecha", "enum", "ccaa"] as const;

export const CampoSchema = z
  .object({
    id: z.string().regex(IDENTIFICADOR, "El id debe ser snake_case y empezar por letra"),
    etiqueta: z.string().min(1),
    tipo: z.enum(TIPOS_CAMPO),
    opciones: z.array(z.string().min(1)).optional(),
    unidad: z.string().optional(),
    obligatorio: z.boolean().default(true),
    min: z.number().optional(),
    max: z.number().optional(),
    /** De dónde sale el dato: "manual" o "documento:<tipo>" (para la extracción con IA, F-05). */
    fuente: z.string().default("manual"),
    ayuda: z.string().optional(),
  })
  .refine((c) => c.tipo !== "enum" || (c.opciones && c.opciones.length > 0), {
    message: "Los campos de tipo enum necesitan opciones",
  });

export const DocumentoRequeridoSchema = z.object({
  tipo: z.string().regex(IDENTIFICADOR),
  etiqueta: z.string().min(1),
  obligatorio: z.boolean().default(true),
  /** Expresión booleana sobre los campos; si es falsa, el documento no aplica. */
  condicion: z.string().optional(),
  /** El documento lo genera Certia a partir de una plantilla (F-09). */
  generado: z.boolean().default(false),
  /** Campos de la ficha que se extraen de este documento (F-05). */
  extraer: z.array(z.string()).default([]),
});

export const AgrupacionSchema = z.object({
  requerida: z.boolean().default(false),
  /** Claves que deben coincidir para agrupar: columnas del expediente o campos de la ficha. */
  claves: z.array(z.string()).default([]),
  minimo_kwh: z.number().nonnegative().default(0),
});

export const PlantillaSchema = z.object({
  id: z.string().regex(IDENTIFICADOR),
  documento: z.string().regex(IDENTIFICADOR),
  archivo: z.string().min(1),
  clausulas_opcionales: z
    .array(z.object({ id: z.string().regex(IDENTIFICADOR), etiqueta: z.string().min(1) }))
    .default([]),
});

export const EmpaquetadoSchema = z.object({
  tamano_max_mb: z.number().positive().default(10),
  longitud_max_nombre: z.number().int().positive().default(100),
  caracteres_prohibidos: z.string().default(".,;:/\\?*\"<>|'"),
  patron_nombre: z.string().default("{referencia}_{tipo}"),
});

export const PruebaSchema = z.object({
  descripcion: z.string().optional(),
  entrada: z.record(z.unknown()),
  esperado_kwh: z.number(),
  tolerancia: z.number().nonnegative().default(0.001),
});

export const FichaSchema = z
  .object({
    codigo: z.string().min(1),
    version: z.number().int().positive(),
    nombre: z.string().min(1),
    descripcion: z.string().optional(),
    vigencia: z.object({
      desde: z.string().regex(FECHA),
      hasta: z.string().regex(FECHA).optional(),
    }),
    campos: z.array(CampoSchema).min(1),
    /** Valores fijos que usa la fórmula (factores, vida útil...). Pueden ser tablas. */
    constantes: z.record(z.unknown()).default({}),
    calculo: z.object({
      formula: z.string().min(1),
      decimales: z.number().int().min(0).max(6).default(0),
    }),
    pruebas: z.array(PruebaSchema).min(1, "Cada ficha necesita al menos un caso de prueba"),
    documentos: z.array(DocumentoRequeridoSchema).default([]),
    agrupacion: AgrupacionSchema.default({}),
    plantillas: z.array(PlantillaSchema).default([]),
    empaquetado: EmpaquetadoSchema.default({}),
  })
  .superRefine((f, ctx) => {
    const ids = new Set<string>();
    for (const campo of f.campos) {
      if (ids.has(campo.id)) {
        ctx.addIssue({ code: "custom", message: `Campo duplicado: ${campo.id}` });
      }
      ids.add(campo.id);
    }
    for (const constante of Object.keys(f.constantes)) {
      if (ids.has(constante)) {
        ctx.addIssue({
          code: "custom",
          message: `La constante "${constante}" tiene el mismo nombre que un campo`,
        });
      }
    }
    const tiposDoc = new Set(f.documentos.map((d) => d.tipo));
    for (const plantilla of f.plantillas) {
      if (!tiposDoc.has(plantilla.documento)) {
        ctx.addIssue({
          code: "custom",
          message: `La plantilla "${plantilla.id}" genera "${plantilla.documento}", que no está en documentos`,
        });
      }
    }
  });

export type Campo = z.infer<typeof CampoSchema>;
export type DocumentoRequerido = z.infer<typeof DocumentoRequeridoSchema>;
export type Agrupacion = z.infer<typeof AgrupacionSchema>;
export type Plantilla = z.infer<typeof PlantillaSchema>;
export type Empaquetado = z.infer<typeof EmpaquetadoSchema>;
export type Ficha = z.infer<typeof FichaSchema>;
/** Entrada sin valores por defecto aplicados (lo que se escribe en el YAML). */
export type FichaEntrada = z.input<typeof FichaSchema>;

export function parsearFicha(entrada: unknown): Ficha {
  return FichaSchema.parse(entrada);
}

export function claveFicha(f: Pick<Ficha, "codigo" | "version">): string {
  return `${f.codigo}@v${f.version}`;
}
