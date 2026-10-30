import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// drizzle-kit does not load .env by itself.
if (existsSync("../../.env")) process.loadEnvFile("../../.env");

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://certia:certia@localhost:5432/certia",
  },
});
