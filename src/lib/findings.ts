export const RULE_VERSION = "2.0.0";
export type BillRecord = {
  id: string; referenceNumber: string; billMonth: string; previousReading: number | null;
  currentReading: number | null; multiplier: number; billedUnits: number | null;
  totalAmount: number; dueDate: string | null;
  meterIdentity: string | null; readingDate: string | null;
  readingStatus: "actual" | "estimated" | "unknown";
  meterType: "conventional" | "unsupported" | "unknown";
  supersededById: string | null;
};
export type PaymentRecord = { billId: string; amount: number; paidAt: string };
export type ReadingRecord = { id: string; referenceNumber: string | null; meterIdentity: string | null; readingDate: string; readingValue: number; multiplier: number; meterType: "conventional" | "unsupported" | "unknown" };
export type Finding = { id: string; billId: string; kind: "review" | "info"; title: string; detail: string; evidence: string[]; relatedBillIds: string[]; readingIds: string[]; missing: string[]; ruleVersion: string };
const near = (a: number, b: number, tolerance = 1) => Math.abs(a - b) <= tolerance;
const monthIndex = (date: string) => Number(date.slice(0,4))*12 + Number(date.slice(5,7));
const comparable = (a: BillRecord, b: BillRecord) => a.meterType === "conventional" && b.meterType === "conventional" && a.readingStatus === "actual" && b.readingStatus === "actual" && !!a.meterIdentity && a.meterIdentity === b.meterIdentity && a.multiplier === b.multiplier;

export function analyze(bills: BillRecord[], payments: PaymentRecord[], readings: ReadingRecord[] = []): Finding[] {
  const findings: Finding[] = [];
  const active = bills.filter((bill) => !bill.supersededById).sort((a,b) => a.billMonth.localeCompare(b.billMonth) || a.id.localeCompare(b.id));
  for (const bill of active) {
    const add = (code: string, title: string, detail: string, evidence: string[] = [], kind: Finding["kind"] = "review", relatedBillIds: string[] = [], readingIds: string[] = [], missing: string[] = []) => findings.push({ id: `${bill.id}:${code}`, billId: bill.id, kind, title, detail, evidence, relatedBillIds, readingIds, missing, ruleVersion: RULE_VERSION });
    const receiptTotal = payments.filter((payment) => payment.billId === bill.id).reduce((sum,payment) => sum+payment.amount,0);
    if (receiptTotal > 0 && !near(receiptTotal,bill.totalAmount,.01)) add("payment", "Receipt total differs from bill", `Entered receipts total PKR ${receiptTotal.toFixed(2)} versus billed PKR ${bill.totalAmount.toFixed(2)}. This does not verify utility posting or account balance.`, [`Receipt total ${receiptTotal}`,`Bill total ${bill.totalAmount}`]);
    if (bill.meterType !== "conventional") { add("unsupported", "Confirm the meter arrangement", "These checks support conventional domestic meters. Unknown, time-of-use and net-billing arrangements need a different calculation.", [], "info", [], [], ["Conventional meter arrangement"]); continue; }
    if (bill.readingStatus !== "actual") add("status", "Reading basis is not confirmed", "Estimated or unknown readings cannot establish an actual meter discrepancy. Confirm the reading basis on the original bill.", [], "info", [], [], ["Actual reading status"]);
    else if (bill.previousReading !== null && bill.currentReading !== null && bill.billedUnits !== null) {
      const calculated = (bill.currentReading - bill.previousReading)*bill.multiplier;
      if (calculated < 0) add("reset", "Check for a meter reset or rollover", "The current reading is below the previous reading. Confirm meter replacement or rollover before calculating units.", [`Previous ${bill.previousReading}`,`Current ${bill.currentReading}`], "info", [], [], ["Meter reset or rollover explanation"]);
      else if (!near(calculated,bill.billedUnits)) add("units", "Check the billed units", `Confirmed readings imply ${calculated.toFixed(2)} kWh, while the bill states ${bill.billedUnits.toFixed(2)} kWh. Review the source fields before contacting the utility.`, [`(${bill.currentReading} − ${bill.previousReading}) × ${bill.multiplier} = ${calculated.toFixed(2)} kWh`, `Billed ${bill.billedUnits} kWh`, `Difference ${(bill.billedUnits-calculated).toFixed(2)} kWh`]);
    } else add("missing", "Add readings to check units", "Confirmed readings and billed units are needed for the arithmetic check.", [], "info", [], [], ["Previous reading, current reading and billed units"]);
    const peers = active.filter((other) => other.referenceNumber === bill.referenceNumber);
    if (peers.filter((other) => other.billMonth === bill.billMonth).length > 1) add("duplicate", "Resolve duplicate bill versions", "Several active bills share this connection and month. Mark a revised bill as a replacement before comparing months.", [bill.billMonth], "review", peers.filter((other) => other.billMonth === bill.billMonth && other.id !== bill.id).map((other) => other.id));
    const previousMonth = peers.filter((other) => monthIndex(bill.billMonth)-monthIndex(other.billMonth) === 1);
    const currentUnique = peers.filter((other) => other.billMonth === bill.billMonth).length === 1;
    if (previousMonth.length === 1 && currentUnique && comparable(previousMonth[0],bill)) {
      const earlier = previousMonth[0];
      if (earlier.currentReading !== null && bill.previousReading !== null && !near(earlier.currentReading,bill.previousReading,.01)) add("continuity", "Check the reading carried forward", `The previous month ended at ${earlier.currentReading}, but this month starts at ${bill.previousReading}.`, [earlier.billMonth,bill.billMonth,`Meter ${bill.meterIdentity}`], "review", [earlier.id]);
      if (earlier.billedUnits !== null && bill.billedUnits !== null && earlier.billedUnits > 0 && bill.billedUnits > earlier.billedUnits*1.5 && bill.billedUnits-earlier.billedUnits >= 50) add("jump", "Usage rose sharply", `Billed units rose from ${earlier.billedUnits} to ${bill.billedUnits}. Seasons, occupancy and appliances can explain a change; this alone does not prove an error.`, [earlier.billMonth,bill.billMonth], "review", [earlier.id]);
    } else add("comparison", "Monthly comparison unavailable", "Continuity needs one active bill in each consecutive month, matching meter identity and multiplier, and actual readings.", [], "info", [], [], ["Consecutive, unique actual bills for the same meter"]);
    const observations = readings.filter((reading) => reading.referenceNumber === bill.referenceNumber && !!bill.meterIdentity && reading.meterIdentity === bill.meterIdentity && reading.readingDate === bill.readingDate && reading.multiplier === bill.multiplier && reading.meterType === "conventional");
    if (bill.readingStatus === "actual" && bill.currentReading !== null && observations.length === 1) {
      const observation = observations[0];
      if (!near(observation.readingValue,bill.currentReading,.01)) add("observation", "Your dated reading differs", `Your observation is ${observation.readingValue}; the bill reading is ${bill.currentReading}. Even on the same date, readings taken at different times may differ. Inspect both sources.`, [`Date ${bill.readingDate}`,`Meter ${bill.meterIdentity}`], "review", [], [observation.id]);
    } else add("observation_missing", "Add matching dated evidence", "A household observation can be compared only when its date, connection, meter and multiplier match the bill.", [], "info", [], [], ["One matching dated meter observation"]);

  }
  return findings;
}

export function consumptionPlan(readings: ReadingRecord[], referenceNumber: string, meterIdentity: string, reductionPercent: number) {
  if (!Number.isFinite(reductionPercent) || reductionPercent < 0 || reductionPercent > 50 || !meterIdentity) return null;
  const sorted = readings.filter((reading) => reading.referenceNumber === referenceNumber && reading.meterIdentity === meterIdentity && reading.meterType === "conventional").sort((a,b) => b.readingDate.localeCompare(a.readingDate));
  if (sorted.length < 2) return null;
  const [latest,earlier] = sorted;
  const days = (Date.parse(latest.readingDate)-Date.parse(earlier.readingDate))/86400000;
  if (days <= 0 || latest.readingValue < earlier.readingValue || latest.multiplier !== earlier.multiplier) return null;
  const dailyKwh = (latest.readingValue-earlier.readingValue)*latest.multiplier/days;
  return { dailyKwh, targetDailyKwh: dailyKwh*(1-reductionPercent/100), target30DayKwh: dailyKwh*30*(1-reductionPercent/100), days, from: earlier.readingDate, to: latest.readingDate };
}
