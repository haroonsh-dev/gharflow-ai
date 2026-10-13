import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, errorResponse, failure } from "@/lib/http";
import { identity } from "@/lib/auth";
import { processEvidence } from "@/lib/ocr";
import { rows } from "@/lib/db";
import { allowed } from "@/lib/rate-limit";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const id = z.uuid().parse((await context.params).id);
    if (!(await allowed(`ocr:${person.householdId}`, 30, 3600)))
      return failure(
        "Processing limit reached. Use manual entry or try later.",
        429,
      );
    const result = await processEvidence(person.householdId, id);
    return result
      ? NextResponse.json(result)
      : failure("Bill document not found", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function GET(_request: Request, context: Context) {
  try {
    const person = await identity();
    if (!person) return failure("Sign in required", 401);
    const id = z.uuid().parse((await context.params).id);
    const files = await rows<{
      ocr_state: string;
      ocr_result: unknown;
      processing_started_at: Date | null;
    }>(
      "SELECT ocr_state,ocr_result,processing_started_at FROM evidence_files WHERE id=$1 AND household_id=$2 AND NOT deleting",
      [id, person.householdId],
    );
    if (!files[0]) return failure("File not found", 404);
    return NextResponse.json(files[0], {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
