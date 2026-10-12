export type BillRecord = {
  id: string; referenceNumber: string; billMonth: string; previousReading: number | null;
  currentReading: number | null; multiplier: number; billedUnits: number | null;
  totalAmount: number; dueDate: string | null;
};
export type PaymentRecord = { billId: string; amount: number; paidAt: string };
export type Finding = { id: string; billId: string; kind: "review" | "info"; title: string; detail: string; evidence: string[] };

const near = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;

export function analyze(bills: BillRecord[], payments: PaymentRecord[]): Finding[] {
  const findings: Finding[] = [];
  const sorted = [...bills].sort((a, b) => a.billMonth.localeCompare(b.billMonth));
  for (const [index, bill] of sorted.entries()) {
    const add = (id: string, title: string, detail: string, evidence: string[], kind: Finding["kind"] = "review") => findings.push({ id: `${bill.id}:${id}`, billId: bill.id, kind, title, detail, evidence });
    if (bill.previousReading !== null && bill.currentReading !== null && bill.billedUnits !== null) {
      const calculated = (bill.currentReading - bill.previousReading) * bill.multiplier;
      if (calculated < 0 || !near(calculated, bill.billedUnits)) add("units", "Check the billed units", `Readings and multiplier imply ${calculated.toFixed(2)} units, while the bill states ${bill.billedUnits.toFixed(2)}. Confirm the meter and bill fields.`, [`Previous ${bill.previousReading}`, `Current ${bill.currentReading}`, `Multiplier ${bill.multiplier}`, `Billed ${bill.billedUnits}`]);
    } else add("missing", "Add readings to check units", "The bill does not have enough confirmed readings to compare billed units.", [], "info");
    const earlier = sorted.slice(0, index).reverse().find((candidate) => candidate.referenceNumber === bill.referenceNumber);
    if (earlier && earlier.currentReading !== null && bill.previousReading !== null && !near(earlier.currentReading, bill.previousReading, 0.01)) add("continuity", "Check the reading carried forward", `The previous bill ended at ${earlier.currentReading}, while this bill starts at ${bill.previousReading}. Confirm both documents and any meter change.`, [earlier.billMonth, bill.billMonth]);
    if (sorted.some((other) => other.id !== bill.id && other.referenceNumber === bill.referenceNumber && other.billMonth === bill.billMonth)) add("duplicate", "Possible duplicate bill period", "Two records share this reference number and bill month. Check whether one is a revised bill.", [bill.referenceNumber, bill.billMonth]);
    if (earlier?.billedUnits != null && bill.billedUnits != null && earlier.billedUnits > 0 && bill.billedUnits > earlier.billedUnits * 1.5 && bill.billedUnits - earlier.billedUnits >= 50) add("jump", "Usage rose sharply", `Billed units rose from ${earlier.billedUnits} to ${bill.billedUnits}. Seasons, occupancy, and appliances can explain changes; review before treating this as an error.`, [earlier.billMonth, bill.billMonth]);
    const receiptTotal = payments.filter((payment) => payment.billId === bill.id).reduce((sum, payment) => sum + payment.amount, 0);
    if (receiptTotal > 0 && !near(receiptTotal, bill.totalAmount, 0.01)) add("payment", "Receipt total differs from bill", `Entered receipts total PKR ${receiptTotal.toFixed(2)} versus billed PKR ${bill.totalAmount.toFixed(2)}. This does not verify utility posting or account balance.`, [`Receipt total ${receiptTotal}`, `Bill total ${bill.totalAmount}`]);
  }
  return findings;
}

export function savingsScenario(bills: BillRecord[], reductionPercent: number): { monthlyPkr: number; basis: string } | null {
  const withUnits = bills.filter((bill) => bill.billedUnits !== null && bill.billedUnits > 0);
  if (!withUnits.length || !Number.isFinite(reductionPercent) || reductionPercent < 0 || reductionPercent > 50) return null;
  const recent = [...withUnits].sort((a, b) => b.billMonth.localeCompare(a.billMonth)).slice(0, 3);
  const mean = recent.reduce((sum, bill) => sum + bill.totalAmount, 0) / recent.length;
  return { monthlyPkr: Math.round(mean * reductionPercent / 100), basis: `Approximation from ${recent.length} recent bill${recent.length === 1 ? "" : "s"}; tariffs, fixed charges and taxes may change the actual saving.` };
}
