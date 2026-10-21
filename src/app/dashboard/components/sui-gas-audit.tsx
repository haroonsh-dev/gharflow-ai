"use client";

import { useState } from "react";
import {
  Flame,
  AlertTriangle,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  TrendingUp,
  Info,
  ShieldCheck,
  Sliders,
  DollarSign,
  ArrowRight,
} from "lucide-react";
import {
  GasProvider,
  GasCategory,
  identifyGasProvider,
  convertVolumeToMmbtu,
  auditGasMmbtu,
  calculateGasBill,
  simulateWinterGasAppliances,
  generateOgraDisputeLetter,
  DEFAULT_DOMESTIC_GCV,
  PROTECTED_CEILING_HM3,
  OGRA_SLABS,
} from "@/lib/sui-gas";

export default function SuiGasAudit({ isDemo }: { isDemo?: boolean }) {
  // Provider and Bill inputs
  const [consumerNumber, setConsumerNumber] = useState("08234567891");
  const [provider, setProvider] = useState<GasProvider>("sngpl");
  const [billMonth, setBillMonth] = useState("2026-01");
  const [volumeHm3, setVolumeHm3] = useState(0.85);
  const [billedMmbtu, setBilledMmbtu] = useState(3.0);
  const [billedCategory, setBilledCategory] = useState<GasCategory>("unprotected");
  const [gcv, setGcv] = useState(DEFAULT_DOMESTIC_GCV);

  // Winter Appliance Simulator Inputs
  const [hasGeyser, setHasGeyser] = useState(true);
  const [geyserPilot24x7, setGeyserPilot24x7] = useState(true);
  const [geyserHours, setGeyserHours] = useState(2);
  const [roomHeaters, setRoomHeaters] = useState(1);
  const [heaterHours, setHeaterHours] = useState(4);
  const [stoveBurners, setStoveBurners] = useState(2);
  const [stoveHours, setStoveHours] = useState(3);

  // Copy dispute state
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"auditor" | "simulator" | "dispute">("auditor");

  // Calculations
  const mmbtuAudit = auditGasMmbtu(volumeHm3, billedMmbtu, gcv);
  const billAudit = calculateGasBill(
    volumeHm3,
    volumeHm3 <= PROTECTED_CEILING_HM3 ? "protected" : "unprotected",
    gcv,
    1.0,
    billedCategory,
  );

  const simulation = simulateWinterGasAppliances({
    hasGeyser,
    geyserPilot24x7,
    geyserHeatingHoursDaily: geyserHours,
    roomHeatersCount: roomHeaters,
    heaterHoursDaily: heaterHours,
    stoveBurnersCount: stoveBurners,
    stoveHoursDaily: stoveHours,
  });

  const disputeLetter = generateOgraDisputeLetter({
    consumerName: isDemo ? "Tariq Mahmood" : "Aggrieved Consumer",
    consumerNumber: consumerNumber || "08234567891",
    provider,
    city: provider === "sngpl" ? "Lahore / Islamabad" : "Karachi",
    billMonth,
    billedHm3: volumeHm3,
    billedMmbtu,
    disputeReason: billAudit.isMisclassifiedAsUnprotected
      ? "misclassification"
      : mmbtuAudit.hasMmbtuDiscrepancy
      ? "gcv_inflation"
      : "excess_meter_rent",
    potentialSavingsPkr: billAudit.potentialSavingsPkr || 1500,
  });

  function applyPreset(name: "protected" | "unprotected_penalty" | "winter_surge" | "gcv_inflation") {
    if (name === "protected") {
      setVolumeHm3(0.75);
      setBilledMmbtu(2.65);
      setBilledCategory("protected");
      setHasGeyser(true);
      setGeyserPilot24x7(false);
      setGeyserHours(1.5);
      setRoomHeaters(0);
      setHeaterHours(0);
    } else if (name === "unprotected_penalty") {
      // Billed under unprotected even though 0.82 <= 0.90
      setVolumeHm3(0.82);
      setBilledMmbtu(2.89);
      setBilledCategory("unprotected"); // deliberate overbilling
    } else if (name === "winter_surge") {
      setVolumeHm3(2.45);
      setBilledMmbtu(8.65);
      setBilledCategory("unprotected");
      setHasGeyser(true);
      setGeyserPilot24x7(true);
      setGeyserHours(3);
      setRoomHeaters(2);
      setHeaterHours(6);
    } else if (name === "gcv_inflation") {
      setVolumeHm3(1.2);
      setBilledMmbtu(5.5); // Inflated MMBTU vs expected ~4.23
      setBilledCategory("unprotected");
    }
  }

  function handleConsumerChange(val: string) {
    setConsumerNumber(val);
    const identified = identifyGasProvider(val);
    if (identified) {
      setProvider(identified.provider);
    }
  }

  async function copyDispute() {
    try {
      await navigator.clipboard.writeText(disputeLetter);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Presets */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-50 text-orange-600">
                <Flame size={18} />
              </span>
              <h2 className="text-lg font-semibold text-slate-900">
                Sui Gas (SSGC & SNGPL) Audit & MMBTU Engine
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Audits volume-to-energy conversion, OGRA progressive domestic slabs, protected vs. unprotected penalties, and winter geyser surges.
            </p>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-slate-500 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset("protected")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              Protected (0.75 HM³)
            </button>
            <button
              type="button"
              onClick={() => applyPreset("unprotected_penalty")}
              className="rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition"
            >
              Misclassified Penalty
            </button>
            <button
              type="button"
              onClick={() => applyPreset("winter_surge")}
              className="rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 transition"
            >
              Winter Heater Surge
            </button>
            <button
              type="button"
              onClick={() => applyPreset("gcv_inflation")}
              className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
            >
              GCV Inflation
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="mt-5 flex border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab("auditor")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold transition ${
              activeTab === "auditor"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <ShieldCheck size={14} />
            Bill & Slab Audit
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("simulator")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold transition ${
              activeTab === "simulator"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <Sliders size={14} />
            Winter Geyser & Heater Surge
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("dispute")}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 text-xs font-semibold transition ${
              activeTab === "dispute"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <FileText size={14} />
            OGRA Dispute Petition
          </button>
        </div>
      </div>

      {/* TAB 1: Bill & Slab Audit */}
      {activeTab === "auditor" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Form Inputs */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Flame size={15} className="text-orange-500" />
              Gas Connection Details
            </h3>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Gas Utility Provider
              </label>
              <select
                value={provider}
                onChange={(e) => setProvider(e.target.value as GasProvider)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="sngpl">SNGPL (Punjab, KPK, Islamabad, AJK)</option>
                <option value="ssgc">SSGC (Sindh, Karachi, Balochistan)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Consumer Number (10 or 11 digits)
              </label>
              <input
                type="text"
                value={consumerNumber}
                onChange={(e) => handleConsumerChange(e.target.value)}
                placeholder="e.g. 08234567891"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Billed Volume (HM³)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={volumeHm3}
                  onChange={(e) => setVolumeHm3(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">1 HM³ = 100 M³</span>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Billed Energy (MMBTU)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={billedMmbtu}
                  onChange={(e) => setBilledMmbtu(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
                <span className="text-[10px] text-slate-400 mt-0.5 block">From printed bill</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Billed Category on Invoice
              </label>
              <select
                value={billedCategory}
                onChange={(e) => setBilledCategory(e.target.value as GasCategory)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="protected">Protected (Avg Winter ≤ 0.90 HM³)</option>
                <option value="unprotected">Unprotected (Consumption &gt; 0.90 HM³)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                GCV (Gross Calorific Value)
              </label>
              <input
                type="number"
                value={gcv}
                onChange={(e) => setGcv(Number(e.target.value) || DEFAULT_DOMESTIC_GCV)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Standard: 900 - 1,000 BTU/cu.ft
              </span>
            </div>
          </div>

          {/* Audit Results & Diagnostics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Misclassification Alert Banner */}
            {billAudit.isMisclassifiedAsUnprotected && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertTriangle size={15} />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-red-900">
                      Illegal Protected Tariff Denial Detected
                    </h4>
                    <p className="mt-1 text-xs text-red-700 leading-relaxed">
                      Your monthly consumption of <strong>{volumeHm3} HM³</strong> qualifies for the gazetted <strong>Protected Category</strong> (&le; 0.90 HM³), but you were billed under the punitive <strong>Unprotected</strong> tariff and charged Rs. {billAudit.meterRentPkr} meter rent instead of Rs. 400.
                    </p>
                    <div className="mt-3 flex items-center gap-2">
                      <span className="rounded-md bg-red-600 px-2.5 py-1 text-xs font-bold text-white">
                        Potential Overcharge: PKR {billAudit.potentialSavingsPkr.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => setActiveTab("dispute")}
                        className="text-xs font-medium text-red-800 underline hover:text-red-950"
                      >
                        Generate OGRA Dispute Petition &rarr;
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MMBTU Discrepancy Banner */}
            {mmbtuAudit.hasMmbtuDiscrepancy && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    <AlertTriangle size={15} />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-amber-900">
                      MMBTU Energy Conversion Discrepancy
                    </h4>
                    <p className="mt-1 text-xs text-amber-800 leading-relaxed">
                      {mmbtuAudit.notes} Physical gas volume of {volumeHm3} HM³ converts to <strong>{mmbtuAudit.expectedMmbtu} MMBTU</strong>, but the bill charges <strong>{billedMmbtu} MMBTU</strong> (+{(mmbtuAudit.differenceMmbtu).toFixed(2)} MMBTU excess).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Financial Summary Cards */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500">Calculated Energy</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {mmbtuAudit.expectedMmbtu} <span className="text-xs font-normal text-slate-500">MMBTU</span>
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500">Base Gas Charges</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  PKR {billAudit.gasChargesPkr.toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500">Meter Rent + 18% GST</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  PKR {(billAudit.meterRentPkr + billAudit.gstPkr).toLocaleString()}
                </div>
              </div>

              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3.5 shadow-sm">
                <div className="text-[11px] font-medium text-blue-700">Total Payable Bill</div>
                <div className="mt-1 text-base font-bold text-blue-900">
                  PKR {billAudit.totalPayablePkr.toLocaleString()}
                </div>
              </div>
            </div>

            {/* Progressive Slabs Breakdown */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h4 className="text-xs font-semibold text-slate-800 mb-3 flex items-center justify-between">
                <span>OGRA Gazetted Progressive Slabs ({billAudit.category.toUpperCase()})</span>
                <span className="text-[10px] text-slate-400">Low pressure domestic tariff</span>
              </h4>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="pb-2">Tier Description</th>
                      <th className="pb-2">Allocated Vol</th>
                      <th className="pb-2">Energy (MMBTU)</th>
                      <th className="pb-2">Rate/MMBTU</th>
                      <th className="pb-2 text-right">Cost (PKR)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 text-slate-700">
                    {billAudit.allocations.map((alloc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition">
                        <td className="py-2 font-medium text-slate-900">{alloc.tier}</td>
                        <td className="py-2 font-mono">{alloc.allocatedHm3} HM³</td>
                        <td className="py-2 font-mono">{alloc.allocatedMmbtu}</td>
                        <td className="py-2 font-mono">Rs. {alloc.ratePerMmbtu}</td>
                        <td className="py-2 text-right font-mono font-medium text-slate-900">
                          Rs. {alloc.costPkr.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-200 font-semibold text-slate-900">
                      <td colSpan={4} className="pt-2">Gas Subtotal</td>
                      <td className="pt-2 text-right font-mono">Rs. {billAudit.gasChargesPkr.toLocaleString()}</td>
                    </tr>
                    <tr className="text-slate-600 text-xs">
                      <td colSpan={4} className="py-1">Fixed Meter Rent ({billAudit.category})</td>
                      <td className="py-1 text-right font-mono">Rs. {billAudit.meterRentPkr}</td>
                    </tr>
                    <tr className="text-slate-600 text-xs">
                      <td colSpan={4} className="py-1">18% General Sales Tax (GST)</td>
                      <td className="py-1 text-right font-mono">Rs. {billAudit.gstPkr}</td>
                    </tr>
                    <tr className="border-t border-slate-200 text-sm font-bold text-blue-700">
                      <td colSpan={4} className="pt-2">Total Amount Payable</td>
                      <td className="pt-2 text-right font-mono">PKR {billAudit.totalPayablePkr.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Winter Geyser & Heater Surge Simulator */}
      {activeTab === "simulator" && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
              <Sliders size={15} className="text-blue-600" />
              Winter Gas Appliances Setup
            </h3>

            {/* Geyser Section */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800">Water Geyser</span>
                <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasGeyser}
                    onChange={(e) => setHasGeyser(e.target.checked)}
                    className="rounded text-blue-600"
                  />
                  Active
                </label>
              </div>

              {hasGeyser && (
                <>
                  <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer bg-white p-2 rounded border border-slate-200">
                    <input
                      type="checkbox"
                      checked={geyserPilot24x7}
                      onChange={(e) => setGeyserPilot24x7(e.target.checked)}
                      className="rounded text-blue-600"
                    />
                    <span>
                      <strong>Pilot Flame 24/7</strong>
                      <span className="block text-[10px] text-slate-400">
                        Consumes ~0.02 HM³/day (~0.60 HM³/mo) in wasted pilot flame
                      </span>
                    </span>
                  </label>

                  <div>
                    <div className="flex justify-between text-xs text-slate-700 mb-1">
                      <span>Heating Burner:</span>
                      <span className="font-mono font-medium">{geyserHours} hrs/day</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="8"
                      step="0.5"
                      value={geyserHours}
                      onChange={(e) => setGeyserHours(Number(e.target.value))}
                      className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>

            {/* Room Heater Section */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-800">
                <span>Space Room Heaters</span>
                <span className="font-mono text-blue-600">{roomHeaters} units</span>
              </div>
              <input
                type="range"
                min="0"
                max="4"
                step="1"
                value={roomHeaters}
                onChange={(e) => setRoomHeaters(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
              />

              {roomHeaters > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-slate-700 mb-1">
                    <span>Usage Duration:</span>
                    <span className="font-mono font-medium">{heaterHours} hrs/day</span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="14"
                    step="1"
                    value={heaterHours}
                    onChange={(e) => setHeaterHours(Number(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    ~0.045 HM³ per heater hour
                  </span>
                </div>
              )}
            </div>

            {/* Cooking Stove Section */}
            <div className="rounded-lg border border-slate-100 bg-slate-50 p-3.5 space-y-3">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-800">
                <span>Cooking Stove Burners</span>
                <span className="font-mono text-blue-600">{stoveBurners} burners</span>
              </div>
              <div>
                <div className="flex justify-between text-xs text-slate-700 mb-1">
                  <span>Daily Cooking Hours:</span>
                  <span className="font-mono font-medium">{stoveHours} hrs/day</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="8"
                  step="0.5"
                  value={stoveHours}
                  onChange={(e) => setStoveHours(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Simulator Visual Impact & Cliff Warning */}
          <div className="lg:col-span-2 space-y-4">
            {/* The 0.90 HM3 Cliff Alert */}
            {simulation.isCrossingProtectedCliff ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertTriangle size={15} />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-red-900">
                      Warning: Breached 0.90 HM³ Protected Tariff Cliff!
                    </h4>
                    <p className="mt-1 text-xs text-red-700 leading-relaxed">
                      Your simulated winter monthly volume is <strong>{simulation.monthlyVolumeHm3} HM³</strong>, which knocks you into the <strong>Unprotected Category</strong>. Your fixed meter rent spikes from Rs. 400 to Rs. 1,000, and tariff per MMBTU multiplies up to 4x!
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <CheckCircle2 size={15} />
                  </span>
                  <div>
                    <h4 className="text-xs font-semibold text-emerald-900">
                      Safe: Under 0.90 HM³ Protected Ceiling
                    </h4>
                    <p className="mt-1 text-xs text-emerald-800 leading-relaxed">
                      Your simulated consumption of <strong>{simulation.monthlyVolumeHm3} HM³</strong> stays within the Protected domestic threshold. You enjoy heavily subsidized rates (~Rs. 200 - 300 / MMBTU).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Threshold Gauge Bar */}
            <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-2">
                <span>Monthly Volume Towards Protected Cliff:</span>
                <span className="font-mono font-bold">
                  {simulation.monthlyVolumeHm3} / 0.90 HM³
                </span>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className={`h-full transition-all duration-300 ${
                    simulation.isCrossingProtectedCliff ? "bg-red-500" : "bg-emerald-500"
                  }`}
                  style={{
                    width: `${Math.min(100, (simulation.monthlyVolumeHm3 / 0.90) * 100)}%`,
                  }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-1">
                <span>0.0 HM³ (Subsidized)</span>
                <span className="font-medium text-slate-600">0.90 HM³ Protected Threshold</span>
                <span>2.0+ HM³ (Unprotected Punitive)</span>
              </div>
            </div>

            {/* Consumption Breakdown Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500">Geyser Monthly Share</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {simulation.geyserWasteHm3} <span className="text-xs font-normal text-slate-500">HM³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {geyserPilot24x7 ? "Includes 24/7 pilot loss" : "Pilot extinguished"}
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500">Room Heaters Share</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {simulation.heaterConsumptionHm3} <span className="text-xs font-normal text-slate-500">HM³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {roomHeaters} units &times; {heaterHours} hrs/day
                </div>
              </div>

              <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="text-[11px] font-medium text-slate-500">Cooking Stove Share</div>
                <div className="mt-1 text-base font-bold text-slate-900">
                  {simulation.stoveConsumptionHm3} <span className="text-xs font-normal text-slate-500">HM³</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  {stoveBurners} burners &times; {stoveHours} hrs/day
                </div>
              </div>
            </div>

            {/* Total Estimated Bill Card */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <span className="text-xs font-semibold text-blue-900 uppercase tracking-wider">
                  Projected Winter Monthly Bill
                </span>
                <div className="mt-1 text-2xl font-black text-blue-950 font-mono">
                  PKR {simulation.estimatedMonthlyBillPkr.toLocaleString()}
                </div>
                <p className="mt-1 text-xs text-blue-800">
                  Category: <strong>{simulation.category.toUpperCase()}</strong> &bull; Total Energy:{" "}
                  <strong>{simulation.projectedMmbtu} MMBTU</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setVolumeHm3(simulation.monthlyVolumeHm3);
                  setBilledMmbtu(simulation.projectedMmbtu);
                  setBilledCategory(simulation.category);
                  setActiveTab("auditor");
                }}
                className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition"
              >
                <span>Audit This in Slabs</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: OGRA Dispute Package */}
      {activeTab === "dispute" && (
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <FileText size={16} className="text-blue-600" />
                Official OGRA Dispute Petition
              </h3>
              <p className="text-xs text-slate-500">
                Statutory petition under OGRA Complaint Resolution Procedure Regulations 2003 and Section 7 of OGRA Ordinance 2002.
              </p>
            </div>

            <button
              type="button"
              onClick={copyDispute}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              {copied ? (
                <>
                  <Check size={14} className="text-emerald-600" />
                  <span className="text-emerald-600">Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>Copy Petition Text</span>
                </>
              )}
            </button>
          </div>

          <pre className="rounded-lg border border-slate-200 bg-slate-900 p-4 text-xs font-mono text-slate-100 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-[500px]">
            {disputeLetter}
          </pre>
        </div>
      )}
    </div>
  );
}
