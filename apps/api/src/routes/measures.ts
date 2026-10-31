import type { FastifyInstance } from "fastify";
import { calculateSavings, compareVersions } from "@certia/core";
import { CalculateSchema, CompareSchema } from "@certia/shared";
import { currentUser, HttpError, type Services } from "../context.js";

export async function measureRoutes(app: FastifyInstance, { catalog }: Services) {
  app.addHook("preHandler", async (req) => void currentUser(req));

  /** Catalog summary. */
  app.get("/", async () =>
    catalog.all().map((m) => ({ code: m.code, version: m.version, name: m.name, validity: m.validity })),
  );

  /** Full definition of a version (used by the frontend to build forms). */
  app.get<{ Params: { code: string; version: string } }>("/:code/:version", async (req) => {
    const measure = catalog.get(req.params.code, Number(req.params.version));
    if (!measure) throw new HttpError(404, "Measure not found");
    return measure;
  });

  /** Calculates savings without persisting anything (F-03). */
  app.post<{ Params: { code: string; version: string } }>("/:code/:version/calculate", async (req) => {
    const measure = catalog.get(req.params.code, Number(req.params.version));
    if (!measure) throw new HttpError(404, "Measure not found");
    const { data } = CalculateSchema.parse(req.body);
    return calculateSavings(measure, data);
  });

  /** Compares every version of a measure using the same data, in kWh and euros (F-07). */
  app.post<{ Params: { code: string } }>("/:code/compare", async (req) => {
    const versions = catalog.versions(req.params.code);
    if (versions.length === 0) throw new HttpError(404, "Measure not found");
    const { data, pricePerKwh, baselineVersion } = CompareSchema.parse(req.body);
    if (baselineVersion !== undefined && !versions.some((m) => m.version === baselineVersion)) {
      throw new HttpError(400, `Version ${baselineVersion} does not exist for this measure`);
    }
    return compareVersions(versions, data, { pricePerKwh, baselineVersion });
  });
}
