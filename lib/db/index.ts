import path from "node:path";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type Db = PostgresJsDatabase<typeof schema>;

type Holder = { db: Db; ready: Promise<void>; close: () => Promise<void> };

const g = globalThis as unknown as { __cbgDb?: Holder };

export const MIGRATIONS_DIR = path.join(process.cwd(), "drizzle");

async function createEmbedded(dataDir: string | undefined): Promise<Holder> {
  const [{ PGlite }, { vector }, { pg_trgm }, { drizzle }, { migrate }] = await Promise.all([
    import("@electric-sql/pglite"),
    import("@electric-sql/pglite-pgvector"),
    import("@electric-sql/pglite/contrib/pg_trgm"),
    import("drizzle-orm/pglite"),
    import("drizzle-orm/pglite/migrator"),
  ]);
  const client = new PGlite({ ...(dataDir ? { dataDir } : {}), extensions: { vector, pg_trgm } });
  const db = drizzle({ client, schema }) as unknown as Db;
  await migrate(db as never, { migrationsFolder: MIGRATIONS_DIR });
  return { db, ready: Promise.resolve(), close: () => client.close() };
}

function embeddedAllowed() {
  if (process.env.VERCEL) return false;
  return process.env.NODE_ENV !== "production" || process.env.CBG_ALLOW_EMBEDDED_DB === "1";
}

let pending: Promise<Holder> | undefined;

async function init(): Promise<Holder> {
  const url = process.env.DATABASE_URL;
  if (url) {
    const { default: postgres } = await import("postgres");
    const client = postgres(url, { max: 5, prepare: false, idle_timeout: 20 });
    const db = drizzlePostgres({ client, schema });
    return { db, ready: Promise.resolve(), close: () => client.end() };
  }
  if (!embeddedAllowed()) {
    throw new Error(
      "DATABASE_URL is not set. A hosted PostgreSQL database is required in production (see docs/deployment.md).",
    );
  }
  const dataDir =
    process.env.NODE_ENV === "test"
      ? undefined
      : (process.env.CBG_DATA_DIR ?? path.join(process.cwd(), ".data", "pglite"));
  return createEmbedded(dataDir);
}

/** Returns the shared database connection, creating and migrating the embedded DB on first use. */
export async function getDb(): Promise<Db> {
  if (g.__cbgDb) return g.__cbgDb.db;
  pending ??= init().then((h) => {
    g.__cbgDb = h;
    return h;
  });
  try {
    return (await pending).db;
  } catch (error) {
    pending = undefined;
    throw error;
  }
}

/** Synchronous handle for libraries that need a db object up front (Better Auth). Callers must await getDb() first. */
export const lazyDb = new Proxy({} as Db, {
  get(_target, prop) {
    const h = g.__cbgDb;
    if (!h) throw new Error("Database accessed before getDb() resolved");
    const value = Reflect.get(h.db as object, prop);
    return typeof value === "function" ? value.bind(h.db) : value;
  },
});

export async function closeDb() {
  const h = g.__cbgDb;
  g.__cbgDb = undefined;
  pending = undefined;
  await h?.close();
}

export { schema };

/** Normalizes raw `db.execute` results: postgres-js returns an array, PGlite returns `{ rows }`. */
export function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []) as T[];
}
