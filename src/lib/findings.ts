export const RULE_VERSION = "2.1.0";
export type BillRecord = {
  id: string;
  evidenceFileId?: string | null;
  referenceNumber: string;
  billMonth: string;
  previousReading: number | null;
  currentReading: number | null;
  multiplier: number;
  billedUnits: number | null;
  totalAmount: number;
  dueDate: string | null;
  meterIdentity: string | null;
  readingDate: string | null;
  readingStatus: "actual" | "estimated" | "unknown";
  meterType: "conventional" | "unsupported" | "unknown";
  supersededById: string | null;
};
export type PaymentRecord = { billId: string; amount: number; paidAt: string };
export type ReadingRecord = {
  id: string;
  referenceNumber: string | null;
  meterIdentity: string | null;
  readingDate: string;
  readingValue: number;
  multiplier: number;
  meterType: "conventional" | "unsupported" | "unknown";
};
import type { FindingCode } from "./guidance";
import { auditBillingCycleDays } from "./tariffs";
import { isPtclAccountId } from "./ptcl";
export type Finding = {
  code?: FindingCode;
  unavailableReason?:
    | "missing_previous"
    | "duplicate_versions"
    | "meter_metadata";
  id: string;
  billId: string;
  kind: "review" | "info";
  title: string;
  detail: string;
  evidence: string[];
  relatedBillIds: string[];
  readingIds: string[];
  missing: string[];
  ruleVersion: string;
};
const kwh = (value: number) =>
  new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
    useGrouping: false,
  }).format(value);
const near = (a: number, b: number, tolerance = 1) =>
  Math.abs(a - b) <= tolerance;
const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7));
const comparable = (a: BillRecord, b: BillRecord) =>
  a.meterType === "conventional" &&
  b.meterType === "conventional" &&
  a.readingStatus === "actual" &&
  b.readingStatus === "actual" &&
  !!a.meterIdentity &&
  a.meterIdentity === b.meterIdentity &&
  a.multiplier === b.multiplier;

export function analyze(
  bills: BillRecord[],
  payments: PaymentRecord[],
  readings: ReadingRecord[] = [],
): Finding[] {
  const findings: Finding[] = [];
  const active = bills
    .filter((bill) => !bill.supersededById)
    .sort(
      (a, b) =>
        a.billMonth.localeCompare(b.billMonth) || a.id.localeCompare(b.id),
    );
  for (const bill of active) {
    const add = (
      code: FindingCode,
      title: string,
      detail: string,
      evidence: string[] = [],
      kind: Finding["kind"] = "review",
      relatedBillIds: string[] = [],
      readingIds: string[] = [],
      missing: string[] = [],
    ) =>
      findings.push({
        code,
        id: `${bill.id}:${code}`,
        billId: bill.id,
        kind,
        title,
        detail,
        evidence,
        relatedBillIds,
        readingIds,
        missing:
          bill.evidenceFileId === null
            ? [...missing, "Original bill document is not attached"]
            : missing,
        ruleVersion: RULE_VERSION,
      });
    const receiptTotal = payments
      .filter((payment) => payment.billId === bill.id)
      .reduce((sum, payment) => sum + payment.amount, 0);
    if (receiptTotal > 0 && !near(receiptTotal, bill.totalAmount, 0.01))
      add(
        "payment",
        "Entered payment total differs from bill",
        `Entered payment records total PKR ${receiptTotal.toFixed(2)} versus billed PKR ${bill.totalAmount.toFixed(2)}. This does not verify utility posting or account balance.`,
        [
          `Entered payments total ${receiptTotal}`,
          `Bill total ${bill.totalAmount}`,
        ],
      );
    const peers = active.filter(
      (other) => other.referenceNumber === bill.referenceNumber,
    );
    if (peers.filter((other) => other.billMonth === bill.billMonth).length > 1)
      add(
        "duplicate",
        "Resolve duplicate bill versions",
        "Several active bills share this connection and month. Mark a revised bill as a replacement before comparing months.",
        [bill.billMonth],
        "review",
        peers
          .filter(
            (other) =>
              other.billMonth === bill.billMonth && other.id !== bill.id,
          )
          .map((other) => other.id),
      );
    const isPtcl = isPtclAccountId(bill.referenceNumber);
    if (isPtcl) {
      const previousMonth = peers.filter(
        (other) =>
          monthIndex(bill.billMonth) - monthIndex(other.billMonth) === 1,
      );
      if (previousMonth.length === 1) {
        const prevBill = previousMonth[0];
        const prevPayments = payments.filter((p) => p.billId === prevBill.id);
        const prevPaidTotal = prevPayments.reduce((s, p) => s + p.amount, 0);
        if (
          prevPaidTotal > 0 &&
          bill.totalAmount >= prevBill.totalAmount * 1.7
        ) {
          add(
            "ptcl_arrears_uncredited",
            "Possible uncredited arrears on PTCL bill",
            `Previous bill was paid (PKR ${prevPaidTotal.toFixed(2)}), but current bill increased sharply to PKR ${bill.totalAmount.toFixed(2)}. Check invoice for unpaid arrears carryover under PTA regulations.`,
            [
              `Previous paid: PKR ${prevPaidTotal}`,
              `Current bill: PKR ${bill.totalAmount}`,
              `Account ID: ${bill.referenceNumber}`,
            ],
            "review",
            [prevBill.id],
          );
        }
      }
    }

    if (bill.meterType !== "conventional") {
      if (!isPtcl) {
        add(
          "unsupported",
          "Confirm the meter arrangement",
          "These checks support conventional domestic meters. Unknown, time-of-use and net-billing arrangements need a different calculation.",
          [],
          "info",
          [],
          [],
          ["Conventional meter arrangement"],
        );
      }
      continue;
    }
    if (bill.readingStatus !== "actual")
      add(
        "status",
        "Reading basis is not confirmed",
        "Estimated or unknown readings cannot establish an actual meter discrepancy. Confirm the reading basis on the original bill.",
        [],
        "info",
        [],
        [],
        ["Actual reading status"],
      );
    else if (
      bill.previousReading !== null &&
      bill.currentReading !== null &&
      bill.billedUnits !== null
    ) {
      const calculated =
        (bill.currentReading - bill.previousReading) * bill.multiplier;
      if (calculated < 0)
        add(
          "reset",
          "Check for a meter reset or rollover",
          "The current reading is below the previous reading. Confirm meter replacement or rollover before calculating units.",
          [
            `Previous ${bill.previousReading}`,
            `Current ${bill.currentReading}`,
          ],
          "info",
          [],
          [],
          ["Meter reset or rollover explanation"],
        );
      else if (!near(calculated, bill.billedUnits))
        add(
          "units",
          "Check the billed units",
          `Confirmed readings imply ${kwh(calculated)} kWh, while the bill states ${kwh(bill.billedUnits)} kWh. Review the source fields before contacting the utility.`,
          [
            `(${bill.currentReading} − ${bill.previousReading}) × ${bill.multiplier} = ${kwh(calculated)} kWh`,
            `Billed ${bill.billedUnits} kWh`,
            `Difference ${kwh(bill.billedUnits - calculated)} kWh`,
          ],
        );
    } else
      add(
        "missing",
        "Add readings to check units",
        "Confirmed readings and billed units are needed for the arithmetic check.",
        [],
        "info",
        [],
        [],
        ["Previous reading, current reading and billed units"],
      );
    const previousMonth = peers.filter(
      (other) => monthIndex(bill.billMonth) - monthIndex(other.billMonth) === 1,
    );
    const currentUnique =
      peers.filter((other) => other.billMonth === bill.billMonth).length === 1;
    if (
      previousMonth.length === 1 &&
      currentUnique &&
      comparable(previousMonth[0], bill)
    ) {
      const earlier = previousMonth[0];
      if (
        earlier.currentReading !== null &&
        bill.previousReading !== null &&
        !near(earlier.currentReading, bill.previousReading, 0.01)
      )
        add(
          "continuity",
          "Check the reading carried forward",
          `The previous month ended at ${earlier.currentReading}, but this month starts at ${bill.previousReading}.`,
          [earlier.billMonth, bill.billMonth, `Meter ${bill.meterIdentity}`],
          "review",
          [earlier.id],
        );
      if (
        earlier.billedUnits !== null &&
        bill.billedUnits !== null &&
        earlier.billedUnits > 0 &&
        bill.billedUnits > earlier.billedUnits * 1.5 &&
        bill.billedUnits - earlier.billedUnits >= 50
      )
        add(
          "jump",
          "Usage rose sharply",
          `Billed units rose from ${earlier.billedUnits} to ${bill.billedUnits}. Seasons, occupancy and appliances can explain a change; this alone does not prove an error.`,
          [earlier.billMonth, bill.billMonth],
          "review",
          [earlier.id],
        );
      if (
        earlier.readingDate &&
        bill.readingDate &&
        bill.billedUnits !== null &&
        bill.billedUnits > 0
      ) {
        const cycleAudit = auditBillingCycleDays(
          earlier.readingDate,
          bill.readingDate,
          bill.billedUnits,
        );
        if (cycleAudit && cycleAudit.isOverbilledByDays) {
          add(
            "pro_rata_slab_jump",
            "Extended reading cycle caused slab jump",
            cycleAudit.recommendation,
            [
              `Reading cycle: ${cycleAudit.actualDays} days (normal: ${cycleAudit.standardDays})`,
              `Billed units: ${cycleAudit.billedUnits} kWh`,
              `30-day normalized: ${cycleAudit.normalizedUnits} kWh`,
              cycleAudit.actualSlabThreshold
                ? `Exceeded ${cycleAudit.actualSlabThreshold} kWh slab threshold`
                : `Excess units: ${cycleAudit.excessUnitsAttributedToDelay} kWh`,
            ],
            "review",
            [earlier.id],
          );
        }
      }
    } else {
      const reason =
        !currentUnique || previousMonth.length > 1
          ? "duplicate_versions"
          : previousMonth.length === 0
            ? "missing_previous"
            : "meter_metadata";
      add(
        "comparison",
        "Monthly comparison unavailable",
        "Continuity needs one active bill in each consecutive month, matching meter identity and multiplier, and actual readings.",
        [],
        "info",
        previousMonth.map((item) => item.id),
        [],
        [
          reason === "missing_previous"
            ? "Consecutive previous month bill"
            : reason === "duplicate_versions"
              ? "One active bill version per month"
              : "Matching known meter identity, multiplier, arrangement and actual reading basis",
        ],
      );
      findings[findings.length - 1].unavailableReason = reason;
    }
    const observations = readings.filter(
      (reading) =>
        reading.referenceNumber === bill.referenceNumber &&
        !!bill.meterIdentity &&
        reading.meterIdentity === bill.meterIdentity &&
        reading.readingDate === bill.readingDate &&
        reading.multiplier === bill.multiplier &&
        reading.meterType === "conventional",
    );
    if (
      bill.readingStatus === "actual" &&
      bill.currentReading !== null &&
      observations.length === 1
    ) {
      const observation = observations[0];
      if (!near(observation.readingValue, bill.currentReading, 0.01))
        add(
          "observation",
          "Your dated reading differs",
          `Your observation is ${observation.readingValue}; the bill reading is ${bill.currentReading}. Even on the same date, readings taken at different times may differ. Inspect both sources.`,
          [`Date ${bill.readingDate}`, `Meter ${bill.meterIdentity}`],
          "review",
          [],
          [observation.id],
        );
    } else
      add(
        "observation_missing",
        "Add matching dated evidence",
        "A household observation can be compared only when its date, connection, meter and multiplier match the bill.",
        [],
        "info",
        [],
        [],
        ["One matching dated meter observation"],
      );
  }
  return findings;
}

export function consumptionPlan(
  readings: ReadingRecord[],
  referenceNumber: string,
  meterIdentity: string,
  reductionPercent: number,
) {
  if (
    !Number.isFinite(reductionPercent) ||
    reductionPercent < 0 ||
    reductionPercent > 50 ||
    !meterIdentity
  )
    return null;
  const sorted = readings
    .filter(
      (reading) =>
        reading.referenceNumber === referenceNumber &&
        reading.meterIdentity === meterIdentity &&
        reading.meterType === "conventional",
    )
    .sort((a, b) => b.readingDate.localeCompare(a.readingDate));
  if (sorted.length < 2) return null;
  const [latest, earlier] = sorted;
  const days =
    (Date.parse(latest.readingDate) - Date.parse(earlier.readingDate)) /
    86400000;
  if (
    days <= 0 ||
    latest.readingValue < earlier.readingValue ||
    latest.multiplier !== earlier.multiplier
  )
    return null;
  const dailyKwh =
    ((latest.readingValue - earlier.readingValue) * latest.multiplier) / days;
  return {
    dailyKwh,
    targetDailyKwh: dailyKwh * (1 - reductionPercent / 100),
    target30DayKwh: dailyKwh * 30 * (1 - reductionPercent / 100),
    days,
    from: earlier.readingDate,
    to: latest.readingDate,
  };
}
