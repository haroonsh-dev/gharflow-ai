"use client";

import { useState } from "react";
import { Zap, Sparkles, AlertTriangle, ShieldCheck, ArrowRight } from "lucide-react";
import { t } from "@/lib/copy";
import {
  APPLIANCE_CATALOG,
  simulateApplianceLoad,
  type ApplianceUsage,
} from "@/lib/appliances";
import { money } from "./ui";

export default function ApplianceSimulator() {
  const [usages, setUsages] = useState<ApplianceUsage[]>(() =>
    APPLIANCE_CATALOG.map((a) => ({
      applianceId: a.id,
      quantity: a.defaultQuantity,
      hoursPerDay: a.defaultHoursPerDay,
    })),
  );

  const [isProtected, setIsProtected] = useState(true);

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
          ? { ...u, hoursPerDay: Math.max(0, Math.min(24, hrs)) }
          : u,
      ),
    );
  }

  const result = simulateApplianceLoad(usages, isProtected);

  return (
    <section className="card appliance-simulator" style={{ marginTop: "24px" }}>
      <div className="section-heading" style={{ flexWrap: "wrap", gap: "12px" }}>
        <div>
          <span className="eyebrow">
            <Sparkles size={13} />
            {t("APPLIANCE LOAD FORENSICS & SLAB KILLER SIMULATOR")}
          </span>
          <h2>{t("Which appliance is pushing your tariff up?")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t(
              "Model your household devices against Pakistani progressive electricity slabs to discover exact rupee costs and prevent non-protected tier penalties.",
            )}
          </p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <label style={{ fontSize: "12px", color: "var(--muted)", cursor: "pointer", display: "flex", alignItems: "center", gap: "6px" }}>
            <input
              type="checkbox"
              checked={isProtected}
              onChange={(e) => setIsProtected(e.target.checked)}
            />
            {t("Baseline Protected Consumer (≤ 200 kWh)")}
          </label>
        </div>
      </div>

      {/* KPI Cards */}
      <div
        className="metric-grid"
        style={{
          marginTop: "20px",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div className="metric-card">
          <span className="metric-label">{t("Projected Monthly Units")}</span>
          <strong style={{ color: result.totalMonthlyKwh > 300 ? "#ef4444" : "#2563eb" }}>
            {result.totalMonthlyKwh} kWh
          </strong>
          <small>{result.isProtectedSlab ? t("Protected status maintained") : t("Un-protected higher rates apply")}</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Estimated Monthly Bill")}</span>
          <strong style={{ color: "#10b981" }}>{money(result.totalEstimatedCostPkr)}</strong>
          <small>{t("Based on progressive slab rates")}</small>
        </div>

        <div className="metric-card">
          <span className="metric-label">{t("Active Slab Bracket")}</span>
          <strong style={{ fontSize: "18px", color: "#6366f1" }}>
            {result.totalMonthlyKwh <= 200 ? "0-200 kWh Tier" : result.totalMonthlyKwh <= 300 ? "201-300 kWh Tier" : "301-400+ kWh Tier"}
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
          {t("Configure Household Appliances")}
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "14px",
          }}
        >
          {APPLIANCE_CATALOG.map((appliance) => {
            const usage = usages.find((u) => u.applianceId === appliance.id) ?? {
              quantity: 0,
              hoursPerDay: 0,
            };
            const active = usage.quantity > 0 && usage.hoursPerDay > 0;
            const monthlyKwh = Math.round(
              appliance.averageKwhPerHour * usage.hoursPerDay * usage.quantity * 30 * 10,
            ) / 10;
            const avgRate =
              result.totalMonthlyKwh > 0
                ? result.totalEstimatedCostPkr / result.totalMonthlyKwh
                : 28;
            const cost = Math.round(monthlyKwh * avgRate);

            return (
              <div
                key={appliance.id}
                style={{
                  padding: "14px",
                  borderRadius: "12px",
                  border: `1px solid ${active ? "rgba(37, 99, 235, 0.35)" : "var(--line)"}`,
                  background: active ? "rgba(37, 99, 235, 0.04)" : "var(--surface)",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{appliance.icon}</span>
                    <strong style={{ fontSize: "13.5px" }}>{appliance.name}</strong>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <button
                      type="button"
                      className="button button-outline"
                      style={{ minHeight: "26px", padding: "0 8px", fontSize: "12px" }}
                      onClick={() => updateQuantity(appliance.id, usage.quantity - 1)}
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
                      onClick={() => updateQuantity(appliance.id, usage.quantity + 1)}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: "10px" }}>
                  {appliance.description}
                </div>

                {usage.quantity > 0 && (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                      <span>{t("Daily use:")}</span>
                      <strong>{usage.hoursPerDay} hrs/day</strong>
                    </div>
                    <input
                      type="range"
                      min={0.5}
                      max={24}
                      step={0.5}
                      value={usage.hoursPerDay}
                      onChange={(e) => updateHours(appliance.id, parseFloat(e.target.value))}
                      style={{ width: "100%", accentColor: "#2563eb", marginBottom: "8px" }}
                    />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", paddingTop: "6px", borderTop: "1px dashed var(--line)" }}>
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
