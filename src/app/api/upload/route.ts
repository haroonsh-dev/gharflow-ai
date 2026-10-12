import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { saveEvidence, type EvidenceKind } from "@/lib/storage";
import { z } from "zod";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const form = await request.formData();
    const file = form.get("file");
    const kind = form.get("kind");
    if (!(file instanceof File) || !["bill", "receipt", "reading"].includes(String(kind))) return failure("File and kind are required", 400);
    const saved = await saveEvidence(person.householdId, kind as EvidenceKind, file);
    if (kind !== "bill") return NextResponse.json({ evidenceFileId: saved.id });
    try {
      const body = new FormData();
      body.set("file", new Blob([Uint8Array.from(saved.bytes)], { type: saved.mime }), file.name);
      const response = await fetch(`${process.env.OCR_URL ?? "http://ocr:8000"}/extract`, { method: "POST", headers: { "x-internal-token": process.env.OCR_INTERNAL_TOKEN ?? "" }, body, signal: AbortSignal.timeout(30000) });
      if (!response.ok) throw new Error(`OCR returned ${response.status}`);
      const result = z.object({ fields: z.record(z.string(), z.string().max(100)) }).parse(await response.json());
      return NextResponse.json({ evidenceFileId: saved.id, fields: result.fields, ocrStatus: "extracted", verifiedFormat: false });
    } catch (error) {
      console.warn("OCR unavailable", error);
      return NextResponse.json({ evidenceFileId: saved.id, fields: {}, ocrStatus: "failed", verifiedFormat: false });
    }
  } catch (error) {
    if (error instanceof Error && /File size|Upload a/.test(error.message)) return failure(error.message, 400);
    return errorResponse(error);
  }
}
