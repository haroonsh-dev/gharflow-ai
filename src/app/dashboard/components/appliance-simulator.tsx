"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Zap,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  Save,
  Plus,
  Trash2,
  BarChart3,
  HelpCircle,
  Activity,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
} from "lucide-react";
import { t } from "@/lib/copy";
import {
  APPLIANCE_CATALOG,
  simulateApplianceLoad,
  analyzePhantomLoad,
  type ApplianceUsage,
  type HouseholdApplianceProfile,
} from "@/lib/appliances";
import { api, json, money, month } from "./ui";

export type ApplianceSimulatorProps = {
  activeReferenceNumber?: string;
  latestBillKwh?: number | null;
  latestBillMonth?: string | null;
  latestBillAmount?: number | null;
  isDemo?: boolean;
};

const PRESETS: {
  id: string;
  name: string;
  icon: string;
  usages: ApplianceUsage[];
}[] = [
  {
    id: "small_apartment",
    name: "1-Bed Apartment",
    icon: "🏢",
    usages: [
      { applianceId: "ac_1_0_ton", quantity: 1, hoursPerDay: 7 },
      { applianceId: "refrigerator", quantity: 1, hoursPerDay: 24 },
      { applianceId: "ceiling_fans", quantity: 2, hoursPerDay: 12 },
      { applianceId: "iron", quantity: 1, hoursPerDay: 0.3 },
    ],
  },
  {
    id: "medium_house",
    name: "2/3-Bed Medium House",
    icon: "🏡",
    usages: [
      { applianceId: "ac_1_5_ton", quantity: 2, hoursPerDay: 8 },
      { applianceId: "refrigerator", quantity: 1, hoursPerDay: 24 },
      { applianceId: "water_pump_1hp", quantity: 1, hoursPerDay: 1 },
      { applianceId: "ups_losses", quantity: 1, hoursPerDay: 20 },
      { applianceId: "ceiling_fans", quantity: 4, hoursPerDay: 14 },
      { applianceId: "iron", quantity: 1, hoursPerDay: 0.5 },
    ],
  },
  {
    id: "large_house",
    name: "1-Kanal / Large House",
    icon: "🏰",
    usages: [
      { applianceId: "ac_1_5_ton", quantity: 3, hoursPerDay: 9 },
      { applianceId: "ac_2_0_ton", quantity: 1, hoursPerDay: 6 },
      { applianceId: "refrigerator", quantity: 2, hoursPerDay: 24 },
      { applianceId: "deep_freezer", quantity: 1, hoursPerDay: 24 },
      { applianceId: "water_pump_2hp", quantity: 1, hoursPerDay: 1.5 },
      { applianceId: "ups_losses", quantity: 2, hoursPerDay: 24 },
      { applianceId: "ceiling_fans", quantity: 8, hoursPerDay: 16 },
      { applianceId: "iron", quantity: 1, hoursPerDay: 1.0 },
    ],
  },
];

export default function ApplianceSimulator({
  activeReferenceNumber = "",
  latestBillKwh = null,
  latestBillMonth = null,
  latestBillAmount = null,
  isDemo = false,
}: ApplianceSimulatorProps) {
  const [usages, setUsages] = useState<ApplianceUsage[]>(() =>
    APPLIANCE_CATALOG.map((a) => ({
      applianceId: a.id,
      quantity: a.defaultQuantity,
      hoursPerDay: a.defaultHoursPerDay,
    })),
  );

  const [isProtected, setIsProtected] = useState(true);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [profileName, setProfileName] = useState("My Household Profile");
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);

  // Custom appliance state
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customWatts, setCustomWatts] = useState(150);
  const [customHours, setCustomHours] = useState(2);
  const [customQuantity, setCustomQuantity] = useState(1);
  const [customCategory, setCustomCategory] = useState<
    "cooling" | "heating" | "motors" | "appliances" | "power"
  >("appliances");

  // Load saved profile on mount or reference number change
  const loadProfile = useCallback(async () => {
    if (!activeReferenceNumber && !isDemo) return;
    try {
      const res = await api<{ profile: HouseholdApplianceProfile | null }>(
        `/api/appliances?referenceNumber=${encodeURIComponent(activeReferenceNumber)}`,
      );
      if (res.profile && Array.isArray(res.profile.usages) && res.profile.usages.length > 0) {
        setUsages(res.profile.usages);
        setIsProtected(res.profile.isProtected ?? true);
        setProfileName(res.profile.name || "My Household Profile");
        if (res.profile.updatedAt) {
          setLastSavedTime(new Date(res.profile.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        }
      }
    } catch {
      // Profile not saved yet, keep catalog defaults
    }
  }, [activeReferenceNumber, isDemo]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  async function saveProfile() {
    setSaveStatus("saving");
    try {
      const res = await api<{ success: boolean; profile: HouseholdApplianceProfile }>(
        "/api/appliances",
        json({
          referenceNumber: activeReferenceNumber,
          name: profileName,
          usages,
          isProtected,
        }),
      );
      if (res.success) {
        setSaveStatus("saved");
        setLastSavedTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
    } catch {
      setSaveStatus("error");
      setTimeout(() => setSaveStatus("idle"), 3000);
    }
  }

  function applyPreset(presetId: string) {
    const preset = PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    // Merge preset usages with full catalog so items remain interactive
    const newUsages: ApplianceUsage[] = APPLIANCE_CATALOG.map((item) => {
      const found = preset.usages.find((u) => u.applianceId === item.id);
      return {
        applianceId: item.id,
        quantity: found ? found.quantity : 0,
        hoursPerDay: found ? found.hoursPerDay : item.defaultHoursPerDay,
      };
    });
    setUsages(newUsages);
  }

  function updateQuantity(id: string, qty: number) {
    setUsages((prev) =>
      prev.map((u) =>
        u.applianceId === id ? { ...u, quantity: Math.max(0, qty) } : u,
      ),
    );
  }

  function updateHours(id: string, hrs: number) {
    setUsages((prev) =>
      prev.map((u) =>
        u.applianceId === id
          ? { ...u, hoursPerDay: Math.max(0, Math.min(24, Math.round(hrs * 10) / 10)) }
          : u,
      ),
    );
  }

  function removeAppliance(id: string) {
    setUsages((prev) => prev.filter((u) => u.applianceId !== id));
  }

  function addCustomAppliance() {
    if (!customName.trim()) return;
    const newId = `custom_${Date.now()}`;
    const newUsage: ApplianceUsage = {
      applianceId: newId,
      quantity: Math.max(1, customQuantity),
      hoursPerDay: Math.max(0.1, customHours),
      customName: customName.trim(),
      customWatts: Math.max(10, customWatts),
      category: customCategory,
    };
    setUsages((prev) => [newUsage, ...prev]);
    setCustomName("");
    setCustomWatts(150);
    setShowAddCustom(false);
  }

  const result = simulateApplianceLoad(usages, isProtected);
  const phantom = analyzePhantomLoad(result.totalMonthlyKwh, latestBillKwh, isProtected);

  // Graph height proportion
  const maxGraphKwh = Math.max(
    result.totalMonthlyKwh,
    latestBillKwh ?? 0,
    100,
  );
  const billedHeightPct = latestBillKwh ? Math.round((latestBillKwh / maxGraphKwh) * 100) : 0;
  const simulatedHeightPct = Math.round((result.totalMonthlyKwh / maxGraphKwh) * 100);

  return (
    <section className="card appliance-simulator" style={{ marginTop: "24px" }}>
      {/* Top Header & Sync Bar */}
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
          <span className="eyebrow" style={{ color: "#2563eb", display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Sparkles size={13} />
            {t("APPLIANCE LOAD FORENSICS & PHANTOM LOAD DETECTOR")}
          </span>
          <h2 style={{ margin: "4px 0 6px", fontSize: "20px" }}>
            {t("Household Appliance Inventory & Slab Diagnostics")}
          </h2>
          <p className="muted" style={{ margin: 0, fontSize: "13px" }}>
            {activeReferenceNumber ? (
              <span>
                {t("Connection:")} <strong>{activeReferenceNumber}</strong>
                {lastSavedTime && ` · ${t("Synced at")} ${lastSavedTime}`}
              </span>
            ) : (
              t("Model daily appliance hours, save to your household profile, and verify against your actual bill.")
            )}
          </p>
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            className="button button-primary"
            style={{ minHeight: "36px", padding: "0 14px", fontSize: "13px" }}
            disabled={saveStatus === "saving"}
            onClick={() => void saveProfile()}
          >
            {saveStatus === "saving" ? (
              <span>{t("Saving…")}</span>
            ) : saveStatus === "saved" ? (
              <>
                <CheckCircle2 size={16} style={{ color: "#ffffff" }} />
                <span>{t("Profile Synced")}</span>
              </>
            ) : (
              <>
                <Save size={15} />
                <span>{t("Save to Household Profile")}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Setup Presets */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "16px 0", flexWrap: "wrap" }}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--ink-secondary)" }}>
          {t("Quick Setup Presets:")}
        </span>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="button button-outline"
            style={{ fontSize: "12px", padding: "4px 10px", minHeight: "30px", borderRadius: "8px" }}
            onClick={() => applyPreset(p.id)}
          >
            <span>{p.icon}</span>
            <span>{p.name}</span>
          </button>
        ))}
        <button
          type="button"
          className="button button-outline"
          style={{ fontSize: "12px", padding: "4px 10px", minHeight: "30px", borderRadius: "8px" }}
          onClick={() => setShowAddCustom((prev) => !prev)}
        >
          <Plus size={14} />
          <span>{t("Add Custom Device")}</span>
        </button>
      </div>

      {/* Add Custom Appliance Form */}
      {showAddCustom && (
        <div
          style={{
            padding: "16px",
            borderRadius: "12px",
            background: "rgba(37, 99, 235, 0.04)",
            border: "1px dashed rgba(37, 99, 235, 0.3)",
            marginBottom: "20px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <strong style={{ fontSize: "13px", color: "#2563eb" }}>{t("Add Custom Household Device")}</strong>
            <button
              type="button"
              className="text-button"
              style={{ fontSize: "12px" }}
              onClick={() => setShowAddCustom(false)}
            >
              {t("Cancel")}
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                {t("Device Name")}
              </label>
              <input
                type="text"
                placeholder={t("e.g. Microwave, Gaming PC, Sewing Machine")}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                {t("Power Draw (Watts)")}
              </label>
              <input
                type="number"
                min={10}
                max={6000}
                value={customWatts}
                onChange={(e) => setCustomWatts(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                {t("Daily Hours")}
              </label>
              <input
                type="number"
                min={0.1}
                max={24}
                step={0.5}
                value={customHours}
                onChange={(e) => setCustomHours(Number(e.target.value))}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11.5px", color: "var(--muted)", display: "block", marginBottom: "4px" }}>
                {t("Category")}
              </label>
              <select
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value as any)}
                style={{ width: "100%", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--line)" }}
              >
                <option value="appliances">{t("General Appliances")}</option>
                <option value="cooling">{t("Cooling / Air")}</option>
                <option value="heating">{t("Heating")}</option>
                <option value="motors">{t("Motors & Pumps")}</option>
                <option value="power">{t("UPS & Electronics")}</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            className="button button-primary"
            style={{ marginTop: "12px", minHeight: "32px", fontSize: "12px" }}
            onClick={addCustomAppliance}
            disabled={!customName.trim()}
          >
            <Plus size={14} />
            {t("Add to Inventory")}
          </button>
        </div>
      )}

      {/* COMPARATIVE VISUAL GRAPH: Actual Billed vs Simulated Footprint */}
      <div
        style={{
          marginTop: "10px",
          marginBottom: "24px",
          padding: "20px",
          borderRadius: "14px",
          background: "var(--surface)",
          border: "1px solid var(--line)",
          boxShadow: "0 2px 10px rgba(0,0,0,0.02)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <BarChart3 size={18} style={{ color: "#2563eb" }} />
            <strong style={{ fontSize: "15px" }}>
              {t("Forensic Consumption Comparison: Actual Bill vs Declared Footprint")}
            </strong>
          </div>
          {latestBillMonth && (
            <span className="pill" style={{ fontSize: "11.5px" }}>
              {t("Latest Bill:")} {month(latestBillMonth)}
            </span>
          )}
        </div>

        {/* Visual Bar Comparison Chart */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px", alignItems: "center" }}>
          {/* Chart Display */}
          <div
            style={{
              padding: "16px",
              background: "var(--surface-raised)",
              borderRadius: "12px",
              border: "1px solid var(--line)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-around", alignItems: "flex-end", height: "160px", padding: "10px 10px 0" }}>
              {/* Actual Billed Bar */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "40%" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                  {latestBillKwh != null ? `${latestBillKwh} kWh` : "No Bill"}
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(12, billedHeightPct)}%`,
                    maxHeight: "120px",
                    background: "linear-gradient(180deg, #3b82f6 0%, #1d4ed8 100%)",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.4s ease",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-secondary)", textAlign: "center" }}>
                  {t("Actual Billed")}
                </span>
              </div>

              {/* Declared Footprint Bar */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px", width: "40%" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#10b981" }}>
                  {result.totalMonthlyKwh} kWh
                </span>
                <div
                  style={{
                    width: "100%",
                    height: `${Math.max(12, simulatedHeightPct)}%`,
                    maxHeight: "120px",
                    background: "linear-gradient(180deg, #10b981 0%, #059669 100%)",
                    borderRadius: "6px 6px 0 0",
                    transition: "height 0.4s ease",
                  }}
                />
                <span style={{ fontSize: "11.5px", fontWeight: 600, color: "var(--ink-secondary)", textAlign: "center" }}>
                  {t("Simulated Load")}
                </span>
              </div>
            </div>

            <div style={{ textAlign: "center", marginTop: "12px", fontSize: "11.5px", color: "var(--muted)" }}>
              {latestBillKwh != null ? (
                <span>
                  {t("Variance:")}{" "}
                  <strong style={{ color: phantom.discrepancyKwh > 0 ? "#ef4444" : "#10b981" }}>
                    {phantom.discrepancyKwh > 0 ? `+${phantom.discrepancyKwh}` : phantom.discrepancyKwh} kWh (
                    {phantom.discrepancyPct > 0 ? `+${phantom.discrepancyPct}` : phantom.discrepancyPct}%)
                  </strong>
                </span>
              ) : (
                <span>{t("Upload a bill to display discrepancy against actual meter billing.")}</span>
              )}
            </div>
          </div>

          {/* Phantom Load Diagnosis & Financial Loss */}
          <div>
            <div
              style={{
                padding: "16px",
                borderRadius: "12px",
                border: `1px solid ${
                  phantom.severity === "high"
                    ? "rgba(239, 68, 68, 0.3)"
                    : phantom.severity === "medium"
                    ? "rgba(245, 158, 11, 0.3)"
                    : "rgba(16, 185, 129, 0.3)"
                }`,
                background:
                  phantom.severity === "high"
                    ? "rgba(239, 68, 68, 0.05)"
                    : phantom.severity === "medium"
                    ? "rgba(245, 158, 11, 0.05)"
                    : "rgba(16, 185, 129, 0.05)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
                {phantom.severity === "high" ? (
                  <AlertTriangle size={18} style={{ color: "#ef4444" }} />
                ) : phantom.severity === "medium" ? (
                  <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
                ) : (
                  <CheckCircle2 size={18} style={{ color: "#10b981" }} />
                )}
                <strong
                  style={{
                    fontSize: "14px",
                    color:
                      phantom.severity === "high"
                        ? "#dc2626"
                        : phantom.severity === "medium"
                        ? "#d97706"
                        : "#059669",
                  }}
                >
                  {phantom.title}
                </strong>
              </div>

              <p style={{ fontSize: "12.5px", margin: "0 0 10px", color: "var(--ink-secondary)" }}>
                {phantom.summary}
              </p>

              {phantom.estimatedLossPkr > 0 && (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "4px 10px",
                    background: "rgba(239, 68, 68, 0.12)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    color: "#dc2626",
                    fontWeight: 700,
                    marginBottom: "10px",
                  }}
                >
                  <span>💸 {t("Estimated Monthly Waste:")}</span>
                  <span>PKR {phantom.estimatedLossPkr.toLocaleString()}</span>
                </div>
              )}

              {phantom.diagnoses.length > 0 && (
                <div style={{ marginTop: "8px" }}>
                  <small style={{ fontWeight: 700, fontSize: "11.5px", color: "var(--ink-secondary)" }}>
                    {t("Top Culprits In Pakistani Households:")}
                  </small>
                  <ul style={{ margin: "4px 0 0", paddingLeft: "18px", fontSize: "12px", color: "var(--ink-secondary)" }}>
                    {phantom.diagnoses.map((d, idx) => (
                      <li key={idx} style={{ marginBottom: "3px" }}>
                        {d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Category Load Breakdown */}
      {result.categories.length > 0 && (
        <div style={{ marginBottom: "24px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, marginBottom: "12px" }}>
            {t("Consumption Share By Appliance Category")}
          </h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
            {result.categories.map((c) => (
              <div
                key={c.category}
                style={{
                  padding: "12px",
                  borderRadius: "10px",
                  background: "var(--surface)",
                  border: "1px solid var(--line)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                  <strong style={{ color: "var(--ink-secondary)" }}>{c.label}</strong>
                  <span style={{ fontWeight: 700, color: "#2563eb" }}>{c.percentOfTotal}%</span>
                </div>
                <div
                  style={{
                    width: "100%",
                    height: "6px",
                    background: "var(--line)",
                    borderRadius: "3px",
                    overflow: "hidden",
                    marginBottom: "6px",
                  }}
                >
                  <div
                    style={{
                      width: `${c.percentOfTotal}%`,
                      height: "100%",
                      background: c.color,
                      borderRadius: "3px",
                    }}
                  />
                </div>
                <small style={{ fontSize: "11px", color: "var(--muted)" }}>
                  {c.monthlyKwh} kWh {t("per month")}
                </small>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Summary Cards */}
      <div
        className="metric-grid"
        style={{
          marginTop: "16px",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div className="metric-card">
          <span className="metric-label">{t("Projected Monthly Units")}</span>
          <strong style={{ color: result.totalMonthlyKwh > 300 ? "#ef4444" : "#2563eb" }}>
            {result.totalMonthlyKwh} kWh
          </strong>
          <small>{result.isProtectedSlab ? t("Protected status maintained") : t("Un-protected rates apply")}</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Estimated Monthly Bill")}</span>
          <strong style={{ color: "#10b981" }}>{money(result.totalEstimatedCostPkr)}</strong>
          <small>{t("Progressive base tariff + duties")}</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Active Slab Bracket")}</span>
          <strong style={{ fontSize: "18px", color: "#6366f1" }}>
            {result.totalMonthlyKwh <= 200
              ? "0-200 kWh Tier"
              : result.totalMonthlyKwh <= 300
              ? "201-300 kWh Tier"
              : "301-400+ kWh Tier"}
          </strong>
          <small>{result.currentSlabName || "Baseline Lifeline"}</small>
        </div>
      </div>

      {/* Slab Boundary Alert Banner */}
      {result.slabThresholdAlert && (
        <div
          style={{
            margin: "18px 0",
            padding: "14px 18px",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
            borderRadius: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            color: "#b45309",
            fontSize: "13px",
          }}
        >
          <AlertTriangle size={20} style={{ flexShrink: 0 }} />
          <span>{result.slabThresholdAlert}</span>
        </div>
      )}

      {/* Appliance Interactive Grid */}
      <div style={{ marginTop: "24px" }}>
        <h3 style={{ fontSize: "15px", fontWeight: 700, marginBottom: "14px" }}>
          {t("Configure Household Appliances & Runtime Hours")}
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {usages.map((usage) => {
            const catalogItem = APPLIANCE_CATALOG.find((a) => a.id === usage.applianceId);
            const isCustom = !catalogItem;
            const name = catalogItem ? catalogItem.name : usage.customName || "Custom Device";
            const icon = catalogItem ? catalogItem.icon : "⚡";
            const desc = catalogItem
              ? catalogItem.description
              : `${usage.customWatts ?? 150}W custom declared appliance`;
            const kwhPerHour = catalogItem
              ? catalogItem.averageKwhPerHour
              : (usage.customWatts ?? 150) / 1000;

            const active = usage.quantity > 0 && usage.hoursPerDay > 0;
            const monthlyKwh = Math.round(
              kwhPerHour * usage.hoursPerDay * usage.quantity * 30 * 10,
            ) / 10;
            const avgRate =
              result.totalMonthlyKwh > 0
                ? result.totalEstimatedCostPkr / result.totalMonthlyKwh
                : 28;
            const cost = Math.round(monthlyKwh * avgRate);

            return (
              <div
                key={usage.applianceId}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: `1px solid ${active ? "rgba(37, 99, 235, 0.35)" : "var(--line)"}`,
                  background: active ? "rgba(37, 99, 235, 0.04)" : "var(--surface)",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "8px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{icon}</span>
                    <strong style={{ fontSize: "13.5px" }}>{name}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {isCustom && (
                      <button
                        type="button"
                        className="icon-button"
                        style={{ padding: "4px" }}
                        onClick={() => removeAppliance(usage.applianceId)}
                        title={t("Remove custom device")}
                      >
                        <Trash2 size={14} style={{ color: "#ef4444" }} />
                      </button>
                    )}
                    <button
                      type="button"
                      className="button button-outline"
                      style={{ minHeight: "26px", padding: "0 8px", fontSize: "12px" }}
                      onClick={() => updateQuantity(usage.applianceId, usage.quantity - 1)}
                    >
                      -
                    </button>
                    <span style={{ minWidth: "16px", textAlign: "center", fontWeight: 700 }}>
                      {usage.quantity}
                    </span>
                    <button
                      type="button"
                      className="button button-outline"
                      style={{ minHeight: "26px", padding: "0 8px", fontSize: "12px" }}
                      onClick={() => updateQuantity(usage.applianceId, usage.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: "10px" }}>
                  {desc}
                </div>

                {usage.quantity > 0 && (
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "12px",
                        marginBottom: "4px",
                      }}
                    >
                      <span>{t("Daily use:")}</span>
                      <strong>{usage.hoursPerDay} hrs/day</strong>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={24}
                      step={0.5}
                      value={usage.hoursPerDay}
                      onChange={(e) =>
                        updateHours(usage.applianceId, parseFloat(e.target.value))
                      }
                      style={{ width: "100%", accentColor: "#2563eb", marginBottom: "8px" }}
                    />
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "11.5px",
                        paddingTop: "6px",
                        borderTop: "1px dashed var(--line)",
                      }}
                    >
                      <span>{monthlyKwh} kWh / month</span>
                      <strong style={{ color: "#2563eb" }}>~PKR {cost.toLocaleString()}</strong>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
