import { all, create, type FactoryFunctionMap } from "mathjs";
import { z } from "zod";
import { CcaaSchema } from "@certia/shared";
import type { Campo, Ficha } from "./schema.js";

/**
 * Safe expression evaluator (F-03).
 *
 * Uses the mathjs parser, which never executes JavaScript, and additionally disables
 * the functions that would let a formula tamper with the evaluator itself.
 */
const math = create(all as FactoryFunctionMap);
const evaluar = math.evaluate.bind(math);
math.import(
  {
    import: bloqueada("import"),
    createUnit: bloqueada("createUnit"),
    evaluate: bloqueada("evaluate"),
    parse: bloqueada("parse"),
    simplify: bloqueada("simplify"),
    derivative: bloqueada("derivative"),
    resolve: bloqueada("resolve"),
    compile: bloqueada("compile"),
  },
  { override: true },
);

function bloqueada(nombre: string) {
  return () => {
    throw new Error(`La función ${nombre} no está permitida en fórmulas`);
  };
}

export function evaluarExpresion(expresion: string, ambito: Record<string, unknown>): unknown {
  // mathjs may mutate the scope (assignments), so we work on a copy.
  return evaluar(expresion, { ...ambito });
}

// --- Data validation against the ficha's fields ---

function esquemaCampo(campo: Campo): z.ZodTypeAny {
  let esquema: z.ZodTypeAny;
  switch (campo.tipo) {
    case "texto":
      esquema = z.string().min(1);
      break;
    case "numero": {
      let n = z.coerce.number();
      if (campo.min !== undefined) n = n.min(campo.min);
      if (campo.max !== undefined) n = n.max(campo.max);
      esquema = n;
      break;
    }
    case "entero": {
      let n = z.coerce.number().int();
      if (campo.min !== undefined) n = n.min(campo.min);
      if (campo.max !== undefined) n = n.max(campo.max);
      esquema = n;
      break;
    }
    case "booleano":
      esquema = z.boolean();
      break;
    case "fecha":
      esquema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha AAAA-MM-DD");
      break;
    case "enum":
      esquema = z.enum(campo.opciones as [string, ...string[]]);
      break;
    case "ccaa":
      esquema = CcaaSchema;
      break;
  }
  return campo.obligatorio ? esquema : esquema.optional();
}

export function esquemaDatos(ficha: Ficha) {
  const forma: Record<string, z.ZodTypeAny> = {};
  for (const campo of ficha.campos) forma[campo.id] = esquemaCampo(campo);
  return z.object(forma);
}

export type ResultadoValidacion =
  | { ok: true; datos: Record<string, unknown> }
  | { ok: false; errores: string[] };

export function validarDatos(ficha: Ficha, datos: Record<string, unknown>): ResultadoValidacion {
  const r = esquemaDatos(ficha).safeParse(datos);
  if (r.success) return { ok: true, datos: r.data };
  return {
    ok: false,
    errores: r.error.issues.map((i) => `${i.path.join(".") || "datos"}: ${i.message}`),
  };
}

// --- Savings calculation ---

export type ResultadoCalculo =
  | { ok: true; kwh: number; datos: Record<string, unknown> }
  | { ok: false; errores: string[] };

export function calcularAhorro(ficha: Ficha, datos: Record<string, unknown>): ResultadoCalculo {
  const validacion = validarDatos(ficha, datos);
  if (!validacion.ok) return validacion;

  let valor: unknown;
  try {
    valor = evaluarExpresion(ficha.calculo.formula, { ...ficha.constantes, ...validacion.datos });
  } catch (e) {
    return { ok: false, errores: [`Error al evaluar la fórmula: ${(e as Error).message}`] };
  }

  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return { ok: false, errores: ["La fórmula no devolvió un número válido"] };
  }
  if (valor < 0) {
    return { ok: false, errores: ["El ahorro calculado es negativo"] };
  }
  const factor = 10 ** ficha.calculo.decimales;
  return { ok: true, kwh: Math.round(valor * factor) / factor, datos: validacion.datos };
}

// --- Ficha test cases ---

export interface ResultadoPrueba {
  descripcion: string;
  ok: boolean;
  esperado: number;
  obtenido?: number;
  errores?: string[];
}

export function ejecutarPruebas(ficha: Ficha): ResultadoPrueba[] {
  return ficha.pruebas.map((prueba, i) => {
    const descripcion = prueba.descripcion ?? `Test ${i + 1}`;
    const r = calcularAhorro(ficha, prueba.entrada);
    if (!r.ok) {
      return { descripcion, ok: false, esperado: prueba.esperado_kwh, errores: r.errores };
    }
    return {
      descripcion,
      ok: Math.abs(r.kwh - prueba.esperado_kwh) <= prueba.tolerancia,
      esperado: prueba.esperado_kwh,
      obtenido: r.kwh,
    };
  });
}
