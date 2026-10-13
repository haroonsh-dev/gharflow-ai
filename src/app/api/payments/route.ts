import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { paymentSchema } from "@/lib/schemas";
import { jsonBody } from "@/lib/request-body";
import {
  householdTransaction,
  HouseholdError,
} from "@/lib/household-transaction";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const input = paymentSchema.parse(await jsonBody(request));
    const id = await householdTransaction(
      person.householdId,
      async (client) => {
        const bill = await client.query(
          "SELECT id FROM bills WHERE id=$1 AND household_id=$2",
          [input.billId, person.householdId],
        );
        if (!bill.rows[0]) throw new HouseholdError("Bill not found", 404);
        if (input.evidenceFileId) {
          const evidence = await client.query(
            "SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='receipt' AND NOT deleting",
            [input.evidenceFileId, person.householdId],
          );
          if (!evidence.rows[0])
            throw new HouseholdError("Receipt not found", 404);
        }
        const saved = await client.query<{ id: string }>(
          "INSERT INTO payments(household_id,bill_id,evidence_file_id,amount,paid_at,channel,reference) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
          [
            person.householdId,
            input.billId,
            input.evidenceFileId ?? null,
            input.amount,
            input.paidAt,
            input.channel,
            input.reference,
          ],
        );
        return saved.rows[0].id;
      },
    );
    return NextResponse.json({ id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
