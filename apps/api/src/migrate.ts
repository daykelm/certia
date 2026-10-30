// Aplica las migraciones desde la imagen Docker (APP_MODE=migrate).
import { aplicarMigraciones } from "@certia/db";

await aplicarMigraciones();
console.log("Migraciones aplicadas.");
