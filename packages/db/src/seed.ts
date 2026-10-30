/**
 * Datos iniciales para desarrollo: organización, usuario administrador
 * y publicación de las fichas del catálogo.
 */
import { eq } from "drizzle-orm";
import { cargarCatalogo } from "@certia/fichas";
import { crearDb } from "./index.js";
import { organizations, userRoles, users } from "./schema.js";
import { sincronizarFichas } from "./sincronizar-fichas.js";

const email = process.env.DEV_USER_EMAIL ?? "admin@example.com";
const dominio = email.split("@")[1] ?? "example.com";

const { db, pool } = crearDb();
try {
  let [org] = await db.select().from(organizations).where(eq(organizations.dominio, dominio));
  if (!org) {
    [org] = await db.insert(organizations).values({ nombre: "Organización de desarrollo", dominio }).returning();
    console.log(`Organización creada: ${dominio}`);
  }
  if (!org) throw new Error("No se pudo crear la organización");

  let [admin] = await db.select().from(users).where(eq(users.email, email));
  if (!admin) {
    [admin] = await db.insert(users).values({ organizationId: org.id, email, nombre: "Administrador" }).returning();
    console.log(`Usuario creado: ${email}`);
  }
  if (!admin) throw new Error("No se pudo crear el usuario");

  await db
    .insert(userRoles)
    .values(["admin", "direccion", "gestion", "verificacion"].map((rol) => ({ userId: admin.id, rol })))
    .onConflictDoNothing();

  const r = await sincronizarFichas(db, cargarCatalogo().todas());
  console.log(`Fichas publicadas: ${r.nuevas.join(", ") || "ninguna nueva"}`);
} finally {
  await pool.end();
}
