"use client";

import { useState } from "react";
import { Globe, ArrowRight, LoaderCircle, CheckCircle2, ExternalLink } from "lucide-react";
import { t } from "@/lib/copy";
import { api, json, money } from "./ui";

export type OnlineFetchResult = {
  success: boolean;
  type: "electricity" | "ptcl" | "gas";
  referenceNumber: string;
  disco?: string;
  discoCode?: string;
  provider?: string;
  queryUrl: string;
  helpline?: string;
  parsed?: {
    referenceNumber: string;
    disco: string;
    consumerName?: string;
    readingDate?: string;
    dueDate?: string;
    unitsConsumed?: number;
    totalAmount?: number;
    meterNumber?: string;
    isVerified: boolean;
  } | null;
};

export default function OnlineFetcher({
  initialReference = "",
  onApplyData,
}: {
  initialReference?: string;
  onApplyData?: (data: {
    referenceNumber: string;
    billedUnits?: number;
    totalAmount?: number;
    readingDate?: string;
    dueDate?: string;
    meterIdentity?: string;
  }) => void;
}) {
  const [reference, setReference] = useState(initialReference);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OnlineFetchResult | null>(null);

  async function fetchOnline() {
    if (!reference.trim()) return;
    setBusy(true);
    setError("");
    setResult(null);

    try {
      const data = await api<OnlineFetchResult>(
        "/api/bills/fetch-online",
        json({ referenceNumber: reference.trim() }),
      );
      setResult(data);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Failed to query utility portal"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{
        padding: "20px",
        borderRadius: "14px",
        background: "var(--surface)",
        border: "1px solid var(--line)",
        marginBottom: "20px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
        <Globe size={18} style={{ color: "#2563eb" }} />
        <strong style={{ fontSize: "14px" }}>
          {t("1-Click Online Duplicate Bill Fetcher (PITC / K-Electric / PTCL / Sui Gas)")}
        </strong>
      </div>
      <p style={{ fontSize: "12.5px", color: "var(--muted)", margin: "0 0 14px" }}>
        {t(
          "Enter your 14-digit electricity reference (LESCO, MEPCO, IESCO, etc.), 13-digit KE account, 10-digit PTCL ID, or 10/11-digit Sui Gas (SNGPL/SSGC) number to fetch portal duplicates.",
        )}
      </p>

      <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
        <input
          type="text"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("e.g. 08 11223 4567890 U or 1000987654")}
          maxLength={18}
          style={{
            flex: "1 1 240px",
            minHeight: "40px",
            padding: "8px 12px",
            borderRadius: "10px",
            border: "1px solid var(--line)",
            background: "var(--surface-raised)",
            fontFamily: "ui-monospace, monospace",
          }}
        />
        <button
          className="button button-primary"
          type="button"
          disabled={busy || !reference.trim()}
          onClick={fetchOnline}
        >
          {busy ? <LoaderCircle size={16} className="spin" /> : <Globe size={16} />}
          {busy ? t("Querying Live Portal…") : t("Fetch Online Bill")}
        </button>
      </div>

      {error && (
        <p className="form-error" style={{ marginTop: "12px" }}>
          {error}
        </p>
      )}

      {result && (
        <div
          style={{
            marginTop: "16px",
            padding: "16px",
            borderRadius: "12px",
            background: "rgba(37, 99, 235, 0.04)",
            border: "1px solid rgba(37, 99, 235, 0.2)",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
            <span style={{ fontWeight: 700, color: "#2563eb", fontSize: "13px" }}>
              {result.disco || result.provider} · Reference: {result.referenceNumber}
            </span>
            <a
              href={result.queryUrl}
              target="_blank"
              rel="noreferrer"
              className="text-button"
              style={{ fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
            >
              {t("Open Official Web Bill")}
              <ExternalLink size={13} />
            </a>
          </div>

          {result.parsed && result.parsed.isVerified ? (
            <div style={{ display: "grid", gap: "8px", fontSize: "13px", marginTop: "10px" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t("Billed Units:")}</span>
                <strong>{result.parsed.unitsConsumed} kWh</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="muted">{t("Amount Payable:")}</span>
                <strong style={{ color: "#10b981" }}>
                  {result.parsed.totalAmount ? money(result.parsed.totalAmount) : "—"}
                </strong>
              </div>
              {result.parsed.readingDate && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">{t("Reading Date:")}</span>
                  <span>{result.parsed.readingDate}</span>
                </div>
              )}
              {result.parsed.meterNumber && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="muted">{t("Meter Serial:")}</span>
                  <span>{result.parsed.meterNumber}</span>
                </div>
              )}

              {onApplyData && (
                <button
                  type="button"
                  className="button button-primary"
                  style={{ marginTop: "10px" }}
                  onClick={() =>
                    onApplyData({
                      referenceNumber: result.referenceNumber,
                      billedUnits: result.parsed?.unitsConsumed,
                      totalAmount: result.parsed?.totalAmount,
                      readingDate: result.parsed?.readingDate,
                      meterIdentity: result.parsed?.meterNumber,
                    })
                  }
                >
                  <CheckCircle2 size={16} />
                  {t("Use These Online Values In Bill Form")}
                </button>
              )}
            </div>
          ) : (
            <div style={{ fontSize: "12.5px", color: "var(--ink-secondary)", marginTop: "6px" }}>
              <p style={{ margin: "0 0 8px" }}>
                {t(
                  "Official duplicate bill portal is ready for your account. Click 'Open Official Web Bill' above to view the signed bill on PITC servers.",
                )}
              </p>
              {result.helpline && (
                <small className="muted">
                  {t("Official Utility Helpline:")} {result.helpline}
                </small>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
