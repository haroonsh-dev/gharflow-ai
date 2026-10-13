import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { saveEvidence, MAX_BYTES, type EvidenceKind } from "@/lib/storage";
import { allowed } from "@/lib/rate-limit";
import { boundedBody } from "@/lib/request-body";
export const runtime = "nodejs";
export async function POST(request: Request) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    if (!(await allowed(`upload:${person.householdId}`, 20, 3600)))
      return failure("Upload limit reached. Try again in one hour.", 429);
    const length = Number(request.headers.get("content-length"));
    if (length > MAX_BYTES + 65536)
      return failure("File size must be 1-8 MB", 413);
    const form = await new Response(
      new Uint8Array(await boundedBody(request, MAX_BYTES + 65536)),
      {
        headers: { "Content-Type": request.headers.get("content-type") ?? "" },
      },
    ).formData();
    const file = form.get("file"),
      kind = form.get("kind");
    if (
      !(file instanceof File) ||
      !["bill", "receipt", "reading"].includes(String(kind))
    )
      return failure("File and kind are required", 400);
    const saved = await saveEvidence(
      person.householdId,
      kind as EvidenceKind,
      file,
    );
    return NextResponse.json({
      evidenceFileId: saved.id,
      extraction: null,
      fields: {},
      ocrStatus: kind === "bill" ? "pending" : "not_required",
      verifiedFormat: false,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
