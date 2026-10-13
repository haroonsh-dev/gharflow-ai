import type { BillRecord, Finding, ReadingRecord } from "./findings";
import type { Extraction } from "./schemas";
export type Bill = BillRecord & { evidenceFileId: string | null; fieldSources: Record<string,"ocr"|"user">; ocrStatus: "manual"|"failed"|"extracted"; corrections: Record<string,{ extracted: string; confirmed: string }>; confirmedAt: string | null; extraction: Extraction | null };
export type Reading = ReadingRecord & { note: string; evidenceFileId: string | null };
export type Payment = { id: string; billId: string; evidenceFileId: string | null; amount: number; paidAt: string; channel: string; reference: string };
export type Evidence = { id: string; kind: string; name: string };
export type CaseSnapshot = { ruleVersion: string; capturedAt: string; finding: Finding; bills: Bill[]; readings: Reading[]; payments: Payment[]; documents: Evidence[]; isDemo: boolean };
export type CaseRecord = { id: string; billId: string | null; status: "open"|"awaiting_response"|"resolved"|"dismissed"; snapshot: CaseSnapshot; evidenceIds: string[]; notes: string; outcome: string; createdAt: string; updatedAt: string };
export type Overview = { email: string; isDemo: boolean; bills: Bill[]; payments: Payment[]; readings: Reading[]; findings: Finding[]; cases: CaseRecord[]; evidence: Evidence[] };
