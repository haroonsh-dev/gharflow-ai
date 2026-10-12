import { NextResponse } from "next/server";
import { endSession, sameOrigin } from "@/lib/auth";
import { failure } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(request: Request) {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  await endSession();
  return NextResponse.json({ ok: true });
}
