import test from "node:test";
import assert from "node:assert/strict";
import {
  simulateApplianceLoad,
  analyzePhantomLoad,
  APPLIANCE_CATALOG,
} from "../src/lib/appliances";

test("appliance catalog includes key Pakistani household devices", () => {
  const ac15 = APPLIANCE_CATALOG.find((a) => a.id === "ac_1_5_ton");
  const pump = APPLIANCE_CATALOG.find((a) => a.id === "water_pump_1hp");
  const ups = APPLIANCE_CATALOG.find((a) => a.id === "ups_losses");

  assert.ok(ac15, "1.5 ton AC must be in catalog");
  assert.ok(pump, "Water pump must be in catalog");
  assert.ok(ups, "UPS losses must be in catalog");
  assert.equal(ac15?.category, "cooling");
});

test("simulateApplianceLoad calculates units and costs correctly", () => {
  const result = simulateApplianceLoad([
    { applianceId: "ac_1_5_ton", quantity: 1, hoursPerDay: 8 }, // 0.95 * 8 * 30 = 228 kWh
    { applianceId: "refrigerator", quantity: 1, hoursPerDay: 24 }, // 0.08 * 24 * 30 = 57.6 kWh
    { applianceId: "water_pump_1hp", quantity: 1, hoursPerDay: 1 }, // 0.8 * 1 * 30 = 24 kWh
  ]);

  // Total should be ~310 kWh
  assert.ok(result.totalMonthlyKwh >= 300, `Expected >= 300 kWh, got ${result.totalMonthlyKwh}`);
  assert.ok(result.totalEstimatedCostPkr > 5000, "Estimated cost should be positive and realistic");
  assert.equal(result.items.length, 3);
  assert.equal(result.items[0].appliance.id, "ac_1_5_ton", "AC should be the highest consumption item");
  assert.ok(result.slabThresholdAlert?.includes("300 kWh"), "Should alert on 300 kWh slab threshold breach");
  assert.ok(result.categories.length >= 2, "Should group into category breakdowns");
});

test("simulateApplianceLoad supports custom user appliances", () => {
  const result = simulateApplianceLoad([
    {
      applianceId: "custom_kettle",
      quantity: 1,
      hoursPerDay: 1,
      customName: "Electric Tea Kettle",
      customWatts: 1500,
      category: "heating",
    },
  ]);

  // 1.5 kW * 1h * 30 = 45 kWh
  assert.equal(result.totalMonthlyKwh, 45);
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].appliance.name, "Electric Tea Kettle");
  assert.equal(result.categories[0].category, "heating");
});

test("zero or negative hours are excluded from load simulation", () => {
  const result = simulateApplianceLoad([
    { applianceId: "ac_1_5_ton", quantity: 0, hoursPerDay: 8 },
    { applianceId: "refrigerator", quantity: 1, hoursPerDay: 0 },
  ]);

  assert.equal(result.totalMonthlyKwh, 0);
  assert.equal(result.items.length, 0);
  assert.equal(result.totalEstimatedCostPkr, 0);
});

test("analyzePhantomLoad flags critical unexplained excess consumption", () => {
  // Simulated: 300 kWh, Actual Bill: 520 kWh (+220 kWh / 73% excess)
  const analysis = analyzePhantomLoad(300, 520, false);

  assert.equal(analysis.status, "excess_critical");
  assert.equal(analysis.severity, "high");
  assert.equal(analysis.discrepancyKwh, 220);
  assert.ok(analysis.discrepancyPct > 50);
  assert.ok(analysis.estimatedLossPkr > 8000, "Should compute realistic financial loss in PKR");
  assert.ok(analysis.diagnoses.some((d) => d.includes("Neutral Line Earth Leakage")));
  assert.ok(analysis.diagnoses.some((d) => d.includes("Breaker Test") || d.includes("Meter Creep") || d.includes("Water Motor")));
  assert.ok(analysis.recommendations.length > 0);
});

test("analyzePhantomLoad flags moderate usage variance", () => {
  // Simulated: 300 kWh, Actual Bill: 350 kWh (+50 kWh / 17% excess)
  const analysis = analyzePhantomLoad(300, 350, false);

  assert.equal(analysis.status, "excess_warning");
  assert.equal(analysis.severity, "medium");
  assert.equal(analysis.discrepancyKwh, 50);
});

test("analyzePhantomLoad flags under-reported or sluggish meter condition", () => {
  // Simulated: 400 kWh, Actual Bill: 250 kWh (-150 kWh deficit)
  const analysis = analyzePhantomLoad(400, 250, false);

  assert.equal(analysis.status, "under_reported");
  assert.equal(analysis.severity, "medium");
  assert.ok(analysis.discrepancyKwh < 0);
  assert.ok(analysis.diagnoses.some((d) => d.includes("detection bills") || d.includes("Sluggish")));
});

test("analyzePhantomLoad recognizes aligned consumption and missing bills", () => {
  // Aligned: 300 kWh vs 310 kWh (+3%)
  const aligned = analyzePhantomLoad(300, 310, false);
  assert.equal(aligned.status, "aligned");
  assert.equal(aligned.severity, "none");
  assert.equal(aligned.estimatedLossPkr, 0);

  // No bill available
  const noBill = analyzePhantomLoad(300, null, false);
  assert.equal(noBill.status, "no_bill");
  assert.equal(noBill.severity, "none");
});
