import { Pool, type QueryResultRow } from "pg";
import { readFileSync } from "node:fs";

const globalForDb = globalThis as unknown as { gharflowPool?: Pool };

function connectionUrl() {
  if (process.env.PILOT_MODE === "true" && process.env.DATABASE_SSL !== "true")
    throw new Error("Pilot database requires verified TLS");
  if (!process.env.DATABASE_URL) return undefined;
  try {
    const url = new URL(process.env.DATABASE_URL);
    if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error();
    return url;
  } catch {
    throw new Error("Invalid database configuration");
  }
}
const connection = connectionUrl();
if (process.env.DATABASE_SSL === "true")
  for (const key of ["sslmode", "sslcert", "sslkey", "sslrootcert"])
    connection?.searchParams.delete(key);
export const db =
  globalForDb.gharflowPool ??
  new Pool({
    connectionString: connection?.toString(),
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
    query_timeout: 15000,
    statement_timeout: 15000,
    ssl:
      process.env.DATABASE_SSL === "true"
        ? {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA_FILE
              ? { ca: readFileSync(process.env.DATABASE_CA_FILE, "utf8") }
              : {}),
          }
        : undefined,
  });
if (!db.listenerCount("error"))
  db.on("error", () => console.error("Database idle connection lost"));
if (process.env.NODE_ENV !== "production") globalForDb.gharflowPool = db;

export async function rows<T extends QueryResultRow>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  const result = await db.query<T>(sql, values);
  return result.rows;
}
