import type { Finding } from "./findings";
export type FindingCode =
  | "units"
  | "payment"
  | "unsupported"
  | "status"
  | "reset"
  | "missing"
  | "duplicate"
  | "continuity"
  | "jump"
  | "comparison"
  | "observation"
  | "observation_missing";
export type InvestigationAction = {
  kind: "bill" | "reading" | "payment" | "previousBill" | "case";
  billId?: string;
  label: string;
  description: string;
};
export function findingCode(finding: Finding): FindingCode {
  return finding.code ?? (finding.id.split(":").at(-1) as FindingCode);
}
export function guidance(finding: Finding): InvestigationAction[] {
  const inspect: InvestigationAction = {
    kind: "bill",
    label: "Inspect this bill",
    description: "Check confirmed fields against the original document.",
  };
  switch (findingCode(finding)) {
    case "payment":
      return [
        inspect,
        {
          kind: "payment",
          label: "Review receipts",
          description:
            "Check amounts and whether each receipt belongs to this bill. Payment posting is unverified.",
        },
      ];
    case "observation":
    case "observation_missing":
      return [
        inspect,
        {
          kind: "reading",
          label: "Add matching observation",
          description:
            "Use the bill date, connection, meter identity and multiplier. Do not invent a historical reading.",
        },
      ];
    case "comparison":
      if (finding.unavailableReason === "duplicate_versions")
        return [
          {
            ...inspect,
            description:
              "Resolve duplicate versions before adding more bills or comparing months.",
          },
        ];
      if (finding.unavailableReason === "meter_metadata")
        return [
          inspect,
          {
            kind: "bill",
            billId: finding.relatedBillIds[0],
            label: "Inspect previous bill",
            description:
              "Check meter identity, multiplier, arrangement and reading basis. A meter change can legitimately prevent comparison.",
          },
        ];
      return [
        inspect,
        {
          kind: "previousBill",
          label: "Add the previous month",
          description:
            "Upload the consecutive month's bill for the same meter, or record why it is unavailable.",
        },
      ];
    case "duplicate":
      return [
        {
          ...inspect,
          description:
            "Inspect the active versions and mark a revised bill as a replacement only when supported by the document.",
        },
      ];
    case "unsupported":
      return [
        {
          ...inspect,
          description:
            "Confirm the meter arrangement. Unsupported arrangements cannot use these checks.",
        },
      ];
    case "status":
      return [
        {
          ...inspect,
          description:
            "Confirm whether the utility reading is actual, estimated or unknown from the original.",
        },
      ];
    case "reset":
      return [
        {
          ...inspect,
          description:
            "Check for a replacement or rollover. Do not treat a negative difference as consumption.",
        },
      ];
    case "missing":
      return [
        {
          ...inspect,
          description:
            "Add missing source values only when the bill or another record supports them.",
        },
      ];
    default:
      return [inspect];
  }
}
export const checklistLabels = {
  inspectSource: "Inspect original source values",
  checkRecords: "Check supporting records",
  prepareReport: "Prepare an evidence report",
  recordOutcome: "Record the user-reported outcome",
} as const;
