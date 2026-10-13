import { NextResponse } from "next/server";
import { z } from "zod";
import { identity } from "@/lib/auth";
import { guard, errorResponse, failure } from "@/lib/http";
import { caseUpdateSchema } from "@/lib/schemas";
import { overview } from "@/lib/overview";
import { householdTransaction } from "@/lib/household-transaction";
import { jsonBody } from "@/lib/request-body";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function GET(_request: Request, context: Context) {
  try {
    const person = await identity();
    if (!person) return failure("Sign in required", 401);
    const id = z.uuid().parse((await context.params).id);
    const item = (await overview(person)).cases.find((item) => item.id === id);
    return item
      ? NextResponse.json(item, {
          headers: { "Cache-Control": "private, no-store" },
        })
      : failure("Case not found", 404);
  } catch (error) {
    return errorResponse(error);
  }
}
export async function PATCH(request: Request, context: Context) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const id = z.uuid().parse((await context.params).id);
    const input = caseUpdateSchema.parse(await jsonBody(request, 65536));
    return await householdTransaction(person.householdId, async (client) => {
      const data = await overview(person, client);
      const item = data.cases.find((item) => item.id === id);
      if (!item) return failure("Case not found", 404);
      if (
        ["resolved", "dismissed"].includes(input.status) &&
        !input.outcome.trim()
      )
        return failure(
          "Describe the user-reported outcome before closing this case",
          400,
        );
      const capturedIds = new Set(
        item.snapshot.documents.map((document) => document.id),
      );
      if (input.evidenceIds.filter((id) => !capturedIds.has(id)).length > 20)
        return failure("Attach at most 20 additional documents", 400);
      const evidenceIds = [
        ...new Set([
          ...item.snapshot.documents.map((document) => document.id),
          ...input.evidenceIds,
        ]),
      ];
      if (
        evidenceIds.some(
          (id) => !data.evidence.some((evidence) => evidence.id === id),
        )
      )
        return failure("Evidence not found", 404);
      await client.query(
        "UPDATE cases SET status=$3,notes=$4,outcome=$5,evidence_ids=$6,checklist=$7,updated_at=now() WHERE id=$1 AND household_id=$2",
        [
          id,
          person.householdId,
          input.status,
          input.notes,
          input.outcome,
          evidenceIds,
          JSON.stringify(input.checklist ?? item.checklist),
        ],
      );
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    return errorResponse(error);
  }
}
