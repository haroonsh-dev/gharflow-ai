import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { jsonBody } from "@/lib/request-body";
import { aiInvestigationRequestSchema } from "@/lib/schemas";
import { overview } from "@/lib/overview";
import { allowed } from "@/lib/rate-limit";
import {
  AIProviderError,
  investigateWithAI,
  type AIEvidenceSource,
} from "@/lib/ai-investigation";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const input = aiInvestigationRequestSchema.parse(
      await jsonBody(request, 4096),
    );
    if (!(await allowed("ai-investigation:global", 300, 3600)))
      return failure("AI investigation is busy. Try again later.", 429);
    if (!(await allowed(`ai-investigation:${person.householdId}`, 8, 3600)))
      return failure(
        "AI investigation limit reached. Try again in an hour.",
        429,
      );

    const data = await overview(person);
    const finding = data.findings.find(
      (candidate) => candidate.id === input.findingId,
    );
    if (!finding) return failure("Finding is no longer available", 404);
    const bill = data.bills.find(
      (candidate) => candidate.id === finding.billId,
    );
    if (!bill) return failure("Bill record is no longer available", 404);

    const connectionBills = data.bills
      .filter(
        (candidate) =>
          candidate.referenceNumber === bill.referenceNumber &&
          (!candidate.supersededById ||
            [finding.billId, ...finding.relatedBillIds].includes(candidate.id)),
      )
      .sort((a, b) => a.billMonth.localeCompare(b.billMonth))
      .slice(-24);
    const includedBillIds = new Set([
      ...connectionBills.map((candidate) => candidate.id),
      finding.billId,
      ...finding.relatedBillIds,
    ]);
    const privateIdentifiers = [
      bill.referenceNumber,
      ...data.bills
        .filter((candidate) => includedBillIds.has(candidate.id))
        .map((candidate) => candidate.meterIdentity)
        .filter((value): value is string => !!value),
      person.email,
    ];
    const normalizedQuestion = input.question.toLowerCase();
    const compactQuestion = normalizedQuestion.replace(/[^a-z0-9]/g, "");
    if (
      privateIdentifiers.some((value) => {
        const normalized = value.toLowerCase();
        const compact = normalized.replace(/[^a-z0-9]/g, "");
        return (
          (normalized.length >= 4 && normalizedQuestion.includes(normalized)) ||
          (compact.length >= 8 && compactQuestion.includes(compact))
        );
      })
    )
      return failure(
        "Remove your connection number, meter serial, or email from the question before sending it.",
        400,
      );
    const redactIdentifiers = (text: string) =>
      privateIdentifiers.reduce(
        (safe, value) => safe.split(value).join("[private identifier]"),
        text,
      );
    const sourceMap: AIEvidenceSource[] = [];
    const bills = [...includedBillIds]
      .map((id) => data.bills.find((candidate) => candidate.id === id))
      .filter(
        (candidate): candidate is (typeof data.bills)[number] => !!candidate,
      )
      .sort((a, b) => a.billMonth.localeCompare(b.billMonth))
      .map((record, index) => {
        const id = `B${index + 1}`;
        sourceMap.push({
          id,
          label: `Bill · ${record.billMonth.slice(0, 7)}`,
          kind: "bill",
          recordId: record.id,
          billId: record.id,
        });
        return {
          sourceId: id,
          month: record.billMonth.slice(0, 7),
          previousReading: record.previousReading,
          currentReading: record.currentReading,
          multiplier: record.multiplier,
          billedKwh: record.billedUnits,
          totalPkr: record.totalAmount,
          readingDate: record.readingDate,
          readingStatus: record.readingStatus,
          meterType: record.meterType,
          hasOriginalDocument: !!record.evidenceFileId,
          confirmedByHousehold: !!record.confirmedAt,
          ocrFieldCount: Object.values(record.fieldSources).filter(
            (source) => source === "ocr",
          ).length,
          userConfirmedFieldCount: Object.values(record.fieldSources).filter(
            (source) => source === "user",
          ).length,
        };
      });
    const recordIdToSource = new Map(
      sourceMap
        .filter((source) => source.kind === "bill")
        .map((source) => [source.recordId, source.id]),
    );
    const payments = data.payments
      .filter((payment) => includedBillIds.has(payment.billId))
      .slice(0, 60)
      .map((record, index) => {
        const id = `P${index + 1}`;
        const billSource = recordIdToSource.get(record.billId);
        sourceMap.push({
          id,
          label: `Entered receipt · ${record.paidAt.slice(0, 10)}`,
          kind: "payment",
          recordId: record.id,
          billId: record.billId,
        });
        return {
          sourceId: id,
          billSource,
          date: record.paidAt.slice(0, 10),
          amountPkr: record.amount,
        };
      });
    const meterIdentities = new Set(
      connectionBills.map((record) => record.meterIdentity).filter(Boolean),
    );
    const readings = data.readings
      .filter(
        (record) =>
          record.referenceNumber === bill.referenceNumber ||
          (!record.referenceNumber &&
            !!record.meterIdentity &&
            meterIdentities.has(record.meterIdentity)),
      )
      .slice(0, 60)
      .map((record, index) => {
        const id = `R${index + 1}`;
        sourceMap.push({
          id,
          label: `Meter observation · ${record.readingDate}`,
          kind: "reading",
          recordId: record.id,
          billId: bill.id,
        });
        return {
          sourceId: id,
          date: record.readingDate,
          value: record.readingValue,
          multiplier: record.multiplier,
          meterType: record.meterType,
        };
      });
    const billSource = sourceMap.find(
      (source) => source.recordId === bill.id,
    )?.id;
    const findingContext = {
      title: finding.title,
      category: finding.code ?? finding.id.split(":").at(-1),
      details: redactIdentifiers(finding.detail),
      evidence: finding.evidence.map(redactIdentifiers),
      missing: finding.missing,
      ruleVersion: finding.ruleVersion,
      subjectSourceId: billSource,
      relatedSourceIds: finding.relatedBillIds
        .map((id) => recordIdToSource.get(id))
        .filter(Boolean),
      relatedChecks: data.findings
        .filter((candidate) => includedBillIds.has(candidate.billId))
        .slice(0, 40)
        .map((candidate) => ({
          billSourceId: recordIdToSource.get(candidate.billId),
          category: candidate.code,
          title: candidate.title,
          details: redactIdentifiers(candidate.detail),
          evidence: candidate.evidence.map(redactIdentifiers),
          missing: candidate.missing,
        })),
    };
    const response = await investigateWithAI({
      question: input.question,
      finding: findingContext,
      records: { bills, payments, readings },
    });
    const validSources = new Set(sourceMap.map((source) => source.id));
    return NextResponse.json(
      {
        answer: {
          ...response,
          evidence: response.evidence.filter((item) =>
            validSources.has(item.sourceId),
          ),
          alternatives: response.alternatives.map((item) => ({
            ...item,
            sourceIds: item.sourceIds.filter((id) => validSources.has(id)),
          })),
        },
        sources: sourceMap,
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return error instanceof AIProviderError
      ? failure(error.message, error.status)
      : errorResponse(error);
  }
}
