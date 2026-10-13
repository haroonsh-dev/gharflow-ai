import { jsonBody } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, errorResponse, failure } from "@/lib/http";
import { billSchema } from "@/lib/schemas";
import { saveBill, deleteBill, InputError } from "@/lib/bills";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const id = z.uuid().parse((await context.params).id);
    await saveBill(person, billSchema.parse(await jsonBody(request)), id);
    return NextResponse.json({ id });
  } catch (error) {
    return error instanceof InputError
      ? failure(error.message, error.status)
      : errorResponse(error);
  }
}
export async function DELETE(request: Request, context: Context) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    await deleteBill(person, z.uuid().parse((await context.params).id));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return error instanceof InputError
      ? failure(error.message, error.status)
      : errorResponse(error);
  }
}
