import type { Bill } from "./types";
export type TimelineMonth = {
  month: string;
  bills: Bill[];
  state: "saved" | "missing" | "duplicate";
};
const monthIndex = (date: string) =>
  Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
const monthDate = (index: number) =>
  `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
export function connectionTimeline(
  bills: Bill[],
  reference: string,
): TimelineMonth[] {
  const active = bills.filter(
    (bill) => !bill.supersededById && bill.referenceNumber === reference,
  );
  if (!active.length) return [];
  const months = active.map((bill) => monthIndex(bill.billMonth));
  const end = Math.max(...months),
    start = Math.max(Math.min(...months), end - 23);
  return Array.from({ length: end - start + 1 }, (_, offset) => {
    const date = monthDate(start + offset),
      saved = active.filter(
        (bill) => bill.billMonth.slice(0, 7) === date.slice(0, 7),
      );
    return {
      month: date,
      bills: saved,
      state:
        saved.length === 0
          ? "missing"
          : saved.length > 1
            ? "duplicate"
            : "saved",
    };
  });
}
export type BillComparison = {
  earlier: Bill;
  later: Bill;
  reasons: string[];
  billedUnitsChange: number | null;
  amountChange: number;
  meterKwh: number | null;
  days: number | null;
  dailyKwh: number | null;
  continuityDifference: number | null;
};
const dated = (date: string | null) => {
  if (!date) return null;
  const value = Date.parse(`${date}T00:00:00Z`);
  return Number.isFinite(value) &&
    new Date(value).toISOString().slice(0, 10) === date
    ? value
    : null;
};
export function compareBills(
  bills: Bill[],
  firstId: string,
  secondId: string,
): BillComparison | null {
  const first = bills.find((bill) => bill.id === firstId),
    second = bills.find((bill) => bill.id === secondId);
  if (!first || !second || first.id === second.id) return null;
  const [earlier, later] = [first, second].sort((a, b) =>
    a.billMonth.localeCompare(b.billMonth),
  );
  const reasons: string[] = [];
  if (earlier.referenceNumber !== later.referenceNumber)
    reasons.push("The bills belong to different electricity connections.");
  if (earlier.supersededById || later.supersededById)
    reasons.push(
      "A selected bill is superseded. Select its active replacement.",
    );
  if (monthIndex(later.billMonth) - monthIndex(earlier.billMonth) !== 1)
    reasons.push(
      "These are not consecutive billing months. A monthly meter comparison is unavailable.",
    );
  if (
    [earlier, later].some(
      (selected) =>
        bills.filter(
          (bill) =>
            !bill.supersededById &&
            bill.referenceNumber === selected.referenceNumber &&
            bill.billMonth.slice(0, 7) === selected.billMonth.slice(0, 7),
        ).length !== 1,
    )
  )
    reasons.push(
      "An active billing period has duplicate versions. Resolve the versions before comparing.",
    );
  if (!earlier.confirmedAt || !later.confirmedAt)
    reasons.push("Both bill records must have confirmed source values.");
  if (
    earlier.meterType !== "conventional" ||
    later.meterType !== "conventional"
  )
    reasons.push("This comparison supports conventional domestic meters only.");
  if (earlier.readingStatus !== "actual" || later.readingStatus !== "actual")
    reasons.push(
      "Both readings must be confirmed as actual, not estimated or unknown.",
    );
  if (
    !earlier.meterIdentity ||
    !later.meterIdentity ||
    earlier.meterIdentity !== later.meterIdentity
  )
    reasons.push(
      "Matching meter identity is required; a changed or unknown meter cannot be compared.",
    );
  if (earlier.multiplier !== later.multiplier)
    reasons.push("The meter multiplier changed between these bills.");
  const values = [
    earlier.previousReading,
    earlier.currentReading,
    later.previousReading,
    later.currentReading,
  ];
  if (values.some((value) => value === null))
    reasons.push("Previous and current readings are needed on both bills.");
  if (
    [earlier, later].some(
      (bill) =>
        bill.currentReading !== null &&
        bill.previousReading !== null &&
        bill.currentReading < bill.previousReading,
    )
  )
    reasons.push(
      "A reading decrease may indicate a reset or rollover; consumption cannot be inferred.",
    );
  const continuityDifference =
    earlier.currentReading !== null && later.previousReading !== null
      ? later.previousReading - earlier.currentReading
      : null;
  if (continuityDifference !== null && Math.abs(continuityDifference) > 1)
    reasons.push(
      "The earlier current reading does not match the later previous reading within the rule tolerance of one meter unit.",
    );
  const from = dated(earlier.readingDate),
    to = dated(later.readingDate);
  const days = from !== null && to !== null ? (to - from) / 86400000 : null;
  if (days === null || days <= 0)
    reasons.push("Two valid reading dates in increasing order are required.");
  if (
    earlier.currentReading !== null &&
    later.currentReading !== null &&
    later.currentReading < earlier.currentReading
  )
    reasons.push(
      "The meter moved backwards between bills. Check for a meter reset or replacement.",
    );
  const meterKwh =
    reasons.length === 0 &&
    earlier.currentReading !== null &&
    later.currentReading !== null
      ? (later.currentReading - earlier.currentReading) * later.multiplier
      : null;
  return {
    earlier,
    later,
    reasons,
    continuityDifference,
    billedUnitsChange:
      earlier.billedUnits !== null && later.billedUnits !== null
        ? later.billedUnits - earlier.billedUnits
        : null,
    amountChange: later.totalAmount - earlier.totalAmount,
    meterKwh,
    days,
    dailyKwh:
      meterKwh !== null && days !== null && days > 0 ? meterKwh / days : null,
  };
}
