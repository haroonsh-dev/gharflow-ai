import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import pg from "pg";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(741382)");
  await client.query("CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())");
  const directory = path.join(process.cwd(), "db");
  for (const name of (await readdir(directory)).filter((file) => /^\d+_.*\.sql$/.test(file)).sort()) {
    const existing = await client.query("SELECT 1 FROM schema_migrations WHERE name=$1", [name]);
    if (existing.rowCount) continue;
    await client.query(await readFile(path.join(directory, name), "utf8"));
    await client.query("INSERT INTO schema_migrations(name) VALUES ($1)", [name]);
    console.log(`Applied migration ${name}`);
  }
  await client.query("COMMIT");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
