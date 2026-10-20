import test from "node:test";
import assert from "node:assert/strict";
import { simulateApplianceLoad, APPLIANCE_CATALOG } from "../src/lib/appliances";

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
