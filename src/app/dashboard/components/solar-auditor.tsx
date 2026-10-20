"use client";

import { useState } from "react";
import { Sun, CheckCircle2, AlertTriangle, Scale, ArrowRight } from "lucide-react";
import { t } from "@/lib/copy";
import {
  auditSolarNetMetering,
  NEPRA_DEFAULT_BUYBACK_RATE,
  NEPRA_DEFAULT_PEAK_RATE,
  type SolarNetMeteringInput,
} from "@/lib/solar";
import { money } from "./ui";

export default function SolarAuditor() {
  const [inputs, setInputs] = useState<SolarNetMeteringInput>({
    importOffPeakUnits: 380,
    importPeakUnits: 110,
    exportOffPeakUnits: 580,
    billedTotalPkr: 6500,
    nationalBuybackRatePkr: NEPRA_DEFAULT_BUYBACK_RATE,
    peakTariffRatePkr: NEPRA_DEFAULT_PEAK_RATE,
  });

  const result = auditSolarNetMetering(inputs);

  return (
    <section className="card solar-auditor" style={{ marginTop: "24px" }}>
      <div className="section-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow" style={{ color: "#d97706" }}>
            <Sun size={13} />
            {t("SOLAR NET-METERING & GREEN METER AUDITOR")}
          </span>
          <h2>{t("Audit your bi-directional solar credits")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t(
              "Verify your green meter import/export readings against NEPRA Net Metering Regulations (2015) to detect uncredited buyback generation.",
            )}
          </p>
        </div>
        <span
          className="pill"
          style={{
            background: "rgba(16, 185, 129, 0.1)",
            borderColor: "rgba(16, 185, 129, 0.3)",
            color: "#059669",
          }}
        >
          {t("NEPRA Solar Regulations 2015 Compliant")}
        </span>
      </div>

      {/* Input Grid */}
      <div
        className="form-grid"
        style={{
          marginTop: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "14px",
        }}
      >
        <label className="field">
          <span>{t("Import Units (Off-Peak kWh)")}</span>
          <input
            type="number"
            min={0}
            value={inputs.importOffPeakUnits}
            onChange={(e) =>
              setInputs((prev) => ({
                ...prev,
                importOffPeakUnits: Math.max(0, parseInt(e.target.value, 10) || 0),
              }))
            }
          />
        </label>

        <label className="field">
          <span>{t("Import Units (Peak kWh - 5PM-11PM)")}</span>
          <input
            type="number"
            min={0}
            value={inputs.importPeakUnits}
            onChange={(e) =>
              setInputs((prev) => ({
                ...prev,
                importPeakUnits: Math.max(0, parseInt(e.target.value, 10) || 0),
              }))
            }
          />
        </label>

        <label className="field">
          <span>{t("Solar Export Units (Off-Peak kWh)")}</span>
          <input
            type="number"
            min={0}
            value={inputs.exportOffPeakUnits}
            onChange={(e) =>
              setInputs((prev) => ({
                ...prev,
                exportOffPeakUnits: Math.max(0, parseInt(e.target.value, 10) || 0),
              }))
            }
          />
        </label>

        <label className="field">
          <span>{t("Actual Bill Amount (PKR)")}</span>
          <input
            type="number"
            min={0}
            value={inputs.billedTotalPkr ?? 0}
            onChange={(e) =>
              setInputs((prev) => ({
                ...prev,
                billedTotalPkr: Math.max(0, parseFloat(e.target.value) || 0),
              }))
            }
          />
        </label>
      </div>

      {/* Results Telemetry */}
      <div
        className="metric-grid"
        style={{
          marginTop: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div className="metric-card">
          <span className="metric-label">{t("Net Status")}</span>
          <strong style={{ color: result.isNetExporter ? "#10b981" : "#d97706" }}>
            {result.isNetExporter
              ? `${result.excessExportUnits} kWh Excess Export`
              : `${result.netOffPeakUnits} kWh Net Owed`}
          </strong>
          <small>{result.isNetExporter ? t("Generates solar credit") : t("Billed at off-peak rates")}</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Solar Buyback Credit")}</span>
          <strong style={{ color: "#10b981" }}>{money(result.solarCreditPkr)}</strong>
          <small>@ Rs {inputs.nationalBuybackRatePkr}/kWh determination</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Peak Hours Charges")}</span>
          <strong style={{ color: "#ef4444" }}>{money(result.peakChargesPkr)}</strong>
          <small>{t("Non-offsettable under Section 8(2)")}</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Solar Self-Sufficiency")}</span>
          <strong style={{ color: "#2563eb" }}>{result.solarSelfSufficiencyPct}%</strong>
          <small>{t("Of total household energy demand")}</small>
        </div>
      </div>

      {/* Discrepancies and Findings */}
      {result.discrepancies.length > 0 && (
        <div style={{ marginTop: "20px" }}>
          {result.discrepancies.map((disc, idx) => (
            <div
              key={idx}
              style={{
                padding: "14px 18px",
                borderRadius: "12px",
                marginBottom: "10px",
                background:
                  disc.severity === "violation"
                    ? "rgba(239, 68, 68, 0.08)"
                    : "rgba(16, 185, 129, 0.08)",
                border: `1px solid ${
                  disc.severity === "violation"
                    ? "rgba(239, 68, 68, 0.3)"
                    : "rgba(16, 185, 129, 0.3)"
                }`,
                display: "flex",
                alignItems: "flex-start",
                gap: "12px",
              }}
            >
              {disc.severity === "violation" ? (
                <AlertTriangle size={20} style={{ color: "#ef4444", flexShrink: 0, marginTop: "2px" }} />
              ) : (
                <CheckCircle2 size={20} style={{ color: "#10b981", flexShrink: 0, marginTop: "2px" }} />
              )}
              <div>
                <strong style={{ display: "block", fontSize: "14px", color: disc.severity === "violation" ? "#b91c1c" : "#047857" }}>
                  {disc.title}
                </strong>
                <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--ink-secondary)" }}>
                  {disc.detail}
                </p>
                <small style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {t("Legal Rule Citation:")} {disc.ruleCitation}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
