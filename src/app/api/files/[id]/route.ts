import { NextResponse } from "next/server";
import { z } from "zod";
import { identity } from "@/lib/auth";
import { loadEvidence, removeUnusedEvidence } from "@/lib/storage";
import { guard } from "@/lib/http";
import { errorResponse, failure } from "@/lib/http";

export const runtime = "nodejs";
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const person = await identity();
    if (!person) return failure("Sign in required", 401);
    const id = z.uuid().parse((await context.params).id);
    const url=new URL(_request.url);
    const page=url.searchParams.has("preview")?z.coerce.number().int().min(1).max(2).parse(url.searchParams.get("preview")):undefined;
    const evidence = await loadEvidence(person.householdId, id, page);
    if (!evidence) return failure("File not found", 404);
    return new NextResponse(new Uint8Array(evidence.data), { headers: { "Content-Type": evidence.mime, "Content-Disposition": `${url.searchParams.has("inline")||page ? "inline" : "attachment"}; filename="evidence.${evidence.mime === "application/pdf" ? "pdf" : evidence.mime === "image/png" ? "png" : "jpg"}"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy":"sandbox", "X-Frame-Options":"SAMEORIGIN" } });
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const id = z.uuid().parse((await context.params).id);
    return await removeUnusedEvidence(person.householdId, id) ? NextResponse.json({ ok: true }) : failure("File not found or still attached", 404);
  } catch (error) { return errorResponse(error); }
}
