import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, errorResponse, failure } from "@/lib/http";
import { jsonBody } from "@/lib/request-body";
import { rows } from "@/lib/db";
import { authAllowed } from "@/lib/rate-limit";
import { verifyPassword } from "@/lib/password";
import { issueToken, tokenHash } from "@/lib/tokens";
export async function POST(request: Request) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const input = z
      .object({ password: z.string().min(12).max(128) })
      .parse(await jsonBody(request));
    if (!(await authAllowed(person.email, "recovery-code")))
      return failure("Too many attempts. Try again in 15 minutes.", 429);
    const users = await rows<{ password_hash: string }>(
      "SELECT password_hash FROM users WHERE id=$1",
      [person.userId],
    );
    if (
      !users[0] ||
      !(await verifyPassword(users[0].password_hash, input.password))
    )
      return failure("Password is incorrect", 401);
    const recoveryCode = issueToken();
    await rows("UPDATE users SET recovery_hash=$2 WHERE id=$1", [
      person.userId,
      tokenHash(recoveryCode),
    ]);
    return NextResponse.json(
      { recoveryCode },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
