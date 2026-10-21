import { money } from "@/app/dashboard/components/ui";

export type PortionInput = {
  id: string;
  name: string;
  tenantName?: string;
  previousReading?: number;
  currentReading?: number;
  unitsConsumed?: number;
  notes?: string;
};

export type MainBillContext = {
  referenceNumber: string;
  discoName: string;
  billMonth: string;
  mainBilledUnits: number;
  mainTotalAmountPkr: number;
  dueDate?: string;
  commonLoadHandling: "equal_split" | "proportional" | "landlord_absorb";
};

export type PortionSplit = {
  portionId: string;
  portionName: string;
  tenantName?: string;
  submeterUnits: number;
  commonUnitsAllocated: number;
  effectiveTotalUnits: number;
  unitsSharePct: number;
  baseEnergyPkr: number;
  taxesAndLeviesPkr: number;
  totalPayablePkr: number;
  effectiveRatePerKwh: number;
  whatsappText: string;
};

export type SubmeterSplitCalculation = {
  totalSubmeterUnits: number;
  mainBilledUnits: number;
  unaccountedCommonUnits: number;
  unaccountedRatioPct: number;
  totalBillPkr: number;
  blendedRatePerKwh: number;
  portions: PortionSplit[];
  reconciliationStatus: "balanced" | "common_load_detected" | "submeters_exceed_main";
  alertMessage?: string;
};

/**
 * Calculates fair-share billing apportionment for multi-tenant / multi-portion households
 * sharing a single primary WAPDA / DISCO connection.
 */
export function calculateSubmeterSplit(
  portions: PortionInput[],
  bill: MainBillContext,
): SubmeterSplitCalculation {
  let hasReversedReading = false;
  let reversedPortionName = "";

  const resolvedPortions = portions.map((p) => {
    let units = 0;
    if (p.currentReading != null && p.previousReading != null) {
      if (p.currentReading >= p.previousReading) {
        units = Math.round((p.currentReading - p.previousReading) * 10) / 10;
      } else {
        hasReversedReading = true;
        reversedPortionName = p.name || "Sub-meter";
      }
    } else if (p.unitsConsumed != null && p.unitsConsumed >= 0) {
      units = Math.round(p.unitsConsumed * 10) / 10;
    }
    return {
      ...p,
      calculatedUnits: units,
    };
  });

  const totalSubmeterUnits =
    Math.round(
      resolvedPortions.reduce((sum, p) => sum + p.calculatedUnits, 0) * 10,
    ) / 10;

  const mainBilledUnits = Math.max(0, bill.mainBilledUnits);
  const totalBillPkr = Math.max(0, bill.mainTotalAmountPkr);

  const blendedRatePerKwh =
    mainBilledUnits > 0 ? totalBillPkr / mainBilledUnits : 35;

  const unaccountedCommonUnits =
    Math.round((mainBilledUnits - totalSubmeterUnits) * 10) / 10;

  const unaccountedRatioPct =
    mainBilledUnits > 0
      ? Math.round((Math.abs(unaccountedCommonUnits) / mainBilledUnits) * 100)
      : 0;

  let reconciliationStatus: "balanced" | "common_load_detected" | "submeters_exceed_main" =
    "balanced";
  let alertMessage: string | undefined;

  if (hasReversedReading) {
    alertMessage = `Reading Sequence Error: ${reversedPortionName} has a current reading lower than previous reading. Please verify register values or check if meter completed a mechanical 99,999 rollover.`;
  } else if (unaccountedCommonUnits > 5) {
    reconciliationStatus = "common_load_detected";
    alertMessage = `Unaccounted Common Load: Main meter recorded ${mainBilledUnits} kWh, while sub-meters sum to ${totalSubmeterUnits} kWh (+${unaccountedCommonUnits} kWh difference). This typically represents shared water motor, staircase lighting, or wiring line loss.`;
  } else if (unaccountedCommonUnits < -5) {
    reconciliationStatus = "submeters_exceed_main";
    alertMessage = `Sub-meter Inconsistency: Sub-meters total ${totalSubmeterUnits} kWh, which exceeds main meter billed units (${mainBilledUnits} kWh by ${Math.abs(unaccountedCommonUnits)} kWh). Check for misread sub-meter registers or reading date mismatches.`;
  }

  // Allocate common load
  const activePortionCount = resolvedPortions.filter(
    (p) => p.calculatedUnits > 0,
  ).length;

  const portionSplits: PortionSplit[] = resolvedPortions.map((p) => {
    let commonAllocation = 0;
    if (unaccountedCommonUnits > 0) {
      if (bill.commonLoadHandling === "equal_split") {
        const count = activePortionCount > 0 ? activePortionCount : resolvedPortions.length;
        if (count > 0 && (activePortionCount === 0 || p.calculatedUnits > 0)) {
          commonAllocation = Math.round((unaccountedCommonUnits / count) * 10) / 10;
        }
      } else if (
        bill.commonLoadHandling === "proportional" &&
        totalSubmeterUnits > 0
      ) {
        commonAllocation =
          Math.round(
            (unaccountedCommonUnits * (p.calculatedUnits / totalSubmeterUnits)) *
              10,
          ) / 10;
      }
    }

    const effectiveTotalUnits =
      Math.round((p.calculatedUnits + commonAllocation) * 10) / 10;

    const unitsSharePct =
      mainBilledUnits > 0
        ? Math.round((effectiveTotalUnits / mainBilledUnits) * 1000) / 10
        : totalSubmeterUnits > 0
        ? Math.round((p.calculatedUnits / totalSubmeterUnits) * 1000) / 10
        : 0;

    const totalPayablePkr = Math.round(
      (unitsSharePct / 100) * totalBillPkr,
    );

    // Approximate Base Energy vs Taxes (typically in Pakistan, taxes + FPA represent 28-34% of bill)
    const baseEnergyPkr = Math.round(totalPayablePkr * 0.7);
    const taxesAndLeviesPkr = Math.max(0, totalPayablePkr - baseEnergyPkr);
    const effectiveRate =
      effectiveTotalUnits > 0 ? totalPayablePkr / effectiveTotalUnits : blendedRatePerKwh;

    // Generate formatted WhatsApp rent slip
    const tenantIdentifier = p.tenantName ? ` (${p.tenantName})` : "";
    const readingDetails =
      p.currentReading != null && p.previousReading != null
        ? `\n🔢 *Sub-Meter Reading:* ${p.currentReading} - ${p.previousReading} = ${p.calculatedUnits} kWh`
        : `\n⚡ *Sub-Meter Units:* ${p.calculatedUnits} kWh`;

    const commonLine =
      commonAllocation > 0
        ? `\n💡 *Shared Common Load:* +${commonAllocation} kWh (${bill.commonLoadHandling === "equal_split" ? "Equal share" : "Proportional share"})`
        : "";

    const dueDateLine = bill.dueDate ? `\n📅 *Due Date:* ${bill.dueDate}` : "";

    const whatsappText = `*GharFlow AI · Electricity Sub-Meter Slip*
🏠 *Portion:* ${p.name}${tenantIdentifier}
⚡ *Provider:* ${bill.discoName} (Ref: ${bill.referenceNumber.slice(-6)})
🗓️ *Month:* ${bill.billMonth}${readingDetails}${commonLine}
📊 *Total Billed Units:* ${effectiveTotalUnits} kWh (${unitsSharePct}% of total ${mainBilledUnits} kWh)
📈 *Blended Tariff Rate:* ~Rs ${effectiveRate.toFixed(2)}/kWh
------------------------------------
• Base Energy Share: Rs ${baseEnergyPkr.toLocaleString()}
• Shared Taxes, Levies & FPA: Rs ${taxesAndLeviesPkr.toLocaleString()}
------------------------------------
💳 *Total Payable:* *Rs ${totalPayablePkr.toLocaleString()}*${dueDateLine}

_Generated via GharFlow AI Sub-Meter Fair-Share Reconciliation._`;

    return {
      portionId: p.id,
      portionName: p.name,
      tenantName: p.tenantName,
      submeterUnits: p.calculatedUnits,
      commonUnitsAllocated: commonAllocation,
      effectiveTotalUnits,
      unitsSharePct,
      baseEnergyPkr,
      taxesAndLeviesPkr,
      totalPayablePkr,
      effectiveRatePerKwh: Math.round(effectiveRate * 100) / 100,
      whatsappText,
    };
  });

  // Reconcile rounding discrepancy to guarantee sum of portions matches totalBillPkr to the exact rupee
  const calculatedTotalPayable = portionSplits.reduce((sum, p) => sum + p.totalPayablePkr, 0);
  const diffPkr = totalBillPkr - calculatedTotalPayable;
  if (diffPkr !== 0 && portionSplits.length > 0) {
    const highestIdx = portionSplits.reduce(
      (maxIdx, p, idx, arr) => (p.totalPayablePkr > arr[maxIdx].totalPayablePkr ? idx : maxIdx),
      0,
    );
    portionSplits[highestIdx].totalPayablePkr += diffPkr;
    portionSplits[highestIdx].taxesAndLeviesPkr = Math.max(
      0,
      portionSplits[highestIdx].totalPayablePkr - portionSplits[highestIdx].baseEnergyPkr,
    );
  }

  return {
    totalSubmeterUnits,
    mainBilledUnits,
    unaccountedCommonUnits,
    unaccountedRatioPct,
    totalBillPkr,
    blendedRatePerKwh: Math.round(blendedRatePerKwh * 100) / 100,
    portions: portionSplits,
    reconciliationStatus,
    alertMessage,
  };
}
