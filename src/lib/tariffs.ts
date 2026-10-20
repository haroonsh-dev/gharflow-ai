/**
 * NEPRA Electricity Tariff & Billing Audit Engine for Pakistani Utilities (LESCO, KE, IESCO, MEPCO, etc.)
 * Compliant with NEPRA Consumer Service Manual (CSM) Section 4 (Billing) & Section 5 (Disputed Bills).
 */

export type TariffCategory = "protected" | "unprotected" | "lifeline" | "tou_residential";

export type SlabDefinition = {
  min: number;
  max: number;
  ratePerUnit: number;
  description: string;
};

// Current gazetted NEPRA baseline rates (PKR/kWh) for residential consumers
export const RESIDENTIAL_TARIFFS: Record<TariffCategory, SlabDefinition[]> = {
  lifeline: [
    { min: 1, max: 50, ratePerUnit: 3.95, description: "Lifeline 1-50 kWh" },
    { min: 51, max: 100, ratePerUnit: 7.74, description: "Lifeline 51-100 kWh" },
  ],
  protected: [
    { min: 1, max: 100, ratePerUnit: 7.74, description: "Protected 1-100 kWh" },
    { min: 101, max: 200, ratePerUnit: 14.16, description: "Protected 101-200 kWh" },
  ],
  unprotected: [
    { min: 1, max: 100, ratePerUnit: 23.59, description: "Unprotected 1-100 kWh" },
    { min: 101, max: 200, ratePerUnit: 30.07, description: "Unprotected 101-200 kWh" },
    { min: 201, max: 300, ratePerUnit: 34.26, description: "Unprotected 201-300 kWh" },
    { min: 301, max: 400, ratePerUnit: 39.15, description: "Unprotected 301-400 kWh" },
    { min: 401, max: 500, ratePerUnit: 41.36, description: "Unprotected 401-500 kWh" },
    { min: 501, max: 600, ratePerUnit: 42.78, description: "Unprotected 501-600 kWh" },
    { min: 601, max: 700, ratePerUnit: 43.92, description: "Unprotected 601-700 kWh" },
    { min: 701, max: Infinity, ratePerUnit: 48.84, description: "Unprotected 700+ kWh" },
  ],
  tou_residential: [
    { min: 1, max: Infinity, ratePerUnit: 48.5, description: "Peak Hours" },
    { min: 1, max: Infinity, ratePerUnit: 37.5, description: "Off-Peak Hours" },
  ],
};

export type SlabAllocation = {
  slab: string;
  units: number;
  rate: number;
  cost: number;
};

export type SlabCalculationResult = {
  category: TariffCategory;
  totalUnits: number;
  baseCost: number;
  allocations: SlabAllocation[];
};

/**
 * Calculates progressive slab allocation for residential domestic bills.
 */
export function calculateSlabDistribution(
  units: number,
  category: "protected" | "unprotected" | "lifeline" = "unprotected",
): SlabCalculationResult {
  const slabs = RESIDENTIAL_TARIFFS[category];
  const allocations: SlabAllocation[] = [];
  let remainingUnits = Math.max(0, units);
  let baseCost = 0;

  for (const slab of slabs) {
    if (remainingUnits <= 0) break;
    const slabCapacity = slab.max === Infinity ? remainingUnits : slab.max - slab.min + 1;
    const allocatedUnits = Math.min(remainingUnits, slabCapacity);
    const cost = Number((allocatedUnits * slab.ratePerUnit).toFixed(2));

    allocations.push({
      slab: slab.description,
      units: allocatedUnits,
      rate: slab.ratePerUnit,
      cost,
    });

    baseCost += cost;
    remainingUnits -= allocatedUnits;
  }

  return {
    category,
    totalUnits: units,
    baseCost: Number(baseCost.toFixed(2)),
    allocations,
  };
}

export type ProRataAuditResult = {
  isOverbilledByDays: boolean;
  actualDays: number;
  standardDays: number;
  billedUnits: number;
  normalizedUnits: number;
  actualSlabThreshold: number | null;
  normalizedSlabThreshold: number | null;
  excessUnitsAttributedToDelay: number;
  estimatedExcessCostPkr: number;
  recommendation: string;
};

/**
 * NEPRA CSM Section 4.1 Audit:
 * Detects whether an extended meter reading cycle (e.g. 33–36 days instead of 30)
 * pushed a consumer's consumption across a critical slab boundary (e.g. >200 or >300 units).
 */
export function auditBillingCycleDays(
  readingDateStart: string,
  readingDateEnd: string,
  billedUnits: number,
): ProRataAuditResult | null {
  const start = new Date(readingDateStart);
  const end = new Date(readingDateEnd);
  if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start) return null;

  const diffMs = end.getTime() - start.getTime();
  const actualDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const standardDays = 30;

  if (actualDays <= 31 || billedUnits <= 0) {
    return {
      isOverbilledByDays: false,
      actualDays,
      standardDays,
      billedUnits,
      normalizedUnits: billedUnits,
      actualSlabThreshold: null,
      normalizedSlabThreshold: null,
      excessUnitsAttributedToDelay: 0,
      estimatedExcessCostPkr: 0,
      recommendation: "Billing cycle is within the legal 28-31 day window.",
    };
  }

  const dailyBurn = billedUnits / actualDays;
  const normalizedUnits = Math.round(dailyBurn * standardDays);
  const excessDays = actualDays - standardDays;
  const excessUnits = Math.round(dailyBurn * excessDays);

  // Check critical Pakistani thresholds: 100, 200, 300, 700
  const thresholds = [100, 200, 300, 700];
  let crossedThreshold: number | null = null;
  let normalizedSlabThreshold: number | null = null;

  for (const t of thresholds) {
    if (billedUnits > t && normalizedUnits <= t) {
      crossedThreshold = t;
      normalizedSlabThreshold = t;
      break;
    }
  }

  const isCriticalBreach = crossedThreshold !== null;
  // If a consumer crossed 200 units, the tariff jump is approx 16 PKR/unit across the entire bill
  // If 300 units, approx 6 PKR/unit jump
  const jumpRate = crossedThreshold === 200 ? 16.0 : crossedThreshold === 300 ? 5.5 : 4.0;
  const estimatedPenalty = isCriticalBreach
    ? Number((billedUnits * jumpRate).toFixed(2))
    : Number((excessUnits * 24).toFixed(2));

  return {
    isOverbilledByDays: isCriticalBreach || actualDays >= 34,
    actualDays,
    standardDays,
    billedUnits,
    normalizedUnits,
    actualSlabThreshold: crossedThreshold,
    normalizedSlabThreshold,
    excessUnitsAttributedToDelay: excessUnits,
    estimatedExcessCostPkr: estimatedPenalty,
    recommendation: isCriticalBreach
      ? `Reading span of ${actualDays} days pushed billed units (${billedUnits} kWh) past the ${crossedThreshold} kWh slab. Under a 30-day cycle, consumption would be ${normalizedUnits} kWh. This violates NEPRA CSM Section 4.1 pro-rata rules.`
      : `Reading span is ${actualDays} days (standard is 30). Consumption should be pro-rated.`,
  };
}

export type StatutoryLeviesAudit = {
  electricityDutyExpected: number;
  gstExpected: number;
  fcSurchargeExpected: number;
  tvFeeExpected: number;
  totalExpectedLevies: number;
  discrepancyNote?: string;
};

/**
 * Verifies standard statutory taxes and levies on electricity bills in Pakistan:
 * - Electricity Duty (Punjab: 1.5% of electricity cost)
 * - GST (18% for non-lifeline)
 * - Financing Cost Surcharge (Rs. 3.23 / kWh)
 * - TV License Fee (Flat Rs. 35 for domestic, Rs. 60 for commercial)
 */
export function auditStatutoryLevies(
  billedUnits: number,
  costOfElectricity: number,
  isCommercial = false,
): StatutoryLeviesAudit {
  const electricityDutyExpected = Number((costOfElectricity * 0.015).toFixed(2));
  // Lifeline (<100 units) is generally GST-exempt
  const gstExpected = billedUnits <= 100 ? 0 : Number((costOfElectricity * 0.18).toFixed(2));
  const fcSurchargeExpected = Number((billedUnits * 3.23).toFixed(2));
  const tvFeeExpected = isCommercial ? 60 : 35;

  const totalExpectedLevies = Number(
    (electricityDutyExpected + gstExpected + fcSurchargeExpected + tvFeeExpected).toFixed(2),
  );

  return {
    electricityDutyExpected,
    gstExpected,
    fcSurchargeExpected,
    tvFeeExpected,
    totalExpectedLevies,
  };
}
