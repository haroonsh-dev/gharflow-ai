import { db } from "./db";
import type { PoolClient } from "pg";
export class HouseholdError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
export async function householdTransaction<T>(
  id: string,
  work: (client: PoolClient) => Promise<T>,
) {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [id]);
    const found = await client.query<{ deleting: boolean }>(
      "SELECT deleting FROM households WHERE id=$1",
      [id],
    );
    if (!found.rows[0] || found.rows[0].deleting)
      throw new HouseholdError("Household unavailable", 409);
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
