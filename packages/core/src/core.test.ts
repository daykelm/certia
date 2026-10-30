import { describe, expect, it } from "vitest";
import {
  calcularAhorro,
  compararVersiones,
  ejecutarPruebas,
  evaluarExpresion,
  generarChecklist,
  generarNombre,
  parsearFicha,
  proponerLotes,
  puedeTransicionar,
  puedeTransicionarLote,
  validarArchivo,
  type FichaEntrada,
} from "./index.js";

const base: FichaEntrada = {
  codigo: "TEST-VE",
  version: 1,
  nombre: "Ficha de prueba",
  vigencia: { desde: "2024-01-01" },
  campos: [
    { id: "tipo_vehiculo", etiqueta: "Tipo", tipo: "enum", opciones: ["M1", "N1"] },
    { id: "achatarramiento", etiqueta: "Achatarramiento", tipo: "booleano" },
    { id: "comunidad_autonoma", etiqueta: "CCAA", tipo: "ccaa" },
  ],
  constantes: { ahorro_anual: { M1: 600, N1: 900 }, vida_util: 10 },
  calculo: { formula: "ahorro_anual[tipo_vehiculo] * vida_util" },
  pruebas: [{ entrada: { tipo_vehiculo: "M1", achatarramiento: false, comunidad_autonoma: "01-andalucia" }, esperado_kwh: 6000 }],
  documentos: [
    { tipo: "ficha_tecnica", etiqueta: "Ficha técnica" },
    { tipo: "baja_vehiculo", etiqueta: "Baja del vehículo antiguo", condicion: "achatarramiento" },
    { tipo: "acuerdo_cesion", etiqueta: "Acuerdo de cesión", generado: true },
  ],
  agrupacion: { requerida: true, claves: ["comunidad_autonoma", "anio"], minimo_kwh: 30000 },
};

const v1 = parsearFicha(base);
const v2 = parsearFicha({
  ...base,
  version: 2,
  constantes: { ...base.constantes, factor_achatarramiento: 1.2 },
  calculo: { formula: "ahorro_anual[tipo_vehiculo] * vida_util * (achatarramiento ? factor_achatarramiento : 1)" },
  pruebas: [{ entrada: { tipo_vehiculo: "N1", achatarramiento: true, comunidad_autonoma: "13-madrid" }, esperado_kwh: 10800 }],
  documentos: [...(base.documentos ?? []), { tipo: "certificado_eficiencia", etiqueta: "Certificado" }],
});

describe("fichas", () => {
  it("aplica valores por defecto", () => {
    expect(v1.empaquetado.tamano_max_mb).toBe(10);
    expect(v1.campos[0]?.obligatorio).toBe(true);
  });

  it("rechaza fichas sin pruebas o con campos duplicados", () => {
    expect(() => parsearFicha({ ...base, pruebas: [] })).toThrow();
    expect(() => parsearFicha({ ...base, campos: [...base.campos, base.campos[0]] })).toThrow();
  });

  it("rechaza enum sin opciones", () => {
    expect(() =>
      parsearFicha({ ...base, campos: [{ id: "x", etiqueta: "X", tipo: "enum" }] }),
    ).toThrow();
  });
});

describe("cálculo", () => {
  it("calcula con tablas de constantes", () => {
    const r = calcularAhorro(v1, { tipo_vehiculo: "N1", achatarramiento: false, comunidad_autonoma: "13-madrid" });
    expect(r).toMatchObject({ ok: true, kwh: 9000 });
  });

  it("valida los datos antes de calcular", () => {
    const r = calcularAhorro(v1, { tipo_vehiculo: "X", comunidad_autonoma: "13-madrid" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.length).toBeGreaterThanOrEqual(2);
  });

  it("las pruebas de la ficha pasan", () => {
    expect(ejecutarPruebas(v1).every((p) => p.ok)).toBe(true);
    expect(ejecutarPruebas(v2).every((p) => p.ok)).toBe(true);
  });

  it("bloquea funciones peligrosas en fórmulas", () => {
    expect(() => evaluarExpresion('import({}, {})', {})).toThrow();
    expect(() => evaluarExpresion('evaluate("1+1")', {})).toThrow();
  });
});

describe("comparador", () => {
  it("elige la versión con más ahorro y muestra documentos exclusivos", () => {
    const c = compararVersiones([v1, v2], { tipo_vehiculo: "M1", achatarramiento: true, comunidad_autonoma: "13-madrid" });
    expect(c.mejor).toEqual({ codigo: "TEST-VE", version: 2, kwh: 7200 });
    expect(c.versiones[1]?.documentosExclusivos).toEqual(["certificado_eficiencia"]);
  });
});

describe("checklist", () => {
  it("aplica documentos condicionales", () => {
    const sin = generarChecklist(v1, { achatarramiento: false }, []);
    expect(sin.faltan).toEqual(["ficha_tecnica", "acuerdo_cesion"]);
    const con = generarChecklist(v1, { achatarramiento: true }, [{ tipo: "ficha_tecnica", estado: "validado" }]);
    expect(con.faltan).toEqual(["baja_vehiculo", "acuerdo_cesion"]);
  });

  it("está completa cuando todo lo obligatorio está validado", () => {
    const c = generarChecklist(v1, { achatarramiento: false }, [
      { tipo: "ficha_tecnica", estado: "rechazado" },
      { tipo: "ficha_tecnica", estado: "validado" },
      { tipo: "acuerdo_cesion", estado: "validado" },
    ]);
    expect(c.completa).toBe(true);
  });
});

describe("flujo del expediente", () => {
  const ctx = { checklistCompleta: true, ahorroCalculado: true, origen: "usuario" as const };

  it("permite transiciones válidas", () => {
    expect(puedeTransicionar("pendiente_revision", "completo", ctx).ok).toBe(true);
  });

  it("explica por qué no se puede completar", () => {
    const r = puedeTransicionar("pendiente_revision", "completo", { ...ctx, checklistCompleta: false });
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("Faltan documentos obligatorios por validar");
  });

  it("los estados de lote no se cambian a mano", () => {
    expect(puedeTransicionar("completo", "en_lote", ctx).ok).toBe(false);
    expect(puedeTransicionar("completo", "en_lote", { ...ctx, origen: "lote" }).ok).toBe(true);
  });

  it("rechaza saltos no definidos", () => {
    expect(puedeTransicionar("lead", "emitido", ctx).ok).toBe(false);
  });
});

describe("flujo del lote", () => {
  it("no se prepara sin alcanzar el mínimo", () => {
    const r = puedeTransicionarLote("borrador", "preparado_verificacion", {
      alcanzaMinimo: false,
      numActuaciones: 3,
      tareasAbiertas: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("propuesta de lotes", () => {
  it("agrupa por claves y calcula lo que falta", () => {
    const actuacion = (id: string, estado: "completo" | "incompleto", ccaa: string, kwh = 6000) => ({
      id,
      estado,
      ahorroKwh: kwh,
      valores: { comunidad_autonoma: ccaa, anio: 2025 },
    });
    const propuestas = proponerLotes(
      [
        ...["a", "b", "c", "d", "e"].map((id) => actuacion(id, "completo", "01-andalucia")),
        actuacion("f", "completo", "13-madrid"),
        actuacion("g", "incompleto", "13-madrid"),
      ],
      v1.agrupacion,
    );
    expect(propuestas[0]).toMatchObject({ etiqueta: "01-andalucia · 2025", totalKwh: 30000, alcanzaMinimo: true });
    expect(propuestas[1]).toMatchObject({ totalKwh: 6000, faltanKwh: 24000, candidatas: ["g"], totalPotencialKwh: 12000 });
  });
});

describe("nombres de archivo", () => {
  it("normaliza acentos y caracteres prohibidos", () => {
    expect(generarNombre("{referencia}_{tipo}", { referencia: "AND 2025.03", tipo: "Ficha técnica" }, v1.empaquetado)).toBe(
      "AND_2025_03_Ficha_tecnica",
    );
  });

  it("detecta nombres y tamaños inválidos", () => {
    const errores = validarArchivo({ nombre: "mal nombre.v2", extension: "pdf", bytes: 12 * 1024 * 1024 }, v1.empaquetado);
    expect(errores).toHaveLength(3);
  });
});
