import { defineConfig } from "tsup";

// Empaqueta la app con los paquetes internos (@certia/*) incluidos.
// Las dependencias de npm se resuelven desde node_modules en tiempo de ejecución.
export default defineConfig({
  entry: ["src/index.ts", "src/migrate.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  sourcemap: true,
  noExternal: [/^@certia\//],
});
