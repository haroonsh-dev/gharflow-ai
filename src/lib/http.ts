import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { identity, sameOrigin, type Identity } from "@/lib/auth";

export const failure = (message: string, status: number) => NextResponse.json({ error: message }, { status });

export async function guard(request: Request): Promise<Identity | NextResponse> {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  const person = await identity();
  return person ?? failure("Sign in required", 401);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) return failure(error.issues[0]?.message ?? "Invalid input", 400);
  console.error("Request failed", error);
  return failure("Request could not be completed", 500);
}
