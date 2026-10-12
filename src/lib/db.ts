import { Pool, type QueryResultRow } from "pg";

const globalForDb = globalThis as unknown as { gharflowPool?: Pool };

export const db = globalForDb.gharflowPool ?? new Pool({ connectionString: process.env.DATABASE_URL });
if (process.env.NODE_ENV !== "production") globalForDb.gharflowPool = db;

export async function rows<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
  const result = await db.query<T>(sql, values);
  return result.rows;
}
