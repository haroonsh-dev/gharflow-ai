import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { saveEvidence, type EvidenceKind } from "@/lib/storage";
import { extractSaved } from "@/lib/ocr";

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
      const {fields,extraction}=await extractSaved(person.householdId,saved,file.name);
      return NextResponse.json({ evidenceFileId: saved.id, extraction, fields, ocrStatus: "extracted", verifiedFormat: false });
    } catch (error) {
      console.warn("OCR unavailable", error);
      return NextResponse.json({ evidenceFileId: saved.id, extraction:null, fields: {}, ocrStatus: "failed", verifiedFormat: false });
    }
  } catch (error) {
    if (error instanceof Error && /File size|Upload a/.test(error.message)) return failure(error.message, 400);
    return errorResponse(error);
  }
}
