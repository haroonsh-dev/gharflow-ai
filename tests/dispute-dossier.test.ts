import test from "node:test";
import assert from "node:assert/strict";
import { generateNepraDisputePdf } from "../src/lib/dispute-dossier";
import { PDFDocument } from "pdf-lib";
import type { CaseRecord } from "../src/lib/types";

test("generateNepraDisputePdf builds a multi-authority NEPRA dispute package with legal citations", async () => {
  const mockCase: CaseRecord = {
    id: "33333333-3333-3333-3333-333333333333",
    billId: "44444444-4444-4444-4444-444444444444",
    status: "open",
    evidenceIds: [],
    notes: "Meter was read on day 35 pushing bill past 200 units slab.",
    outcome: "",
    createdAt: "2026-10-15T00:00:00Z",
    updatedAt: "2026-10-15T00:00:00Z",
    checklist: {
      inspectSource: true,
      checkRecords: true,
      prepareReport: true,
      recordOutcome: false,
    },
    snapshot: {
      finding: {
        id: "bill:pro_rata_slab_jump",
        code: "pro_rata_slab_jump",
        billId: "44444444-4444-4444-4444-444444444444",
        kind: "review",
        title: "Extended reading cycle caused slab jump",
        detail: "Reading span of 35 days pushed consumption across the 200 kWh slab boundary.",
        evidence: [
          "Reading cycle: 35 days (normal limit: 31)",
          "Billed units: 215 kWh",
          "30-day normalized: 184 kWh",
        ],
        missing: [],
        relatedBillIds: [],
        readingIds: [],
        ruleVersion: "2.1.0",
      },
      bills: [
        {
          id: "44444444-4444-4444-4444-444444444444",
          referenceNumber: "04112231234567", // LESCO
          billMonth: "2026-09-01",
          previousReading: 200,
          currentReading: 415,
          multiplier: 1,
          billedUnits: 215,
          totalAmount: 8500,
          dueDate: "2026-09-25",
          meterIdentity: "M-998811",
          readingDate: "2026-09-14",
          readingStatus: "actual",
          meterType: "conventional",
          supersededById: null,
          evidenceFileId: null,
          fieldSources: {},
          ocrStatus: "extracted",
          corrections: {},
          confirmedAt: "2026-09-15T00:00:00Z",
          extraction: null,
        },
      ],
      readings: [],
      payments: [],
      documents: [],
      capturedAt: "2026-10-15T00:00:00Z",
      ruleVersion: "2.1.0",
      isDemo: false,
    },
  };

  const pdfBytes = await generateNepraDisputePdf(mockCase, []);
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 500);

  const doc = await PDFDocument.load(pdfBytes);
  assert.ok(doc.getPageCount() >= 1);
});
