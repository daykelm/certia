// Applies migrations from the Docker image (APP_MODE=migrate).
import { aplicarMigraciones } from "@certia/db";

await aplicarMigraciones();
console.log("Migrations applied.");
