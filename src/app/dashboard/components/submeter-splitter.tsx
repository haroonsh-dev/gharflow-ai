"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Copy,
  Check,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Save,
  MessageSquare,
  HelpCircle,
  FileText,
  Calculator,
  ArrowRight,
} from "lucide-react";
import { t } from "@/lib/copy";
import {
  calculateSubmeterSplit,
  type MainBillContext,
  type PortionInput,
  type SubmeterSplitCalculation,
} from "@/lib/submeter";
import { identifyDisco } from "@/lib/online-bill";
import type { Bill } from "@/lib/types";
import { api, json, money, month } from "./ui";

export default function SubmeterSplitter({
  activeReference = "",
  bills = [],
  isDemo = false,
}: {
  activeReference?: string;
  bills?: Bill[];
  isDemo?: boolean;
}) {
  const latestBill = bills[0];
  const detectedDisco = identifyDisco(activeReference)?.name ?? "WAPDA / DISCO";

  const [discoName, setDiscoName] = useState(detectedDisco);
  const [referenceNumber, setReferenceNumber] = useState(activeReference);
  const [billMonth, setBillMonth] = useState(latestBill?.billMonth ?? "2026-09");
  const [mainBilledUnits, setMainBilledUnits] = useState<number>(
    latestBill?.billedUnits ?? 650,
  );
  const [mainTotalAmountPkr, setMainTotalAmountPkr] = useState<number>(
    latestBill?.totalAmount ?? 38500,
  );
  const [dueDate, setDueDate] = useState<string>(latestBill?.dueDate ?? "");
  const [commonHandling, setCommonHandling] = useState<
    "equal_split" | "proportional" | "landlord_absorb"
  >("equal_split");

  // Submeter portions
  const [portions, setPortions] = useState<PortionInput[]>([
    {
      id: "p1",
      name: "Ground Floor",
      tenantName: "Owner / Family",
      previousReading: 12500,
      currentReading: 12880, // 380 units
    },
    {
      id: "p2",
      name: "Upper Portion",
      tenantName: "Tenant Ali",
      previousReading: 8100,
      currentReading: 8330, // 230 units
    },
  ]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [readingMode, setReadingMode] = useState<"register" | "direct">("register");

  // Load saved config on mount
  const loadConfig = useCallback(async () => {
    if (!activeReference && !isDemo) return;
    try {
      const res = await api<{
        config: {
          portions: PortionInput[];
          commonLoadHandling: "equal_split" | "proportional" | "landlord_absorb";
        } | null;
      }>(`/api/submeters?referenceNumber=${encodeURIComponent(activeReference)}`);

      if (res.config && Array.isArray(res.config.portions) && res.config.portions.length > 0) {
        setPortions(res.config.portions);
        if (res.config.commonLoadHandling) {
          setCommonHandling(res.config.commonLoadHandling);
        }
      }
    } catch {
      // Keep defaults
    }
  }, [activeReference, isDemo]);

  useEffect(() => {
    void loadConfig();
  }, [loadConfig]);

  async function saveConfig() {
    setSaveStatus("saving");
    try {
      const res = await api<{ success: boolean }>(
        "/api/submeters",
        json({
          referenceNumber: activeReference,
          portions,
          commonLoadHandling: commonHandling,
        }),
      );
      if (res.success) {
        setSaveStatus("saved");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function addPortion() {
    const nextNum = portions.length + 1;
    setPortions((prev) => [
      ...prev,
      {
        id: `portion_${Date.now()}`,
        name: `Portion ${nextNum}`,
        tenantName: "",
        unitsConsumed: 150,
      },
    ]);
  }

  function removePortion(id: string) {
    if (portions.length <= 1) return;
    setPortions((prev) => prev.filter((p) => p.id !== id));
  }

  function updatePortion(id: string, patch: Partial<PortionInput>) {
    setPortions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    );
  }

  async function copySlip(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      // Fallback
    }
  }

  const billContext: MainBillContext = {
    referenceNumber: referenceNumber || activeReference || "08112234567890",
    discoName,
    billMonth,
    mainBilledUnits,
    mainTotalAmountPkr,
    dueDate,
    commonLoadHandling: commonHandling,
  };

  const splitResult: SubmeterSplitCalculation = calculateSubmeterSplit(
    portions,
    billContext,
  );

  return (
    <section className="card submeter-splitter" style={{ marginTop: "24px" }}>
      {/* Top Header */}
      <div
        className="section-heading"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "14px",
          borderBottom: "1px solid var(--line)",
          paddingBottom: "18px",
        }}
      >
        <div>
          <span
            className="eyebrow"
            style={{
              color: "#8b5cf6",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Users size={13} />
            {t("SHARED METER & MULTI-TENANT FAIR-SHARE SPLITTER")}
          </span>
          <h2 style={{ margin: "4px 0 6px", fontSize: "20px" }}>
            {t("Sub-Meter Billing & Instant WhatsApp Rent Slips")}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
            {t(
              "Equitably divide a shared DISCO electricity bill between owners, portions, and tenants. Automatically apportion progressive slab rates, FPA, and shared water pump load.",
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="button button-primary"
            style={{ minHeight: "36px", padding: "0 14px", fontSize: "13px" }}
            disabled={saveStatus === "saving"}
            onClick={() => void saveConfig()}
          >
            {saveStatus === "saving" ? (
              <span>{t("Saving…")}</span>
            ) : saveStatus === "saved" ? (
              <>
                <CheckCircle2 size={16} />
                <span>{t("Configuration Saved")}</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>{t("Save Setup")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 1. Primary WAPDA Bill Baseline Controls */}
      <div
        style={{
          padding: "16px",
          borderRadius: "12px",
          background: "var(--surface-raised)",
          border: "1px solid var(--line)",
          margin: "18px 0",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
          <strong style={{ fontSize: "13.5px", color: "var(--ink)" }}>
            ⚡ {t("Primary Meter Billed Figures (From Utility Bill)")}
          </strong>
          {latestBill && (
            <button
              type="button"
              className="text-button"
              style={{ fontSize: "12px" }}
              onClick={() => {
                setMainBilledUnits(latestBill.billedUnits ?? 600);
                setMainTotalAmountPkr(latestBill.totalAmount);
                setBillMonth(latestBill.billMonth);
                setDueDate(latestBill.dueDate ?? "");
              }}
            >
              {t("Auto-Fill from Latest Confirmed Bill")} ({month(latestBill.billMonth)})
            </button>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
          <div>
            <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              {t("Main Billed Units (kWh)")}
            </label>
            <input
              type="number"
              min={0}
              value={mainBilledUnits}
              onChange={(e) => setMainBilledUnits(Math.max(0, Number(e.target.value)))}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              {t("Total Amount Payable (PKR)")}
            </label>
            <input
              type="number"
              min={0}
              value={mainTotalAmountPkr}
              onChange={(e) => setMainTotalAmountPkr(Math.max(0, Number(e.target.value)))}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              {t("Bill Month")}
            </label>
            <input
              type="month"
              value={billMonth.slice(0, 7)}
              onChange={(e) => setBillMonth(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
            />
          </div>

          <div>
            <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
              {t("Due Date (Optional)")}
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
            />
          </div>
        </div>
      </div>

      {/* 2. Common Load & Reconciliation Alert Banner */}
      {splitResult.alertMessage && (
        <div
          style={{
            padding: "14px 16px",
            borderRadius: "12px",
            marginBottom: "18px",
            fontSize: "13px",
            display: "flex",
            alignItems: "flex-start",
            gap: "10px",
            background:
              splitResult.reconciliationStatus === "common_load_detected"
                ? "rgba(139, 92, 246, 0.08)"
                : "rgba(245, 158, 11, 0.08)",
            border: `1px solid ${
              splitResult.reconciliationStatus === "common_load_detected"
                ? "rgba(139, 92, 246, 0.3)"
                : "rgba(245, 158, 11, 0.3)"
            }`,
            color:
              splitResult.reconciliationStatus === "common_load_detected"
                ? "#6d28d9"
                : "#b45309",
          }}
        >
          <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
          <div>
            <strong>
              {splitResult.reconciliationStatus === "common_load_detected"
                ? t("Unmetered Shared Load Detected")
                : t("Sub-Meter Discrepancy")}
            </strong>
            <p style={{ margin: "4px 0 8px", fontSize: "12.5px" }}>{splitResult.alertMessage}</p>

            {splitResult.unaccountedCommonUnits > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "12px", fontWeight: 700 }}>
                  {t("How should this shared load be divided?")}
                </span>
                <select
                  value={commonHandling}
                  onChange={(e) => setCommonHandling(e.target.value as any)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "1px solid var(--line)",
                    fontSize: "12px",
                  }}
                >
                  <option value="equal_split">{t("Equal Split (Divide equally among all portions)")}</option>
                  <option value="proportional">{t("Proportional (Heavier users take larger share)")}</option>
                  <option value="landlord_absorb">{t("Owner/Landlord Absorbs")}</option>
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 3. Portions Input Grid */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
          <div>
            <h3 style={{ fontSize: "15px", fontWeight: 700, margin: 0 }}>
              {t("Sub-Meter Readings per Portion / Tenant")}
            </h3>
            <small className="muted">
              {t("Enter meter registers or direct units consumed")}
            </small>
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <span style={{ fontSize: "12px", color: "var(--muted)" }}>{t("Mode:")}</span>
            <button
              type="button"
              className={`button ${readingMode === "register" ? "button-primary" : "button-outline"}`}
              style={{ minHeight: "28px", padding: "0 10px", fontSize: "11.5px" }}
              onClick={() => setReadingMode("register")}
            >
              {t("Meter Registers (Prev/Curr)")}
            </button>
            <button
              type="button"
              className={`button ${readingMode === "direct" ? "button-primary" : "button-outline"}`}
              style={{ minHeight: "28px", padding: "0 10px", fontSize: "11.5px" }}
              onClick={() => setReadingMode("direct")}
            >
              {t("Direct kWh Units")}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
          {portions.map((portion, index) => {
            const calculatedUnits =
              readingMode === "register"
                ? portion.currentReading != null &&
                  portion.previousReading != null &&
                  portion.currentReading >= portion.previousReading
                  ? Math.round((portion.currentReading - portion.previousReading) * 10) / 10
                  : 0
                : portion.unitsConsumed ?? 0;

            return (
              <div
                key={portion.id}
                style={{
                  padding: "16px",
                  borderRadius: "12px",
                  border: "1px solid var(--line)",
                  background: "var(--surface)",
                  position: "relative",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <span style={{ fontWeight: 700, fontSize: "13.5px" }}>
                    #{index + 1} {portion.name || `Portion ${index + 1}`}
                  </span>
                  {portions.length > 1 && (
                    <button
                      type="button"
                      className="icon-button"
                      style={{ padding: "4px" }}
                      onClick={() => removePortion(portion.id)}
                      title={t("Remove portion")}
                    >
                      <Trash2 size={14} style={{ color: "#ef4444" }} />
                    </button>
                  )}
                </div>

                <div style={{ display: "grid", gap: "8px" }}>
                  <div>
                    <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block" }}>
                      {t("Portion Name / Floor")}
                    </label>
                    <input
                      type="text"
                      value={portion.name}
                      onChange={(e) => updatePortion(portion.id, { name: e.target.value })}
                      placeholder={t("e.g. Ground Floor, Upper Flat")}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "12.5px" }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block" }}>
                      {t("Tenant Name (Optional)")}
                    </label>
                    <input
                      type="text"
                      value={portion.tenantName ?? ""}
                      onChange={(e) => updatePortion(portion.id, { tenantName: e.target.value })}
                      placeholder={t("e.g. Ali Raza, Owner")}
                      style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "12.5px" }}
                    />
                  </div>

                  {readingMode === "register" ? (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                      <div>
                        <label style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>
                          {t("Prev Reading")}
                        </label>
                        <input
                          type="number"
                          value={portion.previousReading ?? ""}
                          onChange={(e) =>
                            updatePortion(portion.id, {
                              previousReading: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "12.5px" }}
                        />
                      </div>
                      <div>
                        <label style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>
                          {t("Current Reading")}
                        </label>
                        <input
                          type="number"
                          value={portion.currentReading ?? ""}
                          onChange={(e) =>
                            updatePortion(portion.id, {
                              currentReading: e.target.value === "" ? undefined : Number(e.target.value),
                            })
                          }
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "12.5px" }}
                        />
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block" }}>
                        {t("Units Consumed (kWh)")}
                      </label>
                      <input
                        type="number"
                        min={0}
                        value={portion.unitsConsumed ?? ""}
                        onChange={(e) =>
                          updatePortion(portion.id, {
                            unitsConsumed: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--line)", fontSize: "12.5px" }}
                      />
                    </div>
                  )}

                  <div
                    style={{
                      marginTop: "6px",
                      padding: "8px 10px",
                      background: "rgba(37, 99, 235, 0.05)",
                      borderRadius: "6px",
                      display: "flex",
                      justifyContent: "space-between",
                      fontSize: "12px",
                    }}
                  >
                    <span>{t("Sub-Meter Consumption:")}</span>
                    <strong style={{ color: "#2563eb" }}>{calculatedUnits} kWh</strong>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="button button-outline"
          style={{ marginTop: "12px", fontSize: "12.5px" }}
          onClick={addPortion}
        >
          <Plus size={15} />
          {t("Add Another Portion / Tenant")}
        </button>
      </div>

      {/* 4. Calculated Fair-Share Billing Cards & WhatsApp Slips */}
      <div style={{ marginTop: "10px", borderTop: "1px solid var(--line)", paddingTop: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "8px" }}>
          <div>
            <h3 style={{ fontSize: "16px", fontWeight: 700, margin: 0 }}>
              {t("Fair-Share Apportionment & Tenant Receipts")}
            </h3>
            <small className="muted">
              {t("Blended Effective Rate:")} ~PKR {splitResult.blendedRatePerKwh.toFixed(2)}/kWh · {t("Total Sub-Meters:")} {splitResult.totalSubmeterUnits} kWh
            </small>
          </div>

          <span
            className="pill"
            style={{
              background: "rgba(16, 185, 129, 0.1)",
              borderColor: "rgba(16, 185, 129, 0.3)",
              color: "#059669",
              fontSize: "11.5px",
            }}
          >
            <CheckCircle2 size={13} />
            {t("Sum of Portions = Total Bill (100% Reconciled)")}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
          {splitResult.portions.map((p) => {
            const waUrl = `https://wa.me/?text=${encodeURIComponent(p.whatsappText)}`;

            return (
              <div
                key={p.portionId}
                style={{
                  padding: "18px",
                  borderRadius: "14px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div>
                      <h4 style={{ margin: "0 0 2px", fontSize: "16px", fontWeight: 700 }}>
                        {p.portionName}
                      </h4>
                      {p.tenantName && (
                        <span style={{ fontSize: "12px", color: "var(--muted)" }}>
                          👤 {p.tenantName}
                        </span>
                      )}
                    </div>
                    <span
                      className="pill"
                      style={{
                        background: "rgba(37, 99, 235, 0.1)",
                        color: "#2563eb",
                        fontWeight: 700,
                        fontSize: "12px",
                      }}
                    >
                      {p.unitsSharePct}% {t("of Bill")}
                    </span>
                  </div>

                  <div style={{ fontSize: "13px", display: "grid", gap: "6px", marginBottom: "14px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">{t("Sub-Meter Consumption:")}</span>
                      <strong>{p.submeterUnits} kWh</strong>
                    </div>

                    {p.commonUnitsAllocated > 0 && (
                      <div style={{ display: "flex", justifyContent: "space-between" }}>
                        <span className="muted">{t("Shared Water/Stairs:")}</span>
                        <span style={{ color: "#8b5cf6", fontWeight: 600 }}>
                          +{p.commonUnitsAllocated} kWh
                        </span>
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px dashed var(--line)", paddingTop: "4px" }}>
                      <span className="muted">{t("Effective Billed Units:")}</span>
                      <strong>{p.effectiveTotalUnits} kWh</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">{t("Base Energy Share:")}</span>
                      <span>{money(p.baseEnergyPkr)}</span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span className="muted">{t("Taxes, FPA & Levies:")}</span>
                      <span>{money(p.taxesAndLeviesPkr)}</span>
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "12px",
                      borderRadius: "10px",
                      background: "rgba(16, 185, 129, 0.06)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "14px",
                    }}
                  >
                    <div>
                      <small style={{ fontSize: "11px", color: "var(--muted)", display: "block" }}>
                        {t("Total Due from Tenant")}
                      </small>
                      <strong style={{ fontSize: "18px", color: "#059669" }}>
                        {money(p.totalPayablePkr)}
                      </strong>
                    </div>
                    <small style={{ fontSize: "11px", color: "var(--muted)", textAlign: "right" }}>
                      ~Rs {p.effectiveRatePerKwh}/kWh
                    </small>
                  </div>
                </div>

                {/* WhatsApp & Copy Action Bar */}
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="button button-primary"
                    style={{
                      flex: 1,
                      minHeight: "34px",
                      fontSize: "12px",
                      background: "#25D366",
                      borderColor: "#25D366",
                      color: "#ffffff",
                    }}
                  >
                    <MessageSquare size={14} />
                    {t("Send via WhatsApp")}
                  </a>

                  <button
                    type="button"
                    className="button button-outline"
                    style={{ minHeight: "34px", padding: "0 10px", fontSize: "12px" }}
                    onClick={() => copySlip(p.portionId, p.whatsappText)}
                  >
                    {copiedId === p.portionId ? <Check size={14} style={{ color: "#10b981" }} /> : <Copy size={14} />}
                    {copiedId === p.portionId ? t("Copied") : t("Copy Slip")}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
