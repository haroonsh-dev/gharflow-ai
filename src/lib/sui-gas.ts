/**
 * Sui Gas (SSGC & SNGPL) MMBTU & Progressive Slab Audit Engine for Pakistan
 * Compliant with OGRA (Oil & Gas Regulatory Authority) Gazetted Natural Gas Tariffs
 * and OGRA Complaint Resolution Procedure Regulations.
 */

export type GasProvider = "sngpl" | "ssgc";

export type GasCategory = "protected" | "unprotected";

export type GasSlabTier = {
  maxHm3: number;
  ratePerMmbtu: number;
  description: string;
};

// Standard conversion constant: 1 HM3 = 100 M3 = 3,531.47 Cubic Feet
export const CU_FT_PER_HM3 = 3531.47;
// Standard reference domestic GCV (Gross Calorific Value) in BTU per cubic foot
export const DEFAULT_DOMESTIC_GCV = 950;
// Standard low-pressure residential factor
export const DEFAULT_PRESSURE_FACTOR = 1.0;
// OGRA Protected category ceiling in HM3
export const PROTECTED_CEILING_HM3 = 0.9;

export const OGRA_SLABS: Record<GasCategory, GasSlabTier[]> = {
  protected: [
    { maxHm3: 0.5, ratePerMmbtu: 200, description: "Protected up to 0.5 HM³ (~1.77 MMBTU)" },
    { maxHm3: 0.9, ratePerMmbtu: 300, description: "Protected up to 0.9 HM³ (~3.18 MMBTU)" },
  ],
  unprotected: [
    { maxHm3: 1.0, ratePerMmbtu: 1000, description: "Unprotected up to 1.0 HM³" },
    { maxHm3: 1.5, ratePerMmbtu: 1200, description: "Unprotected up to 1.5 HM³" },
    { maxHm3: 2.0, ratePerMmbtu: 1600, description: "Unprotected up to 2.0 HM³" },
    { maxHm3: 3.0, ratePerMmbtu: 3000, description: "Unprotected up to 3.0 HM³" },
    { maxHm3: 4.0, ratePerMmbtu: 3500, description: "Unprotected up to 4.0 HM³" },
    { maxHm3: Infinity, ratePerMmbtu: 4000, description: "Unprotected above 4.0 HM³" },
  ],
};

// Fixed monthly meter rent mandated by OGRA
export const FIXED_METER_RENT_PKR: Record<GasCategory, number> = {
  protected: 400,
  unprotected: 1000,
};

export type GasMmbtuAudit = {
  volumeHm3: number;
  expectedMmbtu: number;
  billedMmbtu: number;
  gcvUsed: number;
  pressureFactorUsed: number;
  differenceMmbtu: number;
  hasMmbtuDiscrepancy: boolean;
  notes: string;
};

export type GasSlabAllocation = {
  tier: string;
  allocatedHm3: number;
  allocatedMmbtu: number;
  ratePerMmbtu: number;
  costPkr: number;
};

export type GasBillAudit = {
  category: GasCategory;
  volumeHm3: number;
  totalMmbtu: number;
  gasChargesPkr: number;
  meterRentPkr: number;
  gstPkr: number; // 18% GST on (gas charges + meter rent)
  totalPayablePkr: number;
  allocations: GasSlabAllocation[];
  isMisclassifiedAsUnprotected: boolean;
  potentialSavingsPkr: number;
};

export type WinterApplianceSimulation = {
  dailyVolumeHm3: number;
  monthlyVolumeHm3: number;
  projectedMmbtu: number;
  category: GasCategory;
  estimatedMonthlyBillPkr: number;
  geyserWasteHm3: number;
  heaterConsumptionHm3: number;
  stoveConsumptionHm3: number;
  isCrossingProtectedCliff: boolean;
};

/**
 * Validates consumer number and identifies provider (SNGPL vs SSGC).
 */
export function identifyGasProvider(consumerNumber: string): {
  provider: GasProvider;
  name: string;
  portalUrl: string;
} | null {
  const clean = consumerNumber.replace(/\D/g, "");
  if (!clean || clean.length < 8) return null;

  // SNGPL typically has 11 or 10 digits
  // SSGC has 10 digits
  if (clean.length === 11) {
    return {
      provider: "sngpl",
      name: "SNGPL (Sui Northern Gas Pipelines Limited)",
      portalUrl: `https://www.sngpl.com.pk/bill/view_bill.jsp?consumer_no=${clean}`,
    };
  }

  if (clean.length === 10) {
    // Both SSGC and some SNGPL accounts have 10 digits; default to SSGC if started with common southern regions or generic
    return {
      provider: "ssgc",
      name: "SSGC (Sui Southern Gas Company)",
      portalUrl: `https://bill.ssgc.com.pk/`,
    };
  }

  return null;
}

/**
 * Converts gas volume (HM³) to energy (MMBTU) using official OGRA formula:
 * MMBTU = (Volume in HM³ × 3,531.47 × GCV × Pressure Factor) / 1,000,000
 */
export function convertVolumeToMmbtu(
  volumeHm3: number,
  gcv: number = DEFAULT_DOMESTIC_GCV,
  pressureFactor: number = DEFAULT_PRESSURE_FACTOR,
): number {
  const cuFt = Math.max(0, volumeHm3) * CU_FT_PER_HM3;
  const btu = cuFt * Math.max(1, gcv) * Math.max(0.1, pressureFactor);
  return Number((btu / 1_000_000).toFixed(4));
}

/**
 * Audits billed MMBTU against actual volumetric meter readings and standard GCV.
 */
export function auditGasMmbtu(
  volumeHm3: number,
  billedMmbtu: number,
  gcv: number = DEFAULT_DOMESTIC_GCV,
  pressureFactor: number = DEFAULT_PRESSURE_FACTOR,
): GasMmbtuAudit {
  const expectedMmbtu = convertVolumeToMmbtu(volumeHm3, gcv, pressureFactor);
  const diff = Number((billedMmbtu - expectedMmbtu).toFixed(4));
  const percentDiff = expectedMmbtu > 0 ? (Math.abs(diff) / expectedMmbtu) * 100 : 0;
  const hasMmbtuDiscrepancy = percentDiff > 5.0 && Math.abs(diff) >= 0.1;

  let notes = "MMBTU energy calculation aligns with volumetric reading.";
  if (hasMmbtuDiscrepancy) {
    if (diff > 0) {
      notes = `Overbilled MMBTU: Billed energy (${billedMmbtu} MMBTU) is ${diff} MMBTU higher than volumetric formula (${expectedMmbtu} MMBTU). Suspect inflated GCV or high pressure factor.`;
    } else {
      notes = `Billed MMBTU (${billedMmbtu}) is lower than standard volumetric formula (${expectedMmbtu} MMBTU).`;
    }
  }

  return {
    volumeHm3,
    expectedMmbtu,
    billedMmbtu,
    gcvUsed: gcv,
    pressureFactorUsed: pressureFactor,
    differenceMmbtu: diff,
    hasMmbtuDiscrepancy,
    notes,
  };
}

/**
 * Calculates progressive slab cost for gas bills under OGRA gazetted tariffs.
 */
export function calculateGasBill(
  volumeHm3: number,
  category: GasCategory = "protected",
  gcv: number = DEFAULT_DOMESTIC_GCV,
  pressureFactor: number = DEFAULT_PRESSURE_FACTOR,
  actualBilledCategory?: GasCategory,
): GasBillAudit {
  const effectiveCategory = volumeHm3 <= PROTECTED_CEILING_HM3 ? "protected" : "unprotected";
  const usedCategory = actualBilledCategory || category;
  const totalMmbtu = convertVolumeToMmbtu(volumeHm3, gcv, pressureFactor);
  const slabs = OGRA_SLABS[usedCategory];

  const allocations: GasSlabAllocation[] = [];
  let remainingHm3 = Math.max(0, volumeHm3);
  let previousMax = 0;
  let gasChargesPkr = 0;

  for (const slab of slabs) {
    if (remainingHm3 <= 0) break;
    const slabSpan = slab.maxHm3 === Infinity ? remainingHm3 : slab.maxHm3 - previousMax;
    const allocatedHm3 = Math.min(remainingHm3, slabSpan);
    const allocatedMmbtu = convertVolumeToMmbtu(allocatedHm3, gcv, pressureFactor);
    const costPkr = Number((allocatedMmbtu * slab.ratePerMmbtu).toFixed(2));

    allocations.push({
      tier: slab.description,
      allocatedHm3: Number(allocatedHm3.toFixed(4)),
      allocatedMmbtu: allocatedMmbtu,
      ratePerMmbtu: slab.ratePerMmbtu,
      costPkr,
    });

    gasChargesPkr += costPkr;
    remainingHm3 -= allocatedHm3;
    previousMax = slab.maxHm3;
  }

  const meterRentPkr = FIXED_METER_RENT_PKR[usedCategory];
  const taxableBase = gasChargesPkr + meterRentPkr;
  const gstPkr = Number((taxableBase * 0.18).toFixed(2));
  const totalPayablePkr = Number((taxableBase + gstPkr).toFixed(2));

  // Check if misclassified: consumer used <= 0.9 HM3 but was billed under unprotected
  const isMisclassifiedAsUnprotected =
    volumeHm3 <= PROTECTED_CEILING_HM3 && usedCategory === "unprotected";

  let potentialSavingsPkr = 0;
  if (isMisclassifiedAsUnprotected) {
    const protectedAudit = calculateGasBill(volumeHm3, "protected", gcv, pressureFactor, "protected");
    potentialSavingsPkr = Number((totalPayablePkr - protectedAudit.totalPayablePkr).toFixed(2));
  }

  return {
    category: usedCategory,
    volumeHm3,
    totalMmbtu,
    gasChargesPkr: Number(gasChargesPkr.toFixed(2)),
    meterRentPkr,
    gstPkr,
    totalPayablePkr,
    allocations,
    isMisclassifiedAsUnprotected,
    potentialSavingsPkr: Math.max(0, potentialSavingsPkr),
  };
}

/**
 * Simulates winter appliance gas consumption and warns of the protected threshold cliff.
 */
export function simulateWinterGasAppliances(params: {
  hasGeyser: boolean;
  geyserPilot24x7: boolean;
  geyserHeatingHoursDaily: number;
  roomHeatersCount: number;
  heaterHoursDaily: number;
  stoveBurnersCount: number;
  stoveHoursDaily: number;
}): WinterApplianceSimulation {
  // Approximate standard burner gas consumption in HM3 per hour:
  // Pilot flame: ~0.02 HM3 / day continuous
  // Geyser heating burner: ~0.035 HM3 / hr
  // Room heater: ~0.045 HM3 / hr
  // Kitchen stove burner: ~0.015 HM3 / hr
  let dailyGeyserHm3 = 0;
  if (params.hasGeyser) {
    if (params.geyserPilot24x7) {
      dailyGeyserHm3 += 0.02;
    }
    dailyGeyserHm3 += Math.max(0, params.geyserHeatingHoursDaily) * 0.035;
  }

  const dailyHeaterHm3 =
    Math.max(0, params.roomHeatersCount) * Math.max(0, params.heaterHoursDaily) * 0.045;

  const dailyStoveHm3 =
    Math.max(0, params.stoveBurnersCount) * Math.max(0, params.stoveHoursDaily) * 0.015;

  const dailyTotalHm3 = Number((dailyGeyserHm3 + dailyHeaterHm3 + dailyStoveHm3).toFixed(4));
  const monthlyTotalHm3 = Number((dailyTotalHm3 * 30).toFixed(4));
  const geyserWasteHm3 = Number((dailyGeyserHm3 * 30).toFixed(4));
  const heaterConsumptionHm3 = Number((dailyHeaterHm3 * 30).toFixed(4));
  const stoveConsumptionHm3 = Number((dailyStoveHm3 * 30).toFixed(4));

  const projectedMmbtu = convertVolumeToMmbtu(monthlyTotalHm3);
  const category: GasCategory = monthlyTotalHm3 <= PROTECTED_CEILING_HM3 ? "protected" : "unprotected";
  const billCalc = calculateGasBill(monthlyTotalHm3, category);
  const isCrossingProtectedCliff = monthlyTotalHm3 > PROTECTED_CEILING_HM3;

  return {
    dailyVolumeHm3: dailyTotalHm3,
    monthlyVolumeHm3: monthlyTotalHm3,
    projectedMmbtu,
    category,
    estimatedMonthlyBillPkr: billCalc.totalPayablePkr,
    geyserWasteHm3,
    heaterConsumptionHm3,
    stoveConsumptionHm3,
    isCrossingProtectedCliff,
  };
}

/**
 * Builds formal OGRA (Oil & Gas Regulatory Authority) Dispute Petition Letter.
 */
export function generateOgraDisputeLetter(params: {
  consumerName: string;
  consumerNumber: string;
  provider: GasProvider;
  city: string;
  billMonth: string;
  billedHm3: number;
  billedMmbtu: number;
  disputeReason: "misclassification" | "gcv_inflation" | "excess_meter_rent";
  potentialSavingsPkr: number;
}): string {
  const providerTitle =
    params.provider === "sngpl"
      ? "Sui Northern Gas Pipelines Limited (SNGPL)"
      : "Sui Southern Gas Company Limited (SSGC)";

  const reasonText =
    params.disputeReason === "misclassification"
      ? `Illegal categorization as 'Unprotected' consumer despite domestic monthly consumption of ${params.billedHm3} HM³ (within the gazetted OGRA Protected ceiling of 0.90 HM³), causing unjustified financial injury of PKR ${params.potentialSavingsPkr}.`
      : params.disputeReason === "gcv_inflation"
      ? `Excessive MMBTU billed (${params.billedMmbtu} MMBTU) against volumetric meter consumption (${params.billedHm3} HM³), indicating unjustified GCV or pressure multiplier escalation.`
      : `Unjustified fixed meter rent and arbitrary charges exceeding gazetted OGRA tariff limits.`;

  return `
BEFORE THE DESIGNATED COMPLAINT OFFICER / REGISTRAR
OIL & GAS REGULATORY AUTHORITY (OGRA), ISLAMABAD
Pursuant to OGRA Complaint Resolution Procedure Regulations 2003 & OGRA Ordinance 2002

COMPLAINANT:
Name: ${params.consumerName || "Aggrieved Domestic Consumer"}
Consumer / Customer No: ${params.consumerNumber}
City / Address: ${params.city || "Pakistan"}

VERSUS

RESPONDENT:
${providerTitle}

SUBJECT: FORMAL DISPUTE REGARDING BILLING IRREGULARITIES, TARIFF MISCLASSIFICATION, AND ILLEGAL SURCHARGES FOR THE MONTH OF ${params.billMonth.toUpperCase()}

Respectfully Sheweth:

1. The Complainant is a bonafide domestic natural gas consumer of ${providerTitle} holding Consumer Number ${params.consumerNumber}.
2. For the billing period of ${params.billMonth}, the Respondent has issued a gas bill with serious irregularities:
   - Consumption Billed: ${params.billedHm3} HM³
   - Energy Billed: ${params.billedMmbtu} MMBTU
   - Nature of Grievance: ${reasonText}
3. Under OGRA Gazetted Consumer Tariffs, domestic households with consumption of 0.90 HM³ or lower are legally protected from commercial/industrial slab escalations. The Respondent has arbitrarily subjected the Complainant to punitive unprotected rates in direct violation of statutory protections.
4. PRAYER:
   It is respectfully prayed that OGRA may kindly:
   a) Direct the Respondent to suspend the disputed demand and restrain disconnection.
   b) Order the Respondent to revise the bill under correct gazetted tariffs and refund/adjust excess charges amounting to PKR ${params.potentialSavingsPkr}.
   c) Direct the Respondent to inspect the meter calibration and GCV determination report.

Dated: ${new Date().toLocaleDateString("en-GB")}
Complainant / Authorized Representative
`.trim();
}
