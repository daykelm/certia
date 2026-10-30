/**
 * Development seed data: organization, admin user and publication
 * of the catalog's fichas.
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
    console.log(`Organization created: ${dominio}`);
  }
  if (!org) throw new Error("Could not create the organization");

  let [admin] = await db.select().from(users).where(eq(users.email, email));
  if (!admin) {
    [admin] = await db.insert(users).values({ organizationId: org.id, email, nombre: "Administrador" }).returning();
    console.log(`User created: ${email}`);
  }
  if (!admin) throw new Error("Could not create the user");

  const adminId = admin.id;
  await db
    .insert(userRoles)
    .values(["admin", "direccion", "gestion", "verificacion"].map((rol) => ({ userId: adminId, rol })))
    .onConflictDoNothing();

  const r = await sincronizarFichas(db, cargarCatalogo().todas());
  console.log(`Fichas published: ${r.nuevas.join(", ") || "none new"}`);
} finally {
  await pool.end();
}
