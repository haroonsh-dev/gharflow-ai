import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { paymentSchema } from "@/lib/schemas";
import { rows } from "@/lib/db";

export const runtime = "nodejs";
export async function POST(request: Request) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    const input = paymentSchema.parse(await request.json());
    const bill = await rows(`SELECT id FROM bills WHERE id=$1 AND household_id=$2`, [input.billId, person.householdId]);
    if (!bill[0]) return failure("Bill not found", 404);
    if (input.evidenceFileId) {
      const evidence = await rows(`SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='receipt'`, [input.evidenceFileId, person.householdId]);
      if (!evidence[0]) return failure("Receipt not found", 404);
    }
    const saved = await rows<{ id: string }>(`INSERT INTO payments (household_id,bill_id,evidence_file_id,amount,paid_at,channel,reference) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`, [person.householdId, input.billId, input.evidenceFileId ?? null, input.amount, input.paidAt, input.channel, input.reference]);
    return NextResponse.json({ id: saved[0].id }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}
