import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { billSchema } from "@/lib/schemas";
import { rows } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const input = billSchema.parse(await request.json());
    if (input.evidenceFileId) {
      const evidence = await rows(`SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='bill'`, [input.evidenceFileId, person.householdId]);
      if (!evidence[0]) return failure("Bill evidence not found", 404);
    }
    const saved = await rows<{ id: string }>(`INSERT INTO bills (household_id,evidence_file_id,reference_number,bill_month,previous_reading,current_reading,multiplier,billed_units,total_amount,due_date,field_sources,ocr_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING id`, [person.householdId, input.evidenceFileId ?? null, input.referenceNumber, input.billMonth, input.previousReading, input.currentReading, input.multiplier, input.billedUnits, input.totalAmount, input.dueDate, JSON.stringify(input.fieldSources), input.ocrStatus]);
    return NextResponse.json({ id: saved[0].id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
