import { rows } from "./db";
import { analyze } from "./findings";
import { storageLimit } from "./config";
import { extractionSchema, checklistSchema } from "./schemas";
import type {
  Bill,
  CaseRecord,
  CaseSnapshot,
  Overview,
  Payment,
  Reading,
} from "./types";
import type { Identity } from "./auth";
import type { PoolClient, QueryResultRow } from "pg";
export async function overview(
  person: Identity,
  client?: PoolClient,
): Promise<Overview> {
  const read = client
    ? async <T extends QueryResultRow>(sql: string, values: unknown[] = []) =>
        (await client.query<T>(sql, values)).rows
    : rows;
  const [
    billRows,
    paymentRows,
    readingRows,
    caseRows,
    evidenceRows,
    household,
  ] = await Promise.all([
    read<{
      id: string;
      reference_number: string;
      bill_month: string;
      previous_reading: string | null;
      current_reading: string | null;
      multiplier: string;
      billed_units: string | null;
      total_amount: string;
      due_date: string | null;
      evidence_file_id: string | null;
      field_sources: Bill["fieldSources"];
      ocr_status: Bill["ocrStatus"];
      meter_identity: string | null;
      reading_date: string | null;
      reading_status: Bill["readingStatus"];
      meter_type: Bill["meterType"];
      superseded_by_id: string | null;
      corrections: Bill["corrections"];
      confirmed_at: string | null;
      ocr_result: unknown;
    }>(
      `SELECT b.*,b.bill_month::text,b.due_date::text,b.reading_date::text,b.confirmed_at::text,e.ocr_result FROM bills b LEFT JOIN evidence_files e ON b.evidence_file_id=e.id WHERE b.household_id=$1 ORDER BY b.bill_month DESC,b.created_at DESC`,
      [person.householdId],
    ),
    read<{
      id: string;
      bill_id: string;
      revision: number;
      amount: string;
      paid_at: string;
      channel: string;
      reference: string;
      evidence_file_id: string | null;
    }>(
      `SELECT p.*,p.paid_at::text FROM payments p WHERE p.household_id=$1 ORDER BY p.paid_at DESC`,
      [person.householdId],
    ),
    read<{
      id: string;
      reference_number: string | null;
      meter_identity: string | null;
      reading_date: string;
      reading_value: string;
      revision: number;
      multiplier: string;
      meter_type: Reading["meterType"];
      note: string;
      evidence_file_id: string | null;
    }>(
      `SELECT m.*,m.reading_date::text FROM meter_readings m WHERE m.household_id=$1 ORDER BY m.reading_date DESC`,
      [person.householdId],
    ),
    read<{
      id: string;
      bill_id: string | null;
      status: CaseRecord["status"];
      snapshot: CaseSnapshot;
      checklist: unknown;
      evidence_ids: string[];
      notes: string;
      outcome: string;
      created_at: string;
      updated_at: string;
    }>(
      `SELECT c.*,c.created_at::text,c.updated_at::text FROM cases c WHERE c.household_id=$1 ORDER BY c.created_at DESC`,
      [person.householdId],
    ),
    read<{
      id: string;
      kind: string;
      original_name: string;
      ocr_result: unknown;
      ocr_state: "pending" | "processing" | "extracted" | "failed";
      unattached: boolean;
      bytes: number;
    }>(
      `SELECT e.id,e.kind,e.original_name,e.ocr_state,e.ocr_result,e.byte_size+e.preview_bytes AS bytes, NOT EXISTS(SELECT 1 FROM bills WHERE evidence_file_id=e.id) AND NOT EXISTS(SELECT 1 FROM payments WHERE evidence_file_id=e.id) AND NOT EXISTS(SELECT 1 FROM meter_readings WHERE evidence_file_id=e.id) AND NOT EXISTS(SELECT 1 FROM cases WHERE e.id=ANY(evidence_ids)) AS unattached FROM evidence_files e WHERE household_id=$1 AND NOT e.deleting ORDER BY created_at DESC`,
      [person.householdId],
    ),
    read<{ is_demo: boolean }>(`SELECT is_demo FROM households WHERE id=$1`, [
      person.householdId,
    ]),
  ]);
  const bills: Bill[] = billRows.map((r) => ({
    id: r.id,
    referenceNumber: r.reference_number,
    billMonth: r.bill_month,
    previousReading:
      r.previous_reading === null ? null : Number(r.previous_reading),
    currentReading:
      r.current_reading === null ? null : Number(r.current_reading),
    multiplier: Number(r.multiplier),
    billedUnits: r.billed_units === null ? null : Number(r.billed_units),
    totalAmount: Number(r.total_amount),
    dueDate: r.due_date,
    evidenceFileId: r.evidence_file_id,
    fieldSources: r.field_sources,
    ocrStatus: r.ocr_status,
    meterIdentity: r.meter_identity,
    readingDate: r.reading_date,
    readingStatus: r.reading_status,
    meterType: r.meter_type,
    supersededById: r.superseded_by_id,
    corrections: r.corrections,
    confirmedAt: r.confirmed_at,
    extraction: extractionSchema.safeParse(r.ocr_result).success
      ? extractionSchema.parse(r.ocr_result)
      : null,
  }));
  const payments: Payment[] = paymentRows.map((r) => ({
    id: r.id,
    billId: r.bill_id,
    revision: r.revision,
    amount: Number(r.amount),
    paidAt: r.paid_at,
    channel: r.channel,
    reference: r.reference,
    evidenceFileId: r.evidence_file_id,
  }));
  const readings: Reading[] = readingRows.map((r) => ({
    id: r.id,
    referenceNumber: r.reference_number,
    meterIdentity: r.meter_identity,
    readingDate: r.reading_date,
    readingValue: Number(r.reading_value),
    revision: r.revision,
    multiplier: Number(r.multiplier),
    meterType: r.meter_type,
    note: r.note,
    evidenceFileId: r.evidence_file_id,
  }));
  const cases: CaseRecord[] = caseRows.map((r) => ({
    checklist: checklistSchema.parse(r.checklist ?? {}),
    id: r.id,
    billId: r.bill_id,
    status: r.status,
    snapshot: r.snapshot,
    evidenceIds: r.evidence_ids,
    notes: r.notes,
    outcome: r.outcome,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
  return {
    deleting: !!person.deleting,
    storageBytes: evidenceRows.reduce((sum, row) => sum + row.bytes, 0),
    storageLimit: storageLimit(),
    email: person.email,
    isDemo: household[0]?.is_demo ?? false,
    bills,
    payments,
    readings,
    cases,
    evidence: evidenceRows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.original_name,
      extraction: extractionSchema.safeParse(r.ocr_result).success
        ? extractionSchema.parse(r.ocr_result)
        : null,
      ocrState: r.ocr_state,
      unattached: r.unattached,
    })),
    findings: analyze(bills, payments, readings),
  };
}
