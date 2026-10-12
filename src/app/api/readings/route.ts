import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { meterSchema } from "@/lib/schemas";
import { rows } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const input = meterSchema.parse(await request.json());
    const saved = await rows<{ id: string }>(`INSERT INTO meter_readings (household_id,reading_date,reading_value,note) VALUES ($1,$2,$3,$4) RETURNING id`, [person.householdId, input.readingDate, input.readingValue, input.note]);
    return NextResponse.json({ id: saved[0].id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
