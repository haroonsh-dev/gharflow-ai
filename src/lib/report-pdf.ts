import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CaseRecord, Evidence } from "./types";
import { fieldName, sourceDescription } from "./provenance";
import { checklistLabels } from "./guidance";
export async function evidencePdf(record: CaseRecord, documents: Evidence[]) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage();
  let y = 790;
  // Standard PDF fonts are Latin-only. Explicitly substitute unsupported characters; English ships first.
  const printable = (text: string) =>
    text
      .replace(/−/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/→/g, " -> ")
      .replace(/[^\x20-\x7e\n]/g, "?");
  function line(text: string, size = 11) {
    for (const paragraph of printable(text).split("\n")) {
      let current = "";
      for (const word of paragraph
        .split(/\s+/)
        .flatMap((word) =>
          word.length > 65 ? (word.match(/.{1,65}/g) ?? []) : [word],
        )) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > 490 && current) {
          draw(current, size);
          current = word;
        } else current = next;
      }
      draw(current, size);
    }
  }
  function draw(text: string, size: number) {
    if (y < 65) {
      page = pdf.addPage();
      y = 790;
    }
    page.drawText(text, { x: 48, y, size, font, color: rgb(0.1, 0.15, 0.2) });
    y -= size + 7;
  }
  function heading(text: string) {
    y -= 10;
    line(text, 15);
  }
  const s = record.snapshot;
  line("GHARFLOW - PRIVATE HOUSEHOLD EVIDENCE REPORT", 16);
  if (s.isDemo) line("SYNTHETIC DOCUMENTS - NOT A REAL HOUSEHOLD CASE");
  heading(s.finding.title);
  line(s.finding.detail);
  line(`Case ${record.id}`);
  line(`Captured ${s.capturedAt}; rule ${s.ruleVersion}`);
  heading("Captured comparison");
  s.finding.evidence.forEach((value) => line(value));
  heading("Bill records and corrections");
  for (const b of s.bills) {
    line(`Bill ${b.id}; month ${b.billMonth}; connection ${b.referenceNumber}`);
    line(
      `Meter ${b.meterIdentity ?? "unknown"}; reading date ${b.readingDate ?? "missing"}; ${b.readingStatus}; ${b.meterType}`,
    );
    line(
      `Previous ${b.previousReading ?? "missing"}; current ${b.currentReading ?? "missing"}; multiplier ${b.multiplier}; billed ${b.billedUnits ?? "missing"} kWh; PKR ${b.totalAmount}`,
    );
    line(`Confirmed ${b.confirmedAt ?? "legacy record"}`);
    line(
      b.evidenceFileId
        ? "Original document attached"
        : "Manual record: original document is missing",
    );
    for (const [key, source] of Object.entries(b.fieldSources))
      line(`${fieldName(key)}: ${sourceDescription(b, key, source)}`);
    for (const [key, value] of Object.entries(b.corrections))
      line(`${key}: OCR "${value.extracted}"; confirmed "${value.confirmed}"`);
  }
  heading("Captured observations and receipts");
  for (const r of s.readings)
    line(
      `${r.readingDate}; meter ${r.meterIdentity}; observation ${r.readingValue}; multiplier ${r.multiplier}`,
    );
  for (const p of s.payments)
    line(
      `${p.paidAt}; PKR ${p.amount}; ${p.channel}; user entered, posting unverified`,
    );
  if (!s.readings.length && !s.payments.length)
    line("No observations or receipts were captured in this case.");
  heading("Missing information");
  (s.finding.missing.length
    ? s.finding.missing
    : [
        "No additional fields required for this calculation. Verify original sources and meter changes.",
      ]
  ).forEach((value) => line(value));
  heading("Document references");
  documents
    .filter((document) => record.evidenceIds.includes(document.id))
    .forEach((document) =>
      line(`${document.name}; ${document.kind}; ID ${document.id}`),
    );
  heading("Investigation checklist - user reported");
  for (const [key, label] of Object.entries(checklistLabels))
    line(
      `${record.checklist[key as keyof typeof checklistLabels] ? "[x]" : "[ ]"} ${label}`,
    );
  heading("Current status and notes");
  line(`${record.status}; updated ${record.updatedAt}`);
  line(record.notes || "No notes entered.");
  line(`Outcome: ${record.outcome || "Not entered."}`);
  heading("Limits");
  line(
    "This report records source comparisons and user-reported information. It does not establish a utility error, payment posting, refund, or official submission. Later bill edits do not alter the calculation snapshot. OCR signals are not accuracy guarantees. Unsupported characters in uploaded names or notes appear as question marks in this English PDF.",
  );
  const pages = pdf.getPages();
  pages.forEach((item, index) =>
    item.drawText(`${index + 1} / ${pages.length}`, {
      x: 48,
      y: 35,
      size: 9,
      font,
    }),
  );
  return pdf.save();
}
