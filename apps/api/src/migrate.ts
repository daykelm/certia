// Applies migrations from the Docker image (APP_MODE=migrate).
import { runMigrations } from "@certia/db";

await runMigrations();
console.log("Migrations applied.");
