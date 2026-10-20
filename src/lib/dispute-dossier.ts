import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { CaseRecord, Evidence } from "./types";
import { identifyDisco } from "./online-bill";

/**
 * Generates an official, formal Dispute Dossier formatted according to
 * NEPRA Consumer Service Manual (CSM) Regulations.
 */
export async function generateNepraDisputePdf(
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
  const ref = targetBill?.referenceNumber || "Unknown";
  const disco = identifyDisco(ref);

  // Formal Header
  line("FORMAL BILLING DISPUTE & AUDIT DOSSIER", 15, true);
  line(
    "Submitted Under NEPRA Consumer Service Manual (CSM) Chapter 4 & Chapter 5",
    10,
    true,
  );
  y -= 4;

  // Addressed Authorities
  heading("TO THE COMPETENT AUTHORITIES:");
  line(
    `1. The Sub-Divisional Officer (SDO) / Executive Engineer (XEN), ${disco.name} (${disco.code})`,
  );
  line(
    `2. The Provincial Electric Inspector (PEI), Energy Department, Government of Pakistan`,
  );
  line(`3. Consumer Affairs Division (CAD), NEPRA Headquarters, Islamabad`);
  y -= 6;

  // Consumer & Connection Particulars
  heading("1. CONSUMER & CONNECTION PARTICULARS");
  line(`Reference / Account No: ${ref}`);
  line(`Distribution Company:   ${disco.name} (${disco.region})`);
  line(`Disputed Bill Period:   ${targetBill?.billMonth || "N/A"}`);
  line(
    `Meter Serial / Identity:${targetBill?.meterIdentity || "Unspecified"} (${targetBill?.meterType || "conventional"})`,
  );
  line(`Case Reference ID:      GF-${record.id.slice(0, 8).toUpperCase()}`);
  line(`Audit Snapshot Date:    ${s.capturedAt.slice(0, 10)}`);

  // Discrepancy Statement
  heading("2. SUMMARY OF AUDITED DISCREPANCY");
  line(`Finding: ${s.finding.title}`, 11, true);
  line(`Details: ${s.finding.detail}`);
  y -= 4;

  heading("3. MATHEMATICAL EVIDENCE & FIELD RECONCILIATION");
  for (const item of s.finding.evidence) {
    line(`- ${item}`, 10);
  }

  if (targetBill) {
    y -= 4;
    line(
      `Recorded Values: Prev Reading: ${targetBill.previousReading ?? "N/A"} | Current Reading: ${targetBill.currentReading ?? "N/A"} | Multiplier: ${targetBill.multiplier}`,
    );
    line(
      `Billed Units: ${targetBill.billedUnits ?? "N/A"} kWh | Total Amount Charged: PKR ${targetBill.totalAmount}`,
    );
    line(
      `Reading Basis: ${targetBill.readingStatus.toUpperCase()} | Reading Date: ${targetBill.readingDate || "Not recorded"}`,
    );
  }

  // Statutory Grounds
  heading("4. STATUTORY GROUNDS & REGULATORY CITATIONS");
  line(
    "- NEPRA CSM Section 4.1: Utility is obligated to record meter readings within 28-31 calendar days. Any artificial delay shifting consumers across slab thresholds constitutes unlawful overbilling.",
  );
  line(
    "- NEPRA CSM Section 4.2 & 4.4: In cases of reading arithmetic disputes or estimated bills, the utility must inspect the meter and verify physical photographic register evidence.",
  );
  line(
    "- NEPRA CSM Section 5.1 & 5.2: Disputed bills must be reviewed and corrected by the Revenue Officer without imposing late payment surcharges while the dispute is under review.",
  );

  // User Checklist & Attachments
  heading("5. ATTACHED EVIDENCE & USER INVESTIGATION");
  const attachedDocs = documents.filter((d) =>
    record.evidenceIds.includes(d.id),
  );
  if (attachedDocs.length) {
    for (const doc of attachedDocs) {
      line(`[Attached] ${doc.name} (${doc.kind.toUpperCase()})`);
    }
  } else {
    line(
      "Consumer has verified reading arithmetic against original utility bill copy.",
    );
  }

  if (record.notes) {
    heading("6. CONSUMER STATEMENT & GROUND REALITY");
    line(record.notes);
  }

  // Requested Relief
  heading("7. PRAYER / REQUESTED RELIEF");
  line(
    "1. Immediate provisional revision of the disputed bill in accordance with verified meter consumption.",
  );
  line(
    "2. Adjustment of any excess units or unfair slab escalations resulting from billing cycle delays or arithmetic variance.",
  );
  line(
    "3. Restraint from issuing disconnection notices or applying late payment charges pending formal determination of this dispute.",
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
