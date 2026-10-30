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
  it("applies defaults", () => {
    expect(v1.empaquetado.tamano_max_mb).toBe(10);
    expect(v1.campos[0]?.obligatorio).toBe(true);
  });

  it("rejects fichas without tests or with duplicate fields", () => {
    expect(() => parsearFicha({ ...base, pruebas: [] })).toThrow();
    expect(() => parsearFicha({ ...base, campos: [...base.campos, base.campos[0]!] })).toThrow();
  });

  it("rejects enums without options", () => {
    expect(() =>
      parsearFicha({ ...base, campos: [{ id: "x", etiqueta: "X", tipo: "enum" }] }),
    ).toThrow();
  });
});

describe("calculation", () => {
  it("calculates with constant lookup tables", () => {
    const r = calcularAhorro(v1, { tipo_vehiculo: "N1", achatarramiento: false, comunidad_autonoma: "13-madrid" });
    expect(r).toMatchObject({ ok: true, kwh: 9000 });
  });

  it("validates data before calculating", () => {
    const r = calcularAhorro(v1, { tipo_vehiculo: "X", comunidad_autonoma: "13-madrid" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errores.length).toBeGreaterThanOrEqual(2);
  });

  it("ficha test cases pass", () => {
    expect(ejecutarPruebas(v1).every((p) => p.ok)).toBe(true);
    expect(ejecutarPruebas(v2).every((p) => p.ok)).toBe(true);
  });

  it("blocks dangerous functions in formulas", () => {
    expect(() => evaluarExpresion('import({}, {})', {})).toThrow();
    expect(() => evaluarExpresion('evaluate("1+1")', {})).toThrow();
  });
});

describe("version comparator", () => {
  it("picks the version with the highest savings and lists exclusive documents", () => {
    const c = compararVersiones([v1, v2], { tipo_vehiculo: "M1", achatarramiento: true, comunidad_autonoma: "13-madrid" });
    expect(c.mejor).toEqual({ codigo: "TEST-VE", version: 2, kwh: 7200 });
    expect(c.versiones[1]?.documentosExclusivos).toEqual(["certificado_eficiencia"]);
  });
});

describe("checklist", () => {
  it("applies conditional documents", () => {
    const sin = generarChecklist(v1, { achatarramiento: false }, []);
    expect(sin.faltan).toEqual(["ficha_tecnica", "acuerdo_cesion"]);
    const con = generarChecklist(v1, { achatarramiento: true }, [{ tipo: "ficha_tecnica", estado: "validado" }]);
    expect(con.faltan).toEqual(["baja_vehiculo", "acuerdo_cesion"]);
  });

  it("is complete when every mandatory document is validated", () => {
    const c = generarChecklist(v1, { achatarramiento: false }, [
      { tipo: "ficha_tecnica", estado: "rechazado" },
      { tipo: "ficha_tecnica", estado: "validado" },
      { tipo: "acuerdo_cesion", estado: "validado" },
    ]);
    expect(c.completa).toBe(true);
  });
});

describe("expediente workflow", () => {
  const ctx = { checklistCompleta: true, ahorroCalculado: true, origen: "usuario" as const };

  it("allows valid transitions", () => {
    expect(puedeTransicionar("pendiente_revision", "completo", ctx).ok).toBe(true);
  });

  it("explains why it cannot be completed", () => {
    const r = puedeTransicionar("pendiente_revision", "completo", { ...ctx, checklistCompleta: false });
    expect(r.ok).toBe(false);
    expect(r.motivos).toContain("Faltan documentos obligatorios por validar");
  });

  it("lote-driven states cannot be changed by hand", () => {
    expect(puedeTransicionar("completo", "en_lote", ctx).ok).toBe(false);
    expect(puedeTransicionar("completo", "en_lote", { ...ctx, origen: "lote" }).ok).toBe(true);
  });

  it("rejects undefined transitions", () => {
    expect(puedeTransicionar("lead", "emitido", ctx).ok).toBe(false);
  });
});

describe("lote workflow", () => {
  it("cannot be prepared below the minimum", () => {
    const r = puedeTransicionarLote("borrador", "preparado_verificacion", {
      alcanzaMinimo: false,
      numActuaciones: 3,
      tareasAbiertas: 0,
    });
    expect(r.ok).toBe(false);
  });
});

describe("lote proposals", () => {
  it("groups by keys and computes what is missing", () => {
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

describe("file names", () => {
  it("normalizes accents and forbidden characters", () => {
    expect(generarNombre("{referencia}_{tipo}", { referencia: "AND 2025.03", tipo: "Ficha técnica" }, v1.empaquetado)).toBe(
      "AND_2025_03_Ficha_tecnica",
    );
  });

  it("detects invalid names and sizes", () => {
    const errores = validarArchivo({ nombre: "mal nombre.v2", extension: "pdf", bytes: 12 * 1024 * 1024 }, v1.empaquetado);
    expect(errores).toHaveLength(3);
  });
});
