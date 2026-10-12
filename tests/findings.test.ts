import assert from "node:assert/strict";
import test from "node:test";
import { analyze, savingsScenario, type BillRecord } from "../src/lib/findings";

const bill = (overrides: Partial<BillRecord> = {}): BillRecord => ({
  id: "one", referenceNumber: "12345678901234", billMonth: "2026-08-01",
  previousReading: 100, currentReading: 200, multiplier: 1, billedUnits: 100,
  totalAmount: 5000, dueDate: "2026-08-20", ...overrides,
});

test("matching bill has no review finding", () => {
  assert.equal(analyze([bill()], []).filter((finding) => finding.kind === "review").length, 0);
});

test("reading arithmetic flags a mismatch with numbers", () => {
  const result = analyze([bill({ billedUnits: 120 })], []);
  assert.match(result.find((finding) => finding.id.endsWith(":units"))?.detail ?? "", /100\.00.*120\.00/);
});

test("missing readings are informational", () => {
  const result = analyze([bill({ previousReading: null })], []);
  assert.equal(result.find((finding) => finding.id.endsWith(":missing"))?.kind, "info");
});

test("continuity and duplicate period are flagged", () => {
  const second = bill({ id: "two", billMonth: "2026-09-01", previousReading: 220, currentReading: 300, billedUnits: 80 });
  const duplicate = bill({ id: "three" });
  const result = analyze([bill(), second, duplicate], []);
  assert.ok(result.some((finding) => finding.id === "two:continuity"));
  assert.ok(result.some((finding) => finding.id.endsWith(":duplicate")));
});

test("unusual increase uses previous confirmed bill", () => {
  const second = bill({ id: "two", billMonth: "2026-09-01", previousReading: 200, currentReading: 400, billedUnits: 200 });
  assert.ok(analyze([bill(), second], []).some((finding) => finding.id === "two:jump"));
});

test("receipt mismatch is a comparison, not posting verification", () => {
  const result = analyze([bill()], [{ billId: "one", amount: 4500, paidAt: "2026-08-18" }]);
  const finding = result.find((item) => item.id === "one:payment");
  assert.match(finding?.detail ?? "", /does not verify utility posting/);
});

test("scenario needs bill units and bounds the slider", () => {
  assert.equal(savingsScenario([], 10), null);
  assert.equal(savingsScenario([bill()], 75), null);
  assert.equal(savingsScenario([bill()], 10)?.monthlyPkr, 500);
});
