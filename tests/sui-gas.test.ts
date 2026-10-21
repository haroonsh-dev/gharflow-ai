import { test } from "node:test";
import assert from "node:assert/strict";
import {
  identifyGasProvider,
  convertVolumeToMmbtu,
  auditGasMmbtu,
  calculateGasBill,
  simulateWinterGasAppliances,
  generateOgraDisputeLetter,
  PROTECTED_CEILING_HM3,
} from "../src/lib/sui-gas";

test("identifyGasProvider recognizes SNGPL (11 digits) and SSGC (10 digits)", () => {
  const sngpl = identifyGasProvider("08234567891");
  assert.ok(sngpl);
  assert.equal(sngpl?.provider, "sngpl");
  assert.ok(sngpl?.portalUrl.includes("08234567891"));

  const ssgc = identifyGasProvider("1234567890");
  assert.ok(ssgc);
  assert.equal(ssgc?.provider, "ssgc");
  assert.ok(ssgc?.portalUrl.includes("ssgc.com.pk"));

  assert.equal(identifyGasProvider("123"), null);
  assert.equal(identifyGasProvider(""), null);
});

test("convertVolumeToMmbtu accurately converts HM3 to MMBTU", () => {
  // 1 HM3 = 3531.47 cu. ft * 950 GCV / 1,000,000 = 3.3548965 MMBTU
  const mmbtu = convertVolumeToMmbtu(1.0, 950, 1.0);
  assert.equal(mmbtu, 3.3549);

  // 0.5 HM3 = ~1.6774 MMBTU
  const halfMmbtu = convertVolumeToMmbtu(0.5, 950, 1.0);
  assert.equal(halfMmbtu, 1.6774);

  // 0 HM3 should be 0
  assert.equal(convertVolumeToMmbtu(0), 0);
});

test("auditGasMmbtu flags inflated energy calculations", () => {
  // 0.85 HM3 -> expected MMBTU is ~2.8517
  const normalAudit = auditGasMmbtu(0.85, 2.85, 950);
  assert.equal(normalAudit.hasMmbtuDiscrepancy, false);

  // Billed 4.5 MMBTU for 0.85 HM3 is clearly inflated (> 5% discrepancy)
  const inflatedAudit = auditGasMmbtu(0.85, 4.5, 950);
  assert.equal(inflatedAudit.hasMmbtuDiscrepancy, true);
  assert.ok(inflatedAudit.differenceMmbtu > 1.5);
  assert.ok(inflatedAudit.notes.includes("Overbilled MMBTU"));
});

test("calculateGasBill computes progressive slabs and detects misclassification penalty", () => {
  // Protected consumer: 0.70 HM3 <= 0.90 HM3
  const protectedBill = calculateGasBill(0.70, "protected", 950, 1.0, "protected");
  assert.equal(protectedBill.category, "protected");
  assert.equal(protectedBill.meterRentPkr, 400);
  assert.ok(protectedBill.gasChargesPkr > 0);
  assert.equal(protectedBill.isMisclassifiedAsUnprotected, false);
  assert.equal(protectedBill.potentialSavingsPkr, 0);

  // Same consumer (0.70 HM3) wrongly billed as 'unprotected'
  const penalisedBill = calculateGasBill(0.70, "protected", 950, 1.0, "unprotected");
  assert.equal(penalisedBill.category, "unprotected");
  assert.equal(penalisedBill.meterRentPkr, 1000);
  assert.equal(penalisedBill.isMisclassifiedAsUnprotected, true);
  // Unprotected tier charges Rs. 1000/MMBTU vs Rs. 200-300 for protected -> big overcharge!
  assert.ok(penalisedBill.potentialSavingsPkr > 1000);
  assert.ok(penalisedBill.totalPayablePkr > protectedBill.totalPayablePkr);
});

test("simulateWinterGasAppliances warns when crossing the 0.90 HM3 protected threshold", () => {
  // Conservative setup: No continuous pilot, 1 hr geyser, no room heaters, stove 2 hrs
  const modestSetup = simulateWinterGasAppliances({
    hasGeyser: true,
    geyserPilot24x7: false,
    geyserHeatingHoursDaily: 1,
    roomHeatersCount: 0,
    heaterHoursDaily: 0,
    stoveBurnersCount: 2,
    stoveHoursDaily: 2,
  });

  // Daily: 0.035 + 0.06 = 0.095 HM3/day * 30 = 2.85 HM3? Wait:
  // Let's check stove: 2 burners * 2 hrs * 0.015 = 0.06 HM3/day
  // Geyser: 1 hr * 0.035 = 0.035 HM3/day
  // Total: 0.095 HM3/day -> Monthly: 2.85 HM3
  assert.ok(modestSetup.monthlyVolumeHm3 > 0);
  assert.equal(modestSetup.category, "unprotected");
  assert.equal(modestSetup.isCrossingProtectedCliff, true);

  // Minimal setup: Geyser 0.5 hr, 1 burner 1 hr, no pilot
  const minimalSetup = simulateWinterGasAppliances({
    hasGeyser: true,
    geyserPilot24x7: false,
    geyserHeatingHoursDaily: 0.5, // 0.0175 HM3
    roomHeatersCount: 0,
    heaterHoursDaily: 0,
    stoveBurnersCount: 1,
    stoveHoursDaily: 0.5, // 0.0075 HM3
  });
  // Total daily: 0.025 HM3 * 30 = 0.75 HM3 <= 0.90 HM3
  assert.ok(minimalSetup.monthlyVolumeHm3 <= PROTECTED_CEILING_HM3);
  assert.equal(minimalSetup.category, "protected");
  assert.equal(minimalSetup.isCrossingProtectedCliff, false);
});

test("generateOgraDisputeLetter builds formal petition with legal citations", () => {
  const petition = generateOgraDisputeLetter({
    consumerName: "Ahmad Raza",
    consumerNumber: "08234567891",
    provider: "sngpl",
    city: "Lahore",
    billMonth: "2026-01",
    billedHm3: 0.85,
    billedMmbtu: 3.0,
    disputeReason: "misclassification",
    potentialSavingsPkr: 2450,
  });

  assert.ok(petition.includes("OIL & GAS REGULATORY AUTHORITY"));
  assert.ok(petition.includes("08234567891"));
  assert.ok(petition.includes("SNGPL"));
  assert.ok(petition.includes("Ahmad Raza"));
  assert.ok(petition.includes("OGRA Complaint Resolution Procedure Regulations 2003"));
  assert.ok(petition.includes("PKR 2450"));
});
