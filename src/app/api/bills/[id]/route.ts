import { NextResponse } from "next/server";
import { z } from "zod";
import { guard, errorResponse, failure } from "@/lib/http";
import { billSchema } from "@/lib/schemas";
import { rows } from "@/lib/db";
import { removeUnusedEvidence } from "@/lib/storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const id = z.uuid().parse((await context.params).id);
    const input = billSchema.parse(await request.json());
    if (input.evidenceFileId) {
      const evidence = await rows(`SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='bill'`, [input.evidenceFileId, person.householdId]);
      if (!evidence[0]) return failure("Bill evidence not found", 404);
    }
    const updated = await rows<{ id: string }>(`UPDATE bills SET evidence_file_id=$3,reference_number=$4,bill_month=$5,previous_reading=$6,current_reading=$7,multiplier=$8,billed_units=$9,total_amount=$10,due_date=$11,field_sources=$12,ocr_status=$13 WHERE id=$1 AND household_id=$2 RETURNING id`, [id, person.householdId, input.evidenceFileId ?? null, input.referenceNumber, input.billMonth, input.previousReading, input.currentReading, input.multiplier, input.billedUnits, input.totalAmount, input.dueDate, JSON.stringify(input.fieldSources), input.ocrStatus]);
    return updated[0] ? NextResponse.json({ id }) : failure("Bill not found", 404);
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request, context: Context) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const id = z.uuid().parse((await context.params).id);
    const evidence = await rows<{ id: string }>(`SELECT evidence_file_id AS id FROM bills WHERE id=$1 AND household_id=$2 AND evidence_file_id IS NOT NULL
      UNION SELECT evidence_file_id AS id FROM payments WHERE bill_id=$1 AND household_id=$2 AND evidence_file_id IS NOT NULL`, [id, person.householdId]);
    const deleted = await rows<{ id: string }>(`DELETE FROM bills WHERE id=$1 AND household_id=$2 RETURNING id`, [id, person.householdId]);
    if (!deleted[0]) return failure("Bill not found", 404);
    for (const file of evidence) await removeUnusedEvidence(person.householdId, file.id);
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
