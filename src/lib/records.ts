import type { z } from "zod";
import type { PoolClient } from "pg";
import { householdTransaction, HouseholdError } from "./household-transaction";
import { meterSchema, paymentSchema } from "./schemas";
export type RecordKind = "reading" | "payment";
const tables = { reading: "meter_readings", payment: "payments" } as const;
async function evidence(
  client: PoolClient,
  household: string,
  id: string | null | undefined,
  kind: "reading" | "receipt",
) {
  if (!id) return;
  if (
    !(
      await client.query(
        "SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind=$3 AND NOT deleting",
        [id, household, kind],
      )
    ).rowCount
  )
    throw new HouseholdError("Evidence not found", 404);
}
async function revise(
  household: string,
  kind: RecordKind,
  id: string,
  revision: number,
  update?: (client: PoolClient) => Promise<void>,
) {
  return householdTransaction(household, async (client) => {
    const found = await client.query<
      Record<string, unknown> & { revision: number }
    >(
      `SELECT * FROM ${tables[kind]} WHERE id=$1 AND household_id=$2 FOR UPDATE`,
      [id, household],
    );
    const before = found.rows[0];
    if (!before) throw new HouseholdError("Record not found", 404);
    if (before.revision !== revision)
      throw new HouseholdError(
        "This record changed in another session. Reload the list before trying again.",
        409,
      );
    let after: Record<string, unknown> | null = null;
    if (update) {
      await update(client);
      after = (
        await client.query(
          `SELECT * FROM ${tables[kind]} WHERE id=$1 AND household_id=$2`,
          [id, household],
        )
      ).rows[0] as Record<string, unknown>;
    } else
      await client.query(
        `DELETE FROM ${tables[kind]} WHERE id=$1 AND household_id=$2`,
        [id, household],
      );
    await client.query(
      "INSERT INTO record_changes(household_id,record_kind,record_id,action,before_record,after_record) VALUES($1,$2,$3,$4,$5,$6)",
      [
        household,
        kind,
        id,
        update ? "updated" : "deleted",
        JSON.stringify(before),
        after ? JSON.stringify(after) : null,
      ],
    );
    return { revision: update ? revision + 1 : revision };
  });
}
export function updateReading(
  household: string,
  id: string,
  input: z.infer<typeof meterSchema>,
  revision: number,
) {
  return revise(household, "reading", id, revision, async (client) => {
    await evidence(client, household, input.evidenceFileId, "reading");
    await client.query(
      "UPDATE meter_readings SET reference_number=$3,meter_identity=$4,reading_date=$5,reading_value=$6,multiplier=$7,meter_type=$8,note=$9,evidence_file_id=$10,revision=revision+1 WHERE id=$1 AND household_id=$2",
      [
        id,
        household,
        input.referenceNumber,
        input.meterIdentity,
        input.readingDate,
        input.readingValue,
        input.multiplier,
        input.meterType,
        input.note,
        input.evidenceFileId ?? null,
      ],
    );
  });
}
export function updatePayment(
  household: string,
  id: string,
  input: z.infer<typeof paymentSchema>,
  revision: number,
) {
  return revise(household, "payment", id, revision, async (client) => {
    if (
      !(
        await client.query(
          "SELECT id FROM bills WHERE id=$1 AND household_id=$2",
          [input.billId, household],
        )
      ).rowCount
    )
      throw new HouseholdError("Bill not found", 404);
    await evidence(client, household, input.evidenceFileId, "receipt");
    await client.query(
      "UPDATE payments SET bill_id=$3,amount=$4,paid_at=$5,channel=$6,reference=$7,evidence_file_id=$8,revision=revision+1 WHERE id=$1 AND household_id=$2",
      [
        id,
        household,
        input.billId,
        input.amount,
        input.paidAt,
        input.channel,
        input.reference,
        input.evidenceFileId ?? null,
      ],
    );
  });
}
export const deleteRecord = (
  household: string,
  kind: RecordKind,
  id: string,
  revision: number,
) => revise(household, kind, id, revision);
