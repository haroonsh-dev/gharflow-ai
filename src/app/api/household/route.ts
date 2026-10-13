import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { db, rows } from "@/lib/db";
import { removeHouseholdFiles } from "@/lib/storage";
import { endSession } from "@/lib/auth";
export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const person = await guard(request, true);
  if (person instanceof NextResponse) return person;
  try {
    // Retain rows until cloud deletion succeeds, so a failed deletion can be retried.
    await rows("UPDATE households SET deleting=true WHERE id=$1", [
      person.householdId,
    ]);
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        person.householdId,
      ]);
      await removeHouseholdFiles(person.householdId, client);
      await client.query(
        "INSERT INTO deletion_tombstones(user_id,household_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
        [person.userId, person.householdId],
      );
      await client.query("DELETE FROM invitations WHERE email=$1", [
        person.email,
      ]);
      await client.query("DELETE FROM users WHERE id=$1", [person.userId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
