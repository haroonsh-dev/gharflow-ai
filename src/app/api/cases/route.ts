import { jsonBody } from "@/lib/request-body";
import { NextResponse } from "next/server";
import { guard, errorResponse, failure } from "@/lib/http";
import { caseCreateSchema } from "@/lib/schemas";
import { overview } from "@/lib/overview";
import { db } from "@/lib/db";
import type { CaseSnapshot } from "@/lib/types";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;
    const input = caseCreateSchema.parse(await jsonBody(request));
    const client = await db.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
        person.householdId,
      ]);
      const household = await client.query<{ deleting: boolean }>(
        "SELECT deleting FROM households WHERE id=$1",
        [person.householdId],
      );
      if (!household.rows[0] || household.rows[0].deleting) {
        await client.query("ROLLBACK");
        return failure("Household unavailable", 409);
      }
      const data = await overview(person, client);
      const finding = data.findings.find(
        (item) => item.id === input.findingId && item.kind === "review",
      );
      if (!finding) {
        await client.query("ROLLBACK");
        return failure("Finding is no longer available for review", 409);
      }
      const existing = data.cases.find(
        (item) =>
          item.snapshot.finding.id === input.findingId &&
          ["open", "awaiting_response"].includes(item.status),
      );
      if (existing) {
        await client.query("COMMIT");
        return NextResponse.json({ id: existing.id });
      }
      const bills = data.bills.filter((bill) =>
        [finding.billId, ...finding.relatedBillIds].includes(bill.id),
      );
      const readings = data.readings.filter((reading) =>
        finding.readingIds.includes(reading.id),
      );
      const payments = data.payments.filter(
        (payment) => payment.billId === finding.billId,
      );
      const evidenceIds = [
        ...new Set(
          [
            ...input.evidenceIds,
            ...bills.map((bill) => bill.evidenceFileId),
            ...readings.map((reading) => reading.evidenceFileId),
            ...payments.map((payment) => payment.evidenceFileId),
          ].filter((id): id is string => !!id),
        ),
      ];
      if (evidenceIds.length > 1000) {
        await client.query("ROLLBACK");
        return failure(
          "Too many source records. Resolve duplicate versions before opening this case.",
          409,
        );
      }
      if (
        evidenceIds.some(
          (id) => !data.evidence.some((evidence) => evidence.id === id),
        )
      ) {
        await client.query("ROLLBACK");
        return failure("Evidence not found", 404);
      }
      const snapshot: CaseSnapshot = {
        ruleVersion: finding.ruleVersion,
        capturedAt: new Date().toISOString(),
        finding,
        bills,
        readings,
        payments,
        documents: data.evidence.filter((evidence) =>
          evidenceIds.includes(evidence.id),
        ),
        isDemo: data.isDemo,
      };
      const saved = await client.query<{ id: string }>(
        `INSERT INTO cases(household_id,bill_id,finding_id,snapshot,evidence_ids,notes) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
        [
          person.householdId,
          finding.billId,
          finding.id,
          JSON.stringify(snapshot),
          evidenceIds,
          input.notes,
        ],
      );
      await client.query("COMMIT");
      return NextResponse.json({ id: saved.rows[0].id }, { status: 201 });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    return errorResponse(error);
  }
}
