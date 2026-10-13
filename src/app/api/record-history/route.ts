import { NextResponse } from "next/server";
import { z } from "zod";
import { errorResponse, failure } from "@/lib/http";
import { identity } from "@/lib/auth";
import { rows } from "@/lib/db";
export const runtime = "nodejs";
const fields = {
  reading: {
    reference_number: "Connection reference number",
    meter_identity: "Meter identity / serial",
    reading_date: "Observation date",
    reading_value: "Observed meter reading",
    multiplier: "Multiplier",
    meter_type: "Meter arrangement",
    note: "Note",
    evidence_file_id: "Evidence reference",
  },
  payment: {
    bill_id: "Bill reference",
    amount: "Amount paid (PKR)",
    paid_at: "Payment date",
    channel: "Channel",
    reference: "Transaction reference",
    evidence_file_id: "Evidence reference",
  },
};
export async function GET(request: Request) {
  try {
    const person = await identity();
    if (!person) return failure("Sign in required", 401);
    const url = new URL(request.url),
      kind = z.enum(["reading", "payment"]).parse(url.searchParams.get("kind")),
      id = z.uuid().nullable().parse(url.searchParams.get("id"));
    const history = await rows<{
      id: string;
      record_id: string;
      action: string;
      changed_at: string;
      before_record: Record<string, unknown>;
      after_record: Record<string, unknown> | null;
    }>(
      "SELECT id,record_id,action,changed_at::text,before_record,after_record FROM record_changes WHERE household_id=$1 AND record_kind=$2 AND ($3::uuid IS NULL OR record_id=$3) ORDER BY changed_at DESC,id DESC LIMIT 20",
      [person.householdId, kind, id],
    );
    return NextResponse.json(
      {
        entries: history.map((row) => ({
          id: row.id,
          recordId: row.record_id,
          action: row.action,
          changedAt: row.changed_at,
          changes: Object.entries(fields[kind])
            .filter(
              ([key]) =>
                String(row.before_record[key] ?? "") !==
                String(row.after_record?.[key] ?? ""),
            )
            .map(([key, label]) => ({
              label,
              before: String(row.before_record[key] ?? ""),
              after: row.after_record
                ? String(row.after_record[key] ?? "")
                : null,
            })),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
