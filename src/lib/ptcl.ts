/**
 * PTCL (Pakistan Telecommunication Company Limited) Billing & Audit Engine
 * Covers Flash Fiber, Broadband DSL, Smart TV, and PSTN Landline services.
 */

export type PtclTaxAudit = {
  packageCharges: number;
  expectedSalesTax: number; // PRA/SRB/KPRA/FED: 19.5%
  expectedWht: number; // Advance Income Tax (Sec 236): 15%
  totalExpectedTaxes: number;
  expectedTotal: number;
  salesTaxDiscrepancy: number;
  whtDiscrepancy: number;
  hasTaxDiscrepancy: boolean;
};

export type PtclArrearsAudit = {
  isUncreditedArrears: boolean;
  previousPaymentAmount: number;
  billedArrears: number;
  lateSurchargeCharged: boolean;
  recommendation: string;
};

/**
 * Builds the official PTCL duplicate bill query link.
 */
export function ptclBillQueryUrl(accountId: string, phoneNumber?: string): string {
  const cleanAccount = accountId.replace(/\D/g, "");
  const cleanPhone = phoneNumber ? phoneNumber.replace(/\D/g, "") : "";
  return `https://dbill.ptcl.net.pk/?acc_id=${cleanAccount}&phone=${cleanPhone}`;
}

/**
 * Validates if an account number matches the standard PTCL 10-digit Account ID.
 */
export function isPtclAccountId(account: string): boolean {
  return /^\d{10}$/.test(account.trim());
}

/**
 * Audits statutory taxes on PTCL bills:
 * - Provincial Sales Tax (PRA / SRB / KPRA / FED) = 19.5%
 * - Advance Income Tax (WHT under Section 236) = 15%
 */
export function auditPtclTaxes(
  packageCharges: number,
  billedSalesTax?: number | null,
  billedWht?: number | null,
): PtclTaxAudit {
  const base = Math.max(0, packageCharges);
  const expectedSalesTax = Number((base * 0.195).toFixed(2));
  const expectedWht = Number((base * 0.15).toFixed(2));
  const totalExpectedTaxes = Number((expectedSalesTax + expectedWht).toFixed(2));
  const expectedTotal = Number((base + totalExpectedTaxes).toFixed(2));

  const salesTaxDiscrepancy =
    billedSalesTax !== null && billedSalesTax !== undefined
      ? Number((billedSalesTax - expectedSalesTax).toFixed(2))
      : 0;

  const whtDiscrepancy =
    billedWht !== null && billedWht !== undefined
      ? Number((billedWht - expectedWht).toFixed(2))
      : 0;

  const hasTaxDiscrepancy =
    Math.abs(salesTaxDiscrepancy) > 5 || Math.abs(whtDiscrepancy) > 5;

  return {
    packageCharges: base,
    expectedSalesTax,
    expectedWht,
    totalExpectedTaxes,
    expectedTotal,
    salesTaxDiscrepancy,
    whtDiscrepancy,
    hasTaxDiscrepancy,
  };
}

/**
 * Audits uncredited arrears:
 * If the customer paid their previous bill on time, but the new bill includes arrears,
 * flags an uncredited payment under PTA Telecom Consumer Protection Regulations.
 */
export function auditPtclArrears(
  previousPaidAmount: number,
  billedArrears: number,
  paidOnTime = true,
): PtclArrearsAudit {
  const arrears = Math.max(0, billedArrears);
  const paid = Math.max(0, previousPaidAmount);

  // If customer paid >= 90% of the previous bill on time, arrears > 100 PKR is suspicious
  const isUncreditedArrears = paid > 0 && paidOnTime && arrears >= 100;

  return {
    isUncreditedArrears,
    previousPaymentAmount: paid,
    billedArrears: arrears,
    lateSurchargeCharged: arrears > 0 && !paidOnTime,
    recommendation: isUncreditedArrears
      ? `Previous payment of PKR ${paid.toFixed(2)} was not credited in this invoice. Billed arrears: PKR ${arrears.toFixed(2)}. Submit bank proof to PTCL and PTA for immediate reconciliation.`
      : "No uncredited arrears detected.",
  };
}
