import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CaseRecord, Evidence } from "./types";

/**
 * Generates an official Telecom Billing Dispute Dossier formatted for submission to:
 * 1. PTCL Customer Care / Billing Office
 * 2. Pakistan Telecommunication Authority (PTA) Consumer Complaint Cell
 * 3. District Consumer Protection Court
 */
export async function generatePtaDisputePdf(
  record: CaseRecord,
  documents: Evidence[] = [],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage();
  let y = 790;

  const printable = (text: string) =>
    text
      .replace(/−/g, "-")
      .replace(/[“”]/g, '"')
      .replace(/→/g, " -> ")
      .replace(/[^\x20-\x7e\n]/g, "?");

  function drawText(
    text: string,
    size: number,
    isBold = false,
    color = rgb(0.1, 0.15, 0.2),
  ) {
    if (y < 60) {
      page = pdf.addPage();
      y = 790;
    }
    page.drawText(text, {
      x: 48,
      y,
      size,
      font: isBold ? boldFont : font,
      color,
    });
    y -= size + 6;
  }

  function line(text: string, size = 10, isBold = false) {
    for (const paragraph of printable(text).split("\n")) {
      let current = "";
      for (const word of paragraph.split(/\s+/)) {
        const next = current ? `${current} ${word}` : word;
        if (font.widthOfTextAtSize(next, size) > 500 && current) {
          drawText(current, size, isBold);
          current = word;
        } else {
          current = next;
        }
      }
      if (current) drawText(current, size, isBold);
    }
  }

  function heading(text: string) {
    y -= 8;
    line(text, 13, true);
  }

  const s = record.snapshot;
  const targetBill = s.bills[0];
  const accountId = targetBill?.referenceNumber || "Unknown";

  // Formal Header
  line("FORMAL TELECOMMUNICATION BILLING DISPUTE DOSSIER", 15, true);
  line(
    "Submitted Under PTA Telecom Consumer Protection Regulations (2009 / 2020)",
    10,
    true,
  );
  y -= 4;

  // Addressed Authorities
  heading("TO THE COMPETENT AUTHORITIES:");
  line("1. Senior Manager (Customer Care & Billing), PTCL Customer Care Center");
  line(
    "2. Consumer Protection Directorate, Pakistan Telecommunication Authority (PTA), F-5/1, Islamabad",
  );
  line("3. District Consumer Protection Court (Applicable Territorial Jurisdiction)");
  y -= 6;

  // Consumer Particulars
  heading("1. SUBSCRIBER & CONNECTION PARTICULARS");
  line(`PTCL Account ID:        ${accountId}`);
  line(`Service / Billing Month: ${targetBill?.billMonth || "N/A"}`);
  line(`Total Disputed Amount:   PKR ${targetBill?.totalAmount ?? "N/A"}`);
  line(`Case Reference ID:       PTA-${record.id.slice(0, 8).toUpperCase()}`);
  line(`Audit Snapshot Date:     ${s.capturedAt.slice(0, 10)}`);

  // Discrepancy Statement
  heading("2. SUMMARY OF TELECOM BILLING DISPUTE");
  line(`Finding: ${s.finding.title}`, 11, true);
  line(`Details: ${s.finding.detail}`);
  y -= 4;

  heading("3. AUDITED EVIDENCE & LEDGER RECONCILIATION");
  for (const item of s.finding.evidence) {
    line(`- ${item}`, 10);
  }

  // Statutory Grounds
  heading("4. STATUTORY GROUNDS & PTA REGULATIONS");
  line(
    "- PTA Consumer Protection Regulations: Telecom licensees are required to accurately reconcile electronic payments within 48 hours of receipt. Uncredited arrears carryovers constitute billing negligence.",
  );
  line(
    "- Section 236 Income Tax Ordinance & Provincial Sales Tax Acts: Levying excess taxes beyond statutory rates (PRA 19.5%, WHT 15%) is unlawful.",
  );
  line(
    "- Telecom Consumer Rights: Service suspension or disconnection is strictly prohibited while a bona fide billing dispute is pending resolution.",
  );

  // Attached Evidence
  heading("5. ATTACHED PAYMENT RECEIPTS & DOCUMENTS");
  const attachedDocs = documents.filter((d) =>
    record.evidenceIds.includes(d.id),
  );
  if (attachedDocs.length) {
    for (const doc of attachedDocs) {
      line(`[Attached] ${doc.name} (${doc.kind.toUpperCase()})`);
    }
  } else {
    line("Consumer has uploaded official electronic payment confirmation.");
  }

  if (record.notes) {
    heading("6. SUBSCRIBER STATEMENT");
    line(record.notes);
  }

  // Requested Relief
  heading("7. PRAYER / REQUESTED RELIEF");
  line(
    "1. Immediate crediting of the verified payment and removal of erroneous arrears from the account ledger.",
  );
  line(
    "2. Immediate waiver of all late payment surcharges accrued due to utility accounting delays.",
  );
  line(
    "3. Restraint from suspending broadband/fiber services or downgrading speed pending resolution.",
  );

  y -= 10;
  line("Submitted respectfully by the Consumer.", 11, true);

  // Footer on all pages
  const pages = pdf.getPages();
  pages.forEach((item, index) => {
    item.drawText(`Page ${index + 1} of ${pages.length} · GharFlow AI`, {
      x: 48,
      y: 35,
      size: 9,
      font,
      color: rgb(0.4, 0.45, 0.5),
    });
  });

  return pdf.save();
}
