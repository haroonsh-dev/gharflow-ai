import test from "node:test";
import assert from "node:assert/strict";
import { calculateSubmeterSplit, type MainBillContext, type PortionInput } from "../src/lib/submeter";

test("calculateSubmeterSplit correctly calculates units from previous and current readings", () => {
  const portions: PortionInput[] = [
    {
      id: "ground_floor",
      name: "Ground Floor",
      tenantName: "Owner",
      previousReading: 1200,
      currentReading: 1450, // 250 units
    },
    {
      id: "upper_floor",
      name: "Upper Portion",
      tenantName: "Ahmed",
      previousReading: 3400,
      currentReading: 3550, // 150 units
    },
  ];

  const bill: MainBillContext = {
    referenceNumber: "08112234567890",
    discoName: "LESCO",
    billMonth: "2026-09",
    mainBilledUnits: 400,
    mainTotalAmountPkr: 20000,
    dueDate: "2026-10-15",
    commonLoadHandling: "equal_split",
  };

  const result = calculateSubmeterSplit(portions, bill);

  assert.equal(result.totalSubmeterUnits, 400);
  assert.equal(result.unaccountedCommonUnits, 0);
  assert.equal(result.reconciliationStatus, "balanced");
  assert.equal(result.portions.length, 2);

  // Ground floor has 250/400 = 62.5% of bill -> Rs 12,500
  const p1 = result.portions[0];
  assert.equal(p1.submeterUnits, 250);
  assert.equal(p1.unitsSharePct, 62.5);
  assert.equal(p1.totalPayablePkr, 12500);

  // Upper floor has 150/400 = 37.5% of bill -> Rs 7,500
  const p2 = result.portions[1];
  assert.equal(p2.submeterUnits, 150);
  assert.equal(p2.unitsSharePct, 37.5);
  assert.equal(p2.totalPayablePkr, 7500);

  // Sum of portions equals total bill
  assert.equal(p1.totalPayablePkr + p2.totalPayablePkr, 20000);
  assert.ok(p2.whatsappText.includes("Upper Portion"));
  assert.ok(p2.whatsappText.includes("Ahmed"));
  assert.ok(p2.whatsappText.includes("7,500"));
});

test("calculateSubmeterSplit allocates common shared load equally", () => {
  const portions: PortionInput[] = [
    { id: "p1", name: "Floor 1", unitsConsumed: 200 },
    { id: "p2", name: "Floor 2", unitsConsumed: 300 },
  ];

  // Main bill is 550 kWh (50 kWh unmetered common load, e.g. water motor)
  const bill: MainBillContext = {
    referenceNumber: "123456",
    discoName: "IESCO",
    billMonth: "2026-08",
    mainBilledUnits: 550,
    mainTotalAmountPkr: 33000,
    commonLoadHandling: "equal_split",
  };

  const result = calculateSubmeterSplit(portions, bill);

  assert.equal(result.unaccountedCommonUnits, 50);
  assert.equal(result.reconciliationStatus, "common_load_detected");
  assert.ok(result.alertMessage?.includes("Unaccounted Common Load"));

  // 50 kWh split equally -> 25 kWh each
  assert.equal(result.portions[0].commonUnitsAllocated, 25);
  assert.equal(result.portions[0].effectiveTotalUnits, 225);

  assert.equal(result.portions[1].commonUnitsAllocated, 25);
  assert.equal(result.portions[1].effectiveTotalUnits, 325);

  // Total allocated = 550
  assert.equal(
    result.portions[0].effectiveTotalUnits + result.portions[1].effectiveTotalUnits,
    550,
  );
  assert.equal(
    result.portions[0].totalPayablePkr + result.portions[1].totalPayablePkr,
    33000,
  );
});

test("calculateSubmeterSplit flags when submeters exceed main meter", () => {
  const portions: PortionInput[] = [
    { id: "p1", name: "Unit A", unitsConsumed: 300 },
    { id: "p2", name: "Unit B", unitsConsumed: 250 },
  ];

  // Main bill is only 500 kWh (sub-meters total 550)
  const bill: MainBillContext = {
    referenceNumber: "998877",
    discoName: "K-Electric",
    billMonth: "2026-07",
    mainBilledUnits: 500,
    mainTotalAmountPkr: 25000,
    commonLoadHandling: "equal_split",
  };

  const result = calculateSubmeterSplit(portions, bill);
  assert.equal(result.reconciliationStatus, "submeters_exceed_main");
  assert.ok(result.alertMessage?.includes("Sub-meter Inconsistency"));
});
