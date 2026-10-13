import test from "node:test";
import assert from "node:assert/strict";
import { compareBills, connectionTimeline } from "../src/lib/investigation";
import type { Bill } from "../src/lib/types";
const bill = (id: string, month: string, extra: Partial<Bill> = {}): Bill => ({
  id,
  referenceNumber: "12345678901234",
  billMonth: `2026-${month}-01`,
  previousReading: 100,
  currentReading: 200,
  billedUnits: 100,
  totalAmount: 5000,
  dueDate: null,
  multiplier: 1,
  meterIdentity: "M1",
  readingDate: `2026-${month}-10`,
  readingStatus: "actual",
  meterType: "conventional",
  supersededById: null,
  evidenceFileId: null,
  fieldSources: {},
  ocrStatus: "manual",
  corrections: {},
  confirmedAt: "2026-10-01T00:00:00Z",
  extraction: null,
  ...extra,
});
test("timeline exposes saved gaps and duplicates while excluding replacements and other connections", () => {
  const values = [
    bill("a", "07"),
    bill("b", "09"),
    bill("c", "09"),
    bill("old", "08", { supersededById: "b" }),
    bill("other", "08", { referenceNumber: "99999999999999" }),
  ];
  assert.deepEqual(
    connectionTimeline(values, "12345678901234").map((item) => item.state),
    ["saved", "missing", "duplicate"],
  );
  assert.equal(
    connectionTimeline(
      [bill("old", "01", { billMonth: "2020-01-01" }), bill("new", "10")],
      "12345678901234",
    ).length,
    24,
  );
});
test("compatible dated bills compute a historical meter average and preserve monetary deltas separately", () => {
  const values = [
    bill("a", "08"),
    bill("b", "09", {
      previousReading: 200,
      currentReading: 355,
      billedUnits: 155,
      totalAmount: 6500,
    }),
  ];
  const result = compareBills(values, "b", "a");
  assert.ok(result);
  assert.deepEqual(result.reasons, []);
  assert.equal(result.days, 31);
  assert.equal(result.meterKwh, 155);
  assert.equal(result.dailyKwh, 5);
  assert.equal(result.billedUnitsChange, 55);
  assert.equal(result.amountChange, 1500);
  assert.equal(compareBills(values, "a", "a"), null);
});
test("gaps, meter changes, estimates, unsupported meters, duplicates and missing dates suppress inferred consumption", () => {
  for (const extra of [
    { billMonth: "2026-10-01" },
    { meterIdentity: "M2" },
    { readingStatus: "estimated" as const },
    { meterType: "unsupported" as const },
    { readingDate: null },
    { previousReading: 230 },
    { currentReading: 150 },
    { confirmedAt: null },
    { referenceNumber: "99999999999999" },
    { multiplier: 2 },
    { supersededById: "new" },
  ]) {
    const values = [
      bill("a", "08"),
      bill("b", "09", { previousReading: 200, currentReading: 300, ...extra }),
    ];
    const result = compareBills(values, "a", "b");
    assert.ok(result?.reasons.length);
    assert.equal(result.dailyKwh, null);
    assert.equal(result.meterKwh, null);
  }
  const values = [
    bill("a", "08"),
    bill("b", "09", { previousReading: 200, currentReading: 300 }),
    bill("duplicate", "09"),
  ];
  assert.match(compareBills(values, "a", "b")!.reasons.join(" "), /duplicate/);
});
test("a zero reading baseline and fractional multipliers do not become missing data", () => {
  const values = [
    bill("a", "08", { previousReading: 0, currentReading: 0, multiplier: 0.5 }),
    bill("b", "09", {
      previousReading: 0,
      currentReading: 31,
      multiplier: 0.5,
    }),
  ];
  assert.equal(compareBills(values, "a", "b")?.dailyKwh, 0.5);
});
