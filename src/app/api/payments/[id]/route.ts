import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, errorResponse } from "@/lib/http";
import { jsonBody } from "@/lib/request-body";
import { paymentSchema } from "@/lib/schemas";
import { updatePayment, deleteRecord } from "@/lib/records";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const revisionSchema = z.object({ revision: z.number().int().positive() });
export async function PATCH(request: Request, context: Context) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const id = z.uuid().parse((await context.params).id);
    const input = paymentSchema
      .extend({ revision: revisionSchema.shape.revision })
      .parse(await jsonBody(request));
    return NextResponse.json(
      await updatePayment(person.householdId, id, input, input.revision),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const id = z.uuid().parse((await context.params).id);
    const { revision } = revisionSchema.parse(await jsonBody(request));
    await deleteRecord(person.householdId, "payment", id, revision);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
