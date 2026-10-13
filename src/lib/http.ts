import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { identity, sameOrigin, type Identity } from "@/lib/auth";

export const failure = (message: string, status: number) =>
  NextResponse.json({ error: message }, { status });

export async function guard(
  request: Request,
  allowDeleting = false,
): Promise<Identity | NextResponse> {
  if (!sameOrigin(request)) return failure("Invalid request origin", 403);
  const person = await identity();
  if (person?.deleting && !allowDeleting)
    return failure(
      "Account deletion is pending. Retry deletion from Settings.",
      409,
    );
  return person ?? failure("Sign in required", 401);
}

export function errorResponse(error: unknown): NextResponse {
  if (error instanceof SyntaxError)
    return failure("Invalid request payload", 400);
  if (error instanceof ZodError)
    return failure(error.issues[0]?.message ?? "Invalid input", 400);
  if (
    error instanceof Error &&
    "status" in error &&
    typeof error.status === "number"
  )
    return failure(error.message, error.status);
  if (
    error instanceof Error &&
    (("code" in error &&
      [
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ECONNRESET",
        "57P01",
        "57P02",
        "57P03",
      ].includes(String(error.code))) ||
      error.message.startsWith("Connection terminated"))
  )
    return failure(
      "Service temporarily unavailable. Your entered values have been preserved. Try again shortly.",
      503,
    );
  console.error("Request failed", {
    kind: error instanceof Error ? error.name : "unknown",
    code:
      error instanceof Error &&
      "code" in error &&
      typeof error.code === "string" &&
      /^[A-Z0-9_]{1,30}$/.test(error.code)
        ? error.code
        : "unclassified",
  });
  return failure("Request could not be completed", 500);
}
