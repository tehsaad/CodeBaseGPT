/**
 * Applies drizzle/ migrations to the database in DATABASE_URL (Neon, Supabase, RDS, local Postgres).
 * The embedded development database migrates itself on first use and doesn't need this.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Nothing to migrate.");
  process.exit(1);
}

const client = postgres(url, { max: 1, prepare: false });
try {
  await migrate(drizzle({ client }), { migrationsFolder: "drizzle" });
  console.log("Migrations applied.");
} catch (error) {
  console.error("Migration failed:", (error as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
