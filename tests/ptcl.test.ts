import test from "node:test";
import assert from "node:assert/strict";
import {
  isPtclAccountId,
  ptclBillQueryUrl,
  auditPtclTaxes,
  auditPtclArrears,
} from "../src/lib/ptcl";
import { generatePtaDisputePdf } from "../src/lib/pta-dossier";
import { analyze, type BillRecord, type PaymentRecord } from "../src/lib/findings";
import { PDFDocument } from "pdf-lib";
import type { CaseRecord } from "../src/lib/types";

test("isPtclAccountId validates 10-digit PTCL account IDs", () => {
  assert.equal(isPtclAccountId("1000123456"), true);
  assert.equal(isPtclAccountId("12345678901234"), false); // 14-digit DISCO
  assert.equal(isPtclAccountId("0400012345678"), false); // 13-digit KE
  assert.equal(isPtclAccountId("abc1234567"), false);
});

test("ptclBillQueryUrl builds official duplicate bill search URL", () => {
  const url = ptclBillQueryUrl("1000123456", "04235881234");
  assert.match(url, /dbill\.ptcl\.net\.pk/);
  assert.match(url, /acc_id=1000123456/);
  assert.match(url, /phone=04235881234/);
});

test("auditPtclTaxes computes PRA 19.5% and WHT 15% and detects discrepancy", () => {
  // 3000 PKR package:
  // PRA (19.5%) = 585 PKR
  // WHT (15.0%) = 450 PKR
  // Expected Total Taxes = 1035 PKR; Expected Total = 4035 PKR
  const normalAudit = auditPtclTaxes(3000, 585, 450);
  assert.equal(normalAudit.expectedSalesTax, 585);
  assert.equal(normalAudit.expectedWht, 450);
  assert.equal(normalAudit.totalExpectedTaxes, 1035);
  assert.equal(normalAudit.expectedTotal, 4035);
  assert.equal(normalAudit.hasTaxDiscrepancy, false);

  // If billed WHT was 800 PKR (excess deduction):
  const excessAudit = auditPtclTaxes(3000, 585, 800);
  assert.equal(excessAudit.hasTaxDiscrepancy, true);
  assert.equal(excessAudit.whtDiscrepancy, 350);
});

test("auditPtclArrears flags uncredited payment under PTA regulations", () => {
  const arrearsAudit = auditPtclArrears(4000, 4200, true);
  assert.equal(arrearsAudit.isUncreditedArrears, true);
  assert.match(arrearsAudit.recommendation, /reconciliation/i);
});

test("findings engine flags uncredited arrears for PTCL consecutive bills", () => {
  const prevBill: BillRecord = {
    id: "ptcl-aug",
    referenceNumber: "1000123456",
    billMonth: "2026-08-01",
    previousReading: null,
    currentReading: null,
    multiplier: 1,
    billedUnits: null,
    totalAmount: 4000,
    dueDate: "2026-08-25",
    meterIdentity: null,
    readingDate: null,
    readingStatus: "unknown",
    meterType: "unsupported",
    supersededById: null,
  };

  const currBill: BillRecord = {
    id: "ptcl-sep",
    referenceNumber: "1000123456",
    billMonth: "2026-09-01",
    previousReading: null,
    currentReading: null,
    multiplier: 1,
    billedUnits: null,
    totalAmount: 8200, // sharp increase indicating uncredited arrears
    dueDate: "2026-09-25",
    meterIdentity: null,
    readingDate: null,
    readingStatus: "unknown",
    meterType: "unsupported",
    supersededById: null,
  };

  const payments: PaymentRecord[] = [
    { billId: "ptcl-aug", amount: 4000, paidAt: "2026-08-20" },
  ];

  const findings = analyze([prevBill, currBill], payments);
  const uncreditedFinding = findings.find(
    (f) => f.code === "ptcl_arrears_uncredited",
  );
  assert.ok(uncreditedFinding, "Should generate ptcl_arrears_uncredited finding");
  assert.equal(uncreditedFinding.kind, "review");
  assert.match(uncreditedFinding.title, /uncredited arrears/i);
});

test("generatePtaDisputePdf creates formal PTA telecom dispute document", async () => {
  const mockCase: CaseRecord = {
    id: "55555555-5555-5555-5555-555555555555",
    billId: "66666666-6666-6666-6666-666666666666",
    status: "open",
    evidenceIds: [],
    notes: "Paid via bank app on 2026-08-20, yet 4000 PKR arrears carried over.",
    outcome: "",
    createdAt: "2026-09-02T00:00:00Z",
    updatedAt: "2026-09-02T00:00:00Z",
    checklist: {
      inspectSource: true,
      checkRecords: true,
      prepareReport: true,
      recordOutcome: false,
    },
    snapshot: {
      finding: {
        id: "bill:ptcl_arrears_uncredited",
        code: "ptcl_arrears_uncredited",
        billId: "66666666-6666-6666-6666-666666666666",
        kind: "review",
        title: "Possible uncredited arrears on PTCL bill",
        detail: "Previous bill of 4000 PKR was paid, yet arrears appeared in September invoice.",
        evidence: [
          "Previous paid: PKR 4000",
          "Current bill: PKR 8200",
          "Account ID: 1000123456",
        ],
        missing: [],
        relatedBillIds: [],
        readingIds: [],
        ruleVersion: "2.1.0",
      },
      bills: [
        {
          id: "66666666-6666-6666-6666-666666666666",
          referenceNumber: "1000123456",
          billMonth: "2026-09-01",
          previousReading: null,
          currentReading: null,
          multiplier: 1,
          billedUnits: null,
          totalAmount: 8200,
          dueDate: "2026-09-25",
          meterIdentity: null,
          readingDate: null,
          readingStatus: "unknown",
          meterType: "unsupported",
          supersededById: null,
          evidenceFileId: null,
          fieldSources: {},
          ocrStatus: "extracted",
          corrections: {},
          confirmedAt: "2026-09-05T00:00:00Z",
          extraction: null,
        },
      ],
      readings: [],
      payments: [],
      documents: [],
      capturedAt: "2026-09-05T00:00:00Z",
      ruleVersion: "2.1.0",
      isDemo: false,
    },
  };

  const pdfBytes = await generatePtaDisputePdf(mockCase, []);
  assert.ok(pdfBytes instanceof Uint8Array);
  assert.ok(pdfBytes.length > 500);

  const doc = await PDFDocument.load(pdfBytes);
  assert.ok(doc.getPageCount() >= 1);
});
