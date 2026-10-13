import type { Bill } from "./types";
const rawFields: Record<string, string> = {
  referenceNumber: "reference_number",
  previousReading: "previous_reading",
  currentReading: "current_reading",
  billedUnits: "billed_units",
  totalAmount: "total_amount",
  meterIdentity: "meter_identity",
  readingDate: "reading_date",
};
export const fieldName = (key: string) => {
  const words = key.replace(/([a-z])([A-Z])/g, "$1 $2").replaceAll("_", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
};
export function sourceDescription(bill: Bill, key: string, source: string) {
  if (!bill.confirmedAt) return "Legacy record; confirmation unavailable";
  if (source === "user") return "User confirmed / manual";
  if (source !== "ocr") return "Source label unavailable";
  const candidate = bill.extraction?.candidates[rawFields[key]];
  const value = bill[key as keyof Bill];
  const matches =
    candidate &&
    (typeof value === "number"
      ? Number(candidate.value) === value
      : candidate.value === value);
  return matches
    ? "Matches OCR candidate; user confirmed"
    : "Legacy OCR label; provenance unavailable";
}
