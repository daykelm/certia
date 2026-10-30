import { defineConfig } from "tsup";

// Bundles the app together with the internal packages (@certia/*).
// npm dependencies are resolved from node_modules at runtime.
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
