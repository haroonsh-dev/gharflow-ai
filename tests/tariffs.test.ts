import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateSlabDistribution,
  auditBillingCycleDays,
  auditStatutoryLevies,
} from "../src/lib/tariffs";
import { analyze, type BillRecord } from "../src/lib/findings";

test("progressive slab distribution accurately calculates tiered cost for protected and unprotected", () => {
  // 150 kWh protected: 100 kWh at 7.74, 50 kWh at 14.16
  const protectedRes = calculateSlabDistribution(150, "protected");
  assert.equal(protectedRes.allocations.length, 2);
  assert.equal(protectedRes.allocations[0].units, 100);
  assert.equal(protectedRes.allocations[0].cost, 774);
  assert.equal(protectedRes.allocations[1].units, 50);
  assert.equal(protectedRes.allocations[1].cost, 708);
  assert.equal(protectedRes.baseCost, 1482);

  // 250 kWh unprotected: 100 at 23.59, 100 at 30.07, 50 at 34.26
  const unprotectedRes = calculateSlabDistribution(250, "unprotected");
  assert.equal(unprotectedRes.allocations.length, 3);
  assert.equal(unprotectedRes.baseCost, 2359 + 3007 + 1713);
});

test("auditBillingCycleDays detects pro-rata slab jumps caused by meter reading delays", () => {
  // Normal 30-day cycle: no overbilling flag
  const normal = auditBillingCycleDays("2026-08-10", "2026-09-09", 180);
  assert.ok(normal);
  assert.equal(normal.isOverbilledByDays, false);
  assert.equal(normal.actualDays, 30);

  // 35-day cycle with 215 kWh billed:
  // Daily consumption = 215 / 35 = 6.14 kWh/day.
  // Over standard 30 days = 184 kWh (strictly below 200 kWh protected threshold).
  // Delay pushed user from protected to unprotected!
  const delayed = auditBillingCycleDays("2026-08-10", "2026-09-14", 215);
  assert.ok(delayed);
  assert.equal(delayed.isOverbilledByDays, true);
  assert.equal(delayed.actualDays, 35);
  assert.equal(delayed.actualSlabThreshold, 200);
  assert.ok(delayed.normalizedUnits <= 200);
  assert.match(delayed.recommendation, /NEPRA CSM Section 4\.1/);
});

test("statutory levies audit checks electricity duty, GST and TV fee", () => {
  const levies = auditStatutoryLevies(200, 5000);
  assert.equal(levies.electricityDutyExpected, 75); // 1.5% of 5000
  assert.equal(levies.gstExpected, 900); // 18% of 5000
  assert.equal(levies.tvFeeExpected, 35); // Flat Rs. 35
  assert.equal(levies.fcSurchargeExpected, 646); // 200 * 3.23
});

test("findings engine flags extended reading cycle with pro_rata_slab_jump", () => {
  const bill1: BillRecord = {
    id: "b1",
    referenceNumber: "12345678901234",
    billMonth: "2026-08-01",
    previousReading: 100,
    currentReading: 200,
    multiplier: 1,
    billedUnits: 100,
    totalAmount: 3000,
    dueDate: null,
    meterIdentity: "M1",
    readingDate: "2026-08-10",
    readingStatus: "actual",
    meterType: "conventional",
    supersededById: null,
  };

  const bill2: BillRecord = {
    id: "b2",
    referenceNumber: "12345678901234",
    billMonth: "2026-09-01",
    previousReading: 200,
    currentReading: 415,
    multiplier: 1,
    billedUnits: 215, // 35 days: 215 units pushes past 200 kWh threshold
    totalAmount: 8500,
    dueDate: null,
    meterIdentity: "M1",
    readingDate: "2026-09-14", // 35 days from 08-10
    readingStatus: "actual",
    meterType: "conventional",
    supersededById: null,
  };

  const findings = analyze([bill1, bill2], []);
  const proRataFinding = findings.find(
    (f) => f.code === "pro_rata_slab_jump" || f.id.includes("pro_rata"),
  );
  assert.ok(proRataFinding, "Should generate pro_rata_slab_jump finding");
  assert.equal(proRataFinding.kind, "review");
  assert.match(proRataFinding.title, /Extended reading cycle/);
  assert.ok(proRataFinding.evidence.some((e) => e.includes("35 days")));
});
