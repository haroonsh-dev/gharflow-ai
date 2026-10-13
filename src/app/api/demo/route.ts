import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { hash } from "argon2";
import { z } from "zod";
import { identity, sameOrigin, startSession } from "@/lib/auth";
import { db, rows } from "@/lib/db";
import { seedDemo } from "@/lib/demo";
import { removeHouseholdFiles } from "@/lib/storage";
import { errorResponse, failure } from "@/lib/http";
import { demoEnabled } from "@/lib/config";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  if (!demoEnabled()) return failure("Demo disabled", 404);
  try {
    const input = z
      .object({ reset: z.boolean().default(false) })
      .parse(await request.json());
    if (input.reset) {
      const person = await identity();
      if (!person) return failure("Sign in required", 401);
      const demo = await rows<{ is_demo: boolean }>(
        "SELECT is_demo FROM households WHERE id=$1",
        [person.householdId],
      );
      if (!demo[0]?.is_demo)
        return failure("Only synthetic demo data can be reset", 403);
      await seedDemo(person, true);
      return NextResponse.json({ ok: true });
    }
    const email = `demo-${randomBytes(12).toString("hex")}@example.test`;
    const client = await db.connect();
    let userId: string;
    let householdId: string;
    try {
      await client.query("BEGIN");
      const user = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash) VALUES($1,$2) RETURNING id",
        [email, await hash(randomBytes(32).toString("hex"))],
      );
      userId = user.rows[0].id;
      const household = await client.query<{ id: string }>(
        "INSERT INTO households(owner_id,name,is_demo) VALUES($1,'Synthetic demo',true) RETURNING id",
        [userId],
      );
      householdId = household.rows[0].id;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    try {
      await seedDemo({ userId, householdId, email });
      await startSession(userId);
    } catch (error) {
      await rows("DELETE FROM users WHERE id=$1", [userId]);
      await removeHouseholdFiles(householdId);
      throw error;
    }
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
