import { jsonBody } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/password";
import { sameOrigin } from "@/lib/auth";
import { recoverySchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { authAllowed } from "@/lib/rate-limit";
import { issueToken, tokenHash } from "@/lib/tokens";
import { errorResponse, failure } from "@/lib/http";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  try {
    const input = recoverySchema.parse(await jsonBody(request));
    if (!(await authAllowed(input.email, "recover")))
      return failure("Too many attempts. Try again in 15 minutes.", 429);
    const passwordHash = await hashPassword(input.password);
    const recoveryCode = issueToken();
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<{ id: string }>(
        "UPDATE users SET password_hash=$3,recovery_hash=$4 WHERE email=$1 AND recovery_hash=$2 RETURNING id",
        [
          input.email,
          tokenHash(input.recoveryCode),
          passwordHash,
          tokenHash(recoveryCode),
        ],
      );
      if (!found.rows[0]) {
        await client.query("ROLLBACK");
        return failure("Email or recovery code is incorrect.", 400);
      }
      await client.query("DELETE FROM sessions WHERE user_id=$1", [
        found.rows[0].id,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    return NextResponse.json(
      { ok: true, recoveryCode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
