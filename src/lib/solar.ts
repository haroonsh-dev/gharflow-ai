/**
 * Solar Net-Metering & Green Meter Forensic Engine
 * Compliance engine for NEPRA (Alternative & Renewable Energy) Distributed Generation
 * and Net Metering Regulations, 2015.
 */

export type SolarNetMeteringInput = {
  importOffPeakUnits: number; // Consumed from grid during off-peak
  importPeakUnits: number; // Consumed from grid during peak (5 PM - 11 PM)
  exportOffPeakUnits: number; // Sent to grid from rooftop solar
  exportPeakUnits?: number; // In rare three-phase meters with peak export
  previousBankKwh?: number; // Carried-over credit units from last month
  billedTotalPkr?: number; // Actual amount billed on the DISCO bill
  nationalBuybackRatePkr?: number; // NEPRA buyback rate (default: Rs 26.50/kWh)
  peakTariffRatePkr?: number; // Peak hour tariff rate (default: Rs 49.50/kWh)
  offPeakTariffRatePkr?: number; // Off-peak base tariff rate (default: Rs 34.00/kWh)
};

export type SolarNetMeteringAuditResult = {
  netOffPeakUnits: number; // Positive = owed to DISCO; Negative = excess solar exported
  isNetExporter: boolean;
  excessExportUnits: number; // Units added to solar credit bank
  peakChargesPkr: number; // Peak units cannot be offset by off-peak export
  offPeakChargesPkr: number; // Billed if import > export
  solarCreditPkr: number; // Monetary credit if net exporter
  netPayableEstimatedPkr: number; // Final estimated payable (can be negative = credit)
  discrepancies: {
    code: string;
    severity: "warning" | "violation" | "info";
    title: string;
    detail: string;
    ruleCitation: string;
  }[];
  solarSelfSufficiencyPct: number; // % of total consumption offset by solar
};

export const NEPRA_DEFAULT_BUYBACK_RATE = 26.5;
export const NEPRA_DEFAULT_PEAK_RATE = 49.5;
export const NEPRA_DEFAULT_OFFPEAK_RATE = 34.0;

/**
 * Audits Green Meter bi-directional billing records against NEPRA Net Metering Regulations.
 */
export function auditSolarNetMetering(
  input: SolarNetMeteringInput,
): SolarNetMeteringAuditResult {
  const buybackRate = input.nationalBuybackRatePkr ?? NEPRA_DEFAULT_BUYBACK_RATE;
  const peakRate = input.peakTariffRatePkr ?? NEPRA_DEFAULT_PEAK_RATE;
  const offPeakRate = input.offPeakTariffRatePkr ?? NEPRA_DEFAULT_OFFPEAK_RATE;
  const previousBank = input.previousBankKwh ?? 0;

  const totalExport = input.exportOffPeakUnits + (input.exportPeakUnits ?? 0) + previousBank;
  const netOffPeak = input.importOffPeakUnits - totalExport;
  const isNetExporter = netOffPeak < 0;
  const excessUnits = isNetExporter ? Math.abs(netOffPeak) : 0;

  // Peak units are non-offsettable under NEPRA Net Metering Regulations Section 8(2)
  const peakCharges = Math.round(input.importPeakUnits * peakRate);
  const offPeakCharges = !isNetExporter ? Math.round(netOffPeak * offPeakRate) : 0;
  const solarCredit = isNetExporter ? Math.round(excessUnits * buybackRate) : 0;

  const netPayable = peakCharges + offPeakCharges - solarCredit;

  // Discrepancy checks
  const discrepancies: SolarNetMeteringAuditResult["discrepancies"] = [];

  // Check 1: Did DISCO bill excess export as zero or fail to apply credit?
  if (isNetExporter && input.billedTotalPkr !== undefined) {
    // If net exporter, total bill should only be peak charges minus solar credit (+ fixed meter rent)
    const expectedMax = Math.max(0, peakCharges - solarCredit) + 500; // 500 tolerance for meter rent & duty
    if (input.billedTotalPkr > expectedMax + 1000) {
      discrepancies.push({
        code: "uncredited_solar_export",
        severity: "violation",
        title: "Uncredited Solar Generation Export",
        detail: `You exported ${excessUnits} excess kWh (value ~PKR ${solarCredit}), but your bill of PKR ${input.billedTotalPkr.toLocaleString()} exceeds the expected peak net of PKR ${expectedMax.toLocaleString()}.`,
        ruleCitation: "NEPRA Net Metering Regulations (2015) Reg 8(3) - Settlement of Excess Energy",
      });
    }
  }

  // Check 2: Low buyback rate check
  if (isNetExporter && input.billedTotalPkr !== undefined && solarCredit > 0) {
    discrepancies.push({
      code: "solar_bank_carried_forward",
      severity: "info",
      title: `${excessUnits} kWh Banked with National Grid`,
      detail: `Your ${excessUnits} kWh excess export is available either as a credit of PKR ${solarCredit.toLocaleString()} or as a unit bank balance for winter months.`,
      ruleCitation: "NEPRA Net Metering Regulations Reg 8(2)",
    });
  }

  // Check 3: Self-sufficiency
  const totalConsumption = input.importOffPeakUnits + input.importPeakUnits;
  const totalSolarGenerated = totalExport;
  const sufficiency =
    totalConsumption > 0
      ? Math.min(100, Math.round((totalSolarGenerated / totalConsumption) * 100))
      : 100;

  return {
    netOffPeakUnits: netOffPeak,
    isNetExporter,
    excessExportUnits: excessUnits,
    peakChargesPkr: peakCharges,
    offPeakChargesPkr: offPeakCharges,
    solarCreditPkr: solarCredit,
    netPayableEstimatedPkr: netPayable,
    discrepancies,
    solarSelfSufficiencyPct: sufficiency,
  };
}
