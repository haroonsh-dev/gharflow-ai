import { NextResponse } from "next/server";
import { identity } from "@/lib/auth";
import { rows } from "@/lib/db";
import { analyze, type BillRecord, type PaymentRecord } from "@/lib/findings";
import { errorResponse, failure } from "@/lib/http";

export const runtime = "nodejs";
export async function GET() {
  try {
    const person = await identity();
    if (!person) return failure("Sign in required", 401);
    const [billRows, paymentRows, readingRows] = await Promise.all([
      rows<{ id: string; reference_number: string; bill_month: string; previous_reading: string | null; current_reading: string | null; multiplier: string; billed_units: string | null; total_amount: string; due_date: string | null; evidence_file_id: string | null; field_sources: Record<string, "ocr" | "user">; ocr_status: string }>(`SELECT id,reference_number,bill_month::text,previous_reading,current_reading,multiplier,billed_units,total_amount,due_date::text,evidence_file_id,field_sources,ocr_status FROM bills WHERE household_id=$1 ORDER BY bill_month DESC, created_at DESC`, [person.householdId]),
      rows<{ id: string; bill_id: string; amount: string; paid_at: string; channel: string; reference: string; evidence_file_id: string | null }>(`SELECT id,bill_id,amount,paid_at::text,channel,reference,evidence_file_id FROM payments WHERE household_id=$1 ORDER BY paid_at DESC`, [person.householdId]),
      rows<{ id: string; reading_date: string; reading_value: string; note: string }>(`SELECT id,reading_date::text,reading_value,note FROM meter_readings WHERE household_id=$1 ORDER BY reading_date DESC`, [person.householdId]),
    ]);
    const bills: (BillRecord & { evidenceFileId: string | null; fieldSources: Record<string, "ocr" | "user">; ocrStatus: string })[] = billRows.map((row) => ({ id: row.id, referenceNumber: row.reference_number, billMonth: row.bill_month, previousReading: row.previous_reading === null ? null : Number(row.previous_reading), currentReading: row.current_reading === null ? null : Number(row.current_reading), multiplier: Number(row.multiplier), billedUnits: row.billed_units === null ? null : Number(row.billed_units), totalAmount: Number(row.total_amount), dueDate: row.due_date, evidenceFileId: row.evidence_file_id, fieldSources: row.field_sources, ocrStatus: row.ocr_status }));
    const payments = paymentRows.map((row) => ({ id: row.id, billId: row.bill_id, amount: Number(row.amount), paidAt: row.paid_at, channel: row.channel, reference: row.reference, evidenceFileId: row.evidence_file_id }));
    const readings = readingRows.map((row) => ({ id: row.id, readingDate: row.reading_date, readingValue: Number(row.reading_value), note: row.note }));
    return NextResponse.json({ email: person.email, bills, payments, readings, findings: analyze(bills, payments as PaymentRecord[]) });
  } catch (error) { return errorResponse(error); }
}
