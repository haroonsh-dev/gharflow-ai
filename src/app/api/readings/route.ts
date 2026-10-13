import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { meterSchema } from "@/lib/schemas";
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
    const input = meterSchema.parse(await jsonBody(request));
    const id = await householdTransaction(
      person.householdId,
      async (client) => {
        if (input.evidenceFileId) {
          const evidence = await client.query(
            "SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='reading' AND NOT deleting",
            [input.evidenceFileId, person.householdId],
          );
          if (!evidence.rows[0])
            throw new HouseholdError("Reading evidence not found", 404);
        }
        const saved = await client.query<{ id: string }>(
          `INSERT INTO meter_readings(household_id,reference_number,meter_identity,reading_date,reading_value,multiplier,note,evidence_file_id,meter_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
          [
            person.householdId,
            input.referenceNumber,
            input.meterIdentity,
            input.readingDate,
            input.readingValue,
            input.multiplier,
            input.note,
            input.evidenceFileId ?? null,
            input.meterType,
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
