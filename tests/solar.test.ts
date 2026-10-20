import test from "node:test";
import assert from "node:assert/strict";
import { auditSolarNetMetering } from "../src/lib/solar";

test("auditSolarNetMetering correctly identifies net export and buyback credit", () => {
  const result = auditSolarNetMetering({
    importOffPeakUnits: 400,
    importPeakUnits: 100,
    exportOffPeakUnits: 650, // 250 excess export
  });

  assert.equal(result.isNetExporter, true);
  assert.equal(result.excessExportUnits, 250);
  assert.equal(result.solarCreditPkr, 250 * 26.5); // 6,625
  assert.equal(result.peakChargesPkr, 100 * 49.5); // 4,950
  assert.equal(result.offPeakChargesPkr, 0);
  // Net payable should be negative credit: 4950 - 6625 = -1675
  assert.equal(result.netPayableEstimatedPkr, -1675);
  assert.ok(result.solarSelfSufficiencyPct >= 100);
});

test("auditSolarNetMetering flags uncredited solar export violation", () => {
  const result = auditSolarNetMetering({
    importOffPeakUnits: 300,
    importPeakUnits: 120,
    exportOffPeakUnits: 500, // 200 excess units
    billedTotalPkr: 22000, // DISCO sent a massive 22,000 bill ignoring solar export!
  });

  assert.equal(result.isNetExporter, true);
  const violation = result.discrepancies.find((d) => d.code === "uncredited_solar_export");
  assert.ok(violation, "Should flag uncredited solar export violation");
  assert.equal(violation?.severity, "violation");
  assert.match(violation?.ruleCitation ?? "", /NEPRA Net Metering/);
});

test("auditSolarNetMetering handles net consumer scenario", () => {
  const result = auditSolarNetMetering({
    importOffPeakUnits: 600,
    importPeakUnits: 150,
    exportOffPeakUnits: 200, // Export less than import
  });

  assert.equal(result.isNetExporter, false);
  assert.equal(result.excessExportUnits, 0);
  assert.equal(result.netOffPeakUnits, 400); // 400 net off-peak owed
  assert.equal(result.solarCreditPkr, 0);
  assert.ok(result.netPayableEstimatedPkr > 0);
});
