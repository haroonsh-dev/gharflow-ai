import { NextResponse } from "next/server";
import { hash } from "argon2";
import { credentialsSchema } from "@/lib/schemas";
import { db } from "@/lib/db";
import { sameOrigin, startSession } from "@/lib/auth";
import { errorResponse, failure } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  try {
    const input = credentialsSchema.parse(await request.json());
    const client = await db.connect();
    let userId: string;
    try {
      await client.query("BEGIN");
      const result = await client.query<{ id: string }>(`INSERT INTO users (email,password_hash) VALUES ($1,$2) RETURNING id`, [input.email, await hash(input.password)]);
      userId = result.rows[0].id;
      await client.query(`INSERT INTO households (owner_id) VALUES ($1)`, [userId]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") return failure("Email already registered", 409);
      throw error;
    } finally { client.release(); }
    await startSession(userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
