"use client";

import { useState } from "react";
import { MessageSquare, Copy, Check, FileText } from "lucide-react";
import { t } from "@/lib/copy";

export default function WhatsAppDispatcher({
  referenceNumber,
  discoName = "LESCO",
  billMonth,
  findingTitle,
  findingDetail,
  evidenceText,
  ruleCitation = "NEPRA Consumer Service Manual (CSM) Chapter 4 & 5",
}: {
  referenceNumber: string;
  discoName?: string;
  billMonth: string;
  findingTitle: string;
  findingDetail: string;
  evidenceText?: string;
  ruleCitation?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Generate formal complaint letter text
  const formalNotice = `FORMAL NOTICE OF BILLING DISCREPANCY & RECTIFICATION REQUEST

To:
The Sub-Divisional Officer (SDO) / Revenue Officer
${discoName} Division

Subject: Rectification of Electricity Bill for Month: ${billMonth}
Consumer Reference Number: ${referenceNumber}

Dear Sir/Madam,

I am writing to formally place on record a discrepancy in the electricity bill issued for the month of ${billMonth} under consumer reference number ${referenceNumber}.

1. Discrepancy Flagged:
${findingTitle}
${findingDetail}

2. Evidence & Calculations:
${evidenceText || "Attached comparison of consecutive meter reading observations."}

3. Legal & Regulatory Basis:
Under ${ruleCitation}, meter reading cycles and progressive slab calculations must adhere strictly to statutory provisions. Any pro-rata slab jump or billing inflation resulting from utility delay is non-compliant.

I request an immediate revision of this bill, issuance of an adjusted duplicate bill with extended due date, and an inquiry into this reading cycle.

Sincerely,
Consumer / Account Holder
Reference: ${referenceNumber}`;

  // Formatted WhatsApp message
  const whatsappMessage = `*GharFlow AI · Utility Billing Alert*
⚡ *Provider:* ${discoName}
📋 *Reference #:* ${referenceNumber}
📅 *Month:* ${billMonth}

⚠️ *Discrepancy:* ${findingTitle}
🔍 *Details:* ${findingDetail}
⚖️ *Regulatory Citation:* ${ruleCitation}

_This evidence is preserved under NEPRA Consumer Protection Guidelines. Please review for dispute filing._`;

  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(whatsappMessage)}`;

  async function copyNotice() {
    try {
      await navigator.clipboard.writeText(formalNotice);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  }

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginTop: "10px",
      }}
    >
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="button"
        style={{
          background: "#25D366",
          color: "#fff",
          border: "none",
          fontSize: "12px",
          minHeight: "34px",
          padding: "0 12px",
        }}
      >
        <MessageSquare size={14} />
        {t("Share on WhatsApp")}
      </a>

      <button
        type="button"
        className="button button-outline"
        onClick={copyNotice}
        style={{ fontSize: "12px", minHeight: "34px", padding: "0 12px" }}
      >
        {copied ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
        {copied ? t("Legal Notice Copied!") : t("Copy Formal SDO Notice")}
      </button>
    </div>
  );
}
