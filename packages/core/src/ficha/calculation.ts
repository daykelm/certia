import { all, create, type FactoryFunctionMap } from "mathjs";
import { z } from "zod";
import { RegionSchema } from "@certia/shared";
import type { Field, Ficha } from "./schema.js";

/**
 * Safe expression evaluator (F-03).
 *
 * Uses the mathjs parser, which never executes JavaScript, and additionally disables
 * the functions that would let a formula tamper with the evaluator itself.
 */
const math = create(all as FactoryFunctionMap);
const evaluate = math.evaluate.bind(math);
math.import(
  {
    import: blocked("import"),
    createUnit: blocked("createUnit"),
    evaluate: blocked("evaluate"),
    parse: blocked("parse"),
    simplify: blocked("simplify"),
    derivative: blocked("derivative"),
    resolve: blocked("resolve"),
    compile: blocked("compile"),
  },
  { override: true },
);

function blocked(name: string) {
  return () => {
    throw new Error(`La función ${name} no está permitida en fórmulas`);
  };
}

export function evaluateExpression(expression: string, scope: Record<string, unknown>): unknown {
  // mathjs may mutate the scope (assignments), so we work on a copy.
  return evaluate(expression, { ...scope });
}

// --- Data validation against the ficha's fields ---

function fieldSchema(field: Field): z.ZodTypeAny {
  let schema: z.ZodTypeAny;
  switch (field.type) {
    case "text":
      schema = z.string().min(1);
      break;
    case "number": {
      let n = z.coerce.number();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      schema = n;
      break;
    }
    case "integer": {
      let n = z.coerce.number().int();
      if (field.min !== undefined) n = n.min(field.min);
      if (field.max !== undefined) n = n.max(field.max);
      schema = n;
      break;
    }
    case "boolean":
      schema = z.boolean();
      break;
    case "date":
      schema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha AAAA-MM-DD");
      break;
    case "enum":
      schema = z.enum(field.options as [string, ...string[]]);
      break;
    case "region":
      schema = RegionSchema;
      break;
  }
  return field.required ? schema : schema.optional();
}

export function dataSchema(ficha: Ficha) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const field of ficha.fields) shape[field.id] = fieldSchema(field);
  return z.object(shape);
}

export type ValidationResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; errors: string[] };

export function validateData(ficha: Ficha, data: Record<string, unknown>): ValidationResult {
  const r = dataSchema(ficha).safeParse(data);
  if (r.success) return { ok: true, data: r.data };
  return {
    ok: false,
    errors: r.error.issues.map((i) => `${i.path.join(".") || "data"}: ${i.message}`),
  };
}

// --- Savings calculation ---

export type CalculationResult =
  | { ok: true; kwh: number; data: Record<string, unknown> }
  | { ok: false; errors: string[] };

export function calculateSavings(ficha: Ficha, data: Record<string, unknown>): CalculationResult {
  const validation = validateData(ficha, data);
  if (!validation.ok) return validation;

  let value: unknown;
  try {
    value = evaluateExpression(ficha.calculation.formula, { ...ficha.constants, ...validation.data });
  } catch (e) {
    return { ok: false, errors: [`Error al evaluar la fórmula: ${(e as Error).message}`] };
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, errors: ["La fórmula no devolvió un número válido"] };
  }
  if (value < 0) {
    return { ok: false, errors: ["El ahorro calculado es negativo"] };
  }
  const factor = 10 ** ficha.calculation.decimals;
  return { ok: true, kwh: Math.round(value * factor) / factor, data: validation.data };
}

// --- Ficha test cases ---

export interface TestResult {
  description: string;
  ok: boolean;
  expected: number;
  actual?: number;
  errors?: string[];
}

export function runTests(ficha: Ficha): TestResult[] {
  return ficha.tests.map((test, i) => {
    const description = test.description ?? `Test ${i + 1}`;
    const r = calculateSavings(ficha, test.input);
    if (!r.ok) return { description, ok: false, expected: test.expected_kwh, errors: r.errors };
    return {
      description,
      ok: Math.abs(r.kwh - test.expected_kwh) <= test.tolerance,
      expected: test.expected_kwh,
      actual: r.kwh,
    };
  });
}
