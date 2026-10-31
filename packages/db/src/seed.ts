/**
 * Development seed data: organization, admin user and publication
 * of the catalog's measures.
 */
import { eq } from "drizzle-orm";
import { loadCatalog } from "@certia/measures";
import { createDb } from "./index.js";
import { organizations, userRoles, users } from "./schema.js";
import { syncMeasures } from "./sync-measures.js";

const email = process.env.DEV_USER_EMAIL ?? "admin@certia-es.com";
const domain = email.split("@")[1] ?? "certia-es.com";

const { db, pool } = createDb();
try {
  let [org] = await db.select().from(organizations).where(eq(organizations.domain, domain));
  if (!org) {
    [org] = await db.insert(organizations).values({ name: "Development organization", domain }).returning();
    console.log(`Organization created: ${domain}`);
  }
  if (!org) throw new Error("Could not create the organization");

  let [admin] = await db.select().from(users).where(eq(users.email, email));
  if (!admin) {
    [admin] = await db.insert(users).values({ organizationId: org.id, email, name: "Administrator" }).returning();
    console.log(`User created: ${email}`);
  }
  if (!admin) throw new Error("Could not create the user");

  const adminId = admin.id;
  await db
    .insert(userRoles)
    .values(["admin", "director", "case_manager", "verifier"].map((role) => ({ userId: adminId, role })))
    .onConflictDoNothing();

  const r = await syncMeasures(db, loadCatalog().all());
  console.log(`Measures published: ${r.added.join(", ") || "none new"}`);
} finally {
  await pool.end();
}
