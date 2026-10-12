import { NextResponse } from "next/server";
import { verify } from "argon2";
import { credentialsSchema } from "@/lib/schemas";
import { rows } from "@/lib/db";
import { sameOrigin, startSession } from "@/lib/auth";
import { errorResponse, failure } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  try {
    const input = credentialsSchema.parse(await request.json());
    const found = await rows<{ id: string; password_hash: string }>(`SELECT id,password_hash FROM users WHERE email=$1`, [input.email]);
    if (!found[0] || !(await verify(found[0].password_hash, input.password))) return failure("Invalid credentials", 401);
    await startSession(found[0].id);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
