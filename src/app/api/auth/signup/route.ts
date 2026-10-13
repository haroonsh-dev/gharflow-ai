import { jsonBody } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { signupSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { sameOrigin, startSession } from "@/lib/auth";
import { errorResponse, failure } from "@/lib/http";
import { householdLimit } from "@/lib/config";
import { issueToken, tokenHash } from "@/lib/tokens";
import { authAllowed } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  try {
    const input = signupSchema.parse(await jsonBody(request));
    if (!(await authAllowed(input.email, "signup")))
      return failure("Too many attempts. Try again in 15 minutes.", 429);
    const passwordHash = await hashPassword(input.password);
    const recoveryCode = issueToken();
    const client = await db.connect();
    let userId: string;
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(741383)");
      const invitation = await client.query(
        `UPDATE invitations SET consumed_at=now() WHERE email=$1 AND token_hash=$2 AND consumed_at IS NULL AND expires_at>now() RETURNING id`,
        [input.email, tokenHash(input.invitation)],
      );
      if (!invitation.rowCount) {
        await client.query("ROLLBACK");
        return failure("Invitation is invalid, expired, or already used.", 400);
      }
      const count = await client.query<{ count: string }>(
        "SELECT count(*) FROM households WHERE NOT is_demo",
      );
      if (Number(count.rows[0].count) >= householdLimit()) {
        await client.query("ROLLBACK");
        return failure("The household pilot is currently full.", 409);
      }
      const result = await client.query<{ id: string }>(
        "INSERT INTO users(email,password_hash,recovery_hash) VALUES($1,$2,$3) RETURNING id",
        [input.email, passwordHash, tokenHash(recoveryCode)],
      );
      userId = result.rows[0].id;
      await client.query("INSERT INTO households(owner_id) VALUES($1)", [
        userId,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        error.code === "23505"
      )
        return failure("Email already registered", 409);
      throw error;
    } finally {
      client.release();
    }
    await startSession(userId);
    return NextResponse.json(
      { ok: true, recoveryCode },
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
