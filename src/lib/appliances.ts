import { calculateSlabDistribution } from "./tariffs";

export type ApplianceDef = {
  id: string;
  name: string;
  category: "cooling" | "heating" | "motors" | "appliances" | "power";
  typicalWatts: number;
  averageKwhPerHour: number;
  defaultHoursPerDay: number;
  defaultQuantity: number;
  icon: string;
  description: string;
};

export const APPLIANCE_CATALOG: ApplianceDef[] = [
  {
    id: "ac_1_5_ton",
    name: "1.5 Ton Inverter AC (26°C)",
    category: "cooling",
    typicalWatts: 1400,
    averageKwhPerHour: 0.95,
    defaultHoursPerDay: 8,
    defaultQuantity: 1,
    icon: "❄️",
    description: "Cruising load in summer at eco 26°C setting",
  },
  {
    id: "ac_1_0_ton",
    name: "1.0 Ton Inverter AC (26°C)",
    category: "cooling",
    typicalWatts: 1000,
    averageKwhPerHour: 0.65,
    defaultHoursPerDay: 8,
    defaultQuantity: 0,
    icon: "❄️",
    description: "Small room inverter air conditioner",
  },
  {
    id: "ac_2_0_ton",
    name: "2.0 Ton Inverter AC (26°C)",
    category: "cooling",
    typicalWatts: 2000,
    averageKwhPerHour: 1.45,
    defaultHoursPerDay: 6,
    defaultQuantity: 0,
    icon: "❄️",
    description: "Large lounge or open area air conditioner",
  },
  {
    id: "refrigerator",
    name: "Inverter Refrigerator",
    category: "cooling",
    typicalWatts: 120,
    averageKwhPerHour: 0.08,
    defaultHoursPerDay: 24,
    defaultQuantity: 1,
    icon: "🧊",
    description: "Compressor cycling (~1.9 kWh per 24 hours)",
  },
  {
    id: "deep_freezer",
    name: "Chest Deep Freezer",
    category: "cooling",
    typicalWatts: 180,
    averageKwhPerHour: 0.12,
    defaultHoursPerDay: 24,
    defaultQuantity: 0,
    icon: "🥩",
    description: "Heavy cooling cycling (~2.8 kWh per 24 hours)",
  },
  {
    id: "water_pump_1hp",
    name: "1 HP Water Pumping Motor",
    category: "motors",
    typicalWatts: 750,
    averageKwhPerHour: 0.8,
    defaultHoursPerDay: 1.0,
    defaultQuantity: 1,
    icon: "💧",
    description: "Roof tank filling / suction pump (1 hour/day)",
  },
  {
    id: "water_pump_2hp",
    name: "2 HP Deep Boring Motor",
    category: "motors",
    typicalWatts: 1500,
    averageKwhPerHour: 1.6,
    defaultHoursPerDay: 1.0,
    defaultQuantity: 0,
    icon: "🚰",
    description: "Deep underground boring water extraction",
  },
  {
    id: "geyser_electric",
    name: "Electric Water Geyser",
    category: "heating",
    typicalWatts: 2000,
    averageKwhPerHour: 2.0,
    defaultHoursPerDay: 2.5,
    defaultQuantity: 0,
    icon: "🔥",
    description: "Winter water heating element (very high consumption)",
  },
  {
    id: "ups_losses",
    name: "UPS / Battery Charging Loss",
    category: "power",
    typicalWatts: 150,
    averageKwhPerHour: 0.12,
    defaultHoursPerDay: 20,
    defaultQuantity: 1,
    icon: "🔋",
    description: "Inverter conversion & battery float charging losses",
  },
  {
    id: "ceiling_fans",
    name: "Ceiling Fans (AC / Inverter)",
    category: "appliances",
    typicalWatts: 65,
    averageKwhPerHour: 0.065,
    defaultHoursPerDay: 14,
    defaultQuantity: 4,
    icon: "🌀",
    description: "Standard household ceiling fans",
  },
  {
    id: "iron",
    name: "Clothes Iron",
    category: "heating",
    typicalWatts: 1000,
    averageKwhPerHour: 1.0,
    defaultHoursPerDay: 0.5,
    defaultQuantity: 1,
    icon: "👔",
    description: "Dry or steam clothes iron (30 mins/day)",
  },
];

export type ApplianceUsage = {
  applianceId: string;
  quantity: number;
  hoursPerDay: number;
  customName?: string;
  customWatts?: number;
  category?: "cooling" | "heating" | "motors" | "appliances" | "power";
};

export type ApplianceBreakdownItem = {
  appliance: ApplianceDef;
  quantity: number;
  hoursPerDay: number;
  dailyKwh: number;
  monthlyKwh: number;
  estimatedCostPkr: number;
  percentOfTotal: number;
};

export type CategoryBreakdown = {
  category: "cooling" | "heating" | "motors" | "appliances" | "power";
  label: string;
  monthlyKwh: number;
  percentOfTotal: number;
  color: string;
};

export type ApplianceSimulationResult = {
  totalMonthlyKwh: number;
  totalEstimatedCostPkr: number;
  currentSlabName: string;
  isProtectedSlab: boolean;
  slabThresholdAlert?: string;
  items: ApplianceBreakdownItem[];
  categories: CategoryBreakdown[];
};

export type HouseholdApplianceProfile = {
  id?: string;
  householdId?: string;
  referenceNumber: string;
  name: string;
  usages: ApplianceUsage[];
  isProtected: boolean;
  updatedAt?: string;
};

export type PhantomLoadAnalysis = {
  simulatedMonthlyKwh: number;
  actualBilledKwh: number | null;
  discrepancyKwh: number;
  discrepancyPct: number;
  status: "excess_critical" | "excess_warning" | "aligned" | "under_reported" | "no_bill";
  severity: "high" | "medium" | "low" | "none";
  title: string;
  summary: string;
  diagnoses: string[];
  estimatedLossPkr: number;
  recommendations: string[];
};

/**
 * Calculates detailed monthly electricity consumption and costs for selected appliances
 * mapped against Pakistani progressive tariff slabs.
 */
export function simulateApplianceLoad(
  usages: ApplianceUsage[],
  isProtectedBaseline = true,
): ApplianceSimulationResult {
  let totalMonthlyKwh = 0;
  const itemsIntermediate: {
    appliance: ApplianceDef;
    quantity: number;
    hoursPerDay: number;
    dailyKwh: number;
    monthlyKwh: number;
  }[] = [];

  for (const usage of usages) {
    if (usage.quantity <= 0 || usage.hoursPerDay <= 0) continue;
    let def = APPLIANCE_CATALOG.find((a) => a.id === usage.applianceId);
    if (!def && usage.customName) {
      const watts = usage.customWatts && usage.customWatts > 0 ? usage.customWatts : 150;
      def = {
        id: usage.applianceId,
        name: usage.customName,
        category: usage.category ?? "appliances",
        typicalWatts: watts,
        averageKwhPerHour: watts / 1000,
        defaultHoursPerDay: usage.hoursPerDay,
        defaultQuantity: usage.quantity,
        icon: "⚡",
        description: "Custom user appliance",
      };
    }
    if (!def) continue;

    const dailyKwh = def.averageKwhPerHour * usage.hoursPerDay * usage.quantity;
    const monthlyKwh = Math.round(dailyKwh * 30 * 10) / 10;
    totalMonthlyKwh += monthlyKwh;

    itemsIntermediate.push({
      appliance: def,
      quantity: usage.quantity,
      hoursPerDay: usage.hoursPerDay,
      dailyKwh,
      monthlyKwh,
    });
  }

  // Calculate overall cost using Pakistani progressive tariff engine
  const category = totalMonthlyKwh <= 200 && isProtectedBaseline ? "protected" : "unprotected";
  const tariffResult = calculateSlabDistribution(Math.round(totalMonthlyKwh), category);

  const averageUnitRate =
    totalMonthlyKwh > 0 ? tariffResult.baseCost / totalMonthlyKwh : 25;

  const items: ApplianceBreakdownItem[] = itemsIntermediate.map((item) => {
    const cost = Math.round(item.monthlyKwh * averageUnitRate);
    const pct =
      totalMonthlyKwh > 0
        ? Math.round((item.monthlyKwh / totalMonthlyKwh) * 100)
        : 0;
    return {
      ...item,
      estimatedCostPkr: cost,
      percentOfTotal: pct,
    };
  });

  // Sort items from highest consumer to lowest
  items.sort((a, b) => b.monthlyKwh - a.monthlyKwh);

  // Group by category
  const categoryMeta: Record<
    "cooling" | "heating" | "motors" | "appliances" | "power",
    { label: string; color: string }
  > = {
    cooling: { label: "Cooling & ACs", color: "#38bdf8" },
    heating: { label: "Water & Heating", color: "#f97316" },
    motors: { label: "Water Pumps & Motors", color: "#06b6d4" },
    appliances: { label: "General Appliances & Fans", color: "#8b5cf6" },
    power: { label: "UPS & Power Losses", color: "#eab308" },
  };

  const categoryTotals: Record<string, number> = {
    cooling: 0,
    heating: 0,
    motors: 0,
    appliances: 0,
    power: 0,
  };

  for (const item of items) {
    categoryTotals[item.appliance.category] =
      (categoryTotals[item.appliance.category] ?? 0) + item.monthlyKwh;
  }

  const categories: CategoryBreakdown[] = (
    Object.keys(categoryMeta) as (keyof typeof categoryMeta)[]
  )
    .map((catKey) => {
      const kwh = Math.round((categoryTotals[catKey] ?? 0) * 10) / 10;
      return {
        category: catKey,
        label: categoryMeta[catKey].label,
        monthlyKwh: kwh,
        percentOfTotal:
          totalMonthlyKwh > 0 ? Math.round((kwh / totalMonthlyKwh) * 100) : 0,
        color: categoryMeta[catKey].color,
      };
    })
    .filter((c) => c.monthlyKwh > 0)
    .sort((a, b) => b.monthlyKwh - a.monthlyKwh);

  // Slab threshold detection & advice
  let slabAlert: string | undefined;
  if (totalMonthlyKwh > 200 && totalMonthlyKwh <= 300) {
    slabAlert =
      "⚠️ Consuming over 200 kWh removes 'Protected Consumer' status, causing unit base rates to nearly double (from ~Rs 14.50 to ~Rs 29.50/unit).";
  } else if (totalMonthlyKwh > 300 && totalMonthlyKwh <= 400) {
    slabAlert =
      "⚠️ Billed units have crossed 300 kWh into the higher un-protected tier (Rs 34.26/unit base rate + higher FPA & GST).";
  } else if (totalMonthlyKwh > 700) {
    slabAlert =
      "🚨 Peak slab breach: Over 700 kWh triggers the maximum residential tariff (Rs 48.84/unit base rate + maximum statutory surcharges).";
  }

  return {
    totalMonthlyKwh: Math.round(totalMonthlyKwh),
    totalEstimatedCostPkr: Math.round(tariffResult.baseCost),
    currentSlabName: tariffResult.allocations.map((s) => s.slab).join(" + "),
    isProtectedSlab: category === "protected",
    slabThresholdAlert: slabAlert,
    items,
    categories,
  };
}

/**
 * Compares simulated appliance load against actual utility bill kWh to detect phantom loads,
 * neutral ground leakage, or defective meter fast-spinning.
 */
export function analyzePhantomLoad(
  simulatedMonthlyKwh: number,
  actualBilledKwh: number | null,
  isProtected = true,
): PhantomLoadAnalysis {
  if (actualBilledKwh == null || actualBilledKwh <= 0) {
    return {
      simulatedMonthlyKwh,
      actualBilledKwh: null,
      discrepancyKwh: 0,
      discrepancyPct: 0,
      status: "no_bill",
      severity: "none",
      title: "No Billed Units Available",
      summary:
        "Add or confirm a utility bill to compare your declared appliance footprint against actual billed consumption.",
      diagnoses: [],
      estimatedLossPkr: 0,
      recommendations: [
        "Upload or fetch your latest utility bill to run phantom load forensics.",
      ],
    };
  }

  const diff = actualBilledKwh - simulatedMonthlyKwh;
  const pct =
    simulatedMonthlyKwh > 0
      ? Math.round((diff / simulatedMonthlyKwh) * 100)
      : 100;

  // Approximate marginal financial impact in PKR (marginal rate for excess units in Pakistan: ~Rs 42/kWh + 18% GST + duty + FPA ≈ Rs 54/kWh)
  const marginalTariffPerKwh = actualBilledKwh > 300 ? 54 : 38;
  const estimatedLossPkr = diff > 0 ? Math.round(diff * marginalTariffPerKwh) : 0;

  if (diff > 80 && pct >= 25) {
    return {
      simulatedMonthlyKwh,
      actualBilledKwh,
      discrepancyKwh: Math.round(diff),
      discrepancyPct: pct,
      status: "excess_critical",
      severity: "high",
      title: `Critical Phantom Load Detected: +${Math.round(diff)} kWh (${pct}% Excess)`,
      summary: `Your actual bill is ${actualBilledKwh} kWh, but your declared household appliances only account for ${simulatedMonthlyKwh} kWh. You are being billed for ${Math.round(diff)} unexplained units costing ~Rs ${estimatedLossPkr.toLocaleString()} extra every month.`,
      diagnoses: [
        "Unmonitored Submersible/Roof Water Motor: Float switch stuck closed or tank silently overflowing on roof.",
        "Neutral Line Earth Leakage: Common in older domestic wiring where earthing or shared neutral drains current through ground return.",
        "Rapid Meter Creep / Defective Digital Shunt: Meter register counting pulses under no-load condition (DISCO meter defect).",
        "Inefficient UPS Float Charging: Degraded tubular/lead-acid battery drawing continuous 200W–350W float charging without shutting off.",
        "Inverter AC Defective PCB: Compressor not modulating down to 300W after room cools, running at full 1800W non-stop.",
      ],
      estimatedLossPkr,
      recommendations: [
        "Perform a 2-Hour Breaker Test: Turn off all household breakers and observe if the DISCO digital meter pulse LED still flashes.",
        "Inspect UPS battery water levels & float charger temperature; replace degraded batteries causing continuous draw.",
        "Verify water motor automatic float switches to ensure zero phantom roof pumping.",
        "If meter flashes with main breaker off, immediately lodge an SDO grievance for neutral leakage / defective meter testing under NEPRA CSM Sec 4.",
      ],
    };
  }

  if (diff > 30 && pct >= 12) {
    return {
      simulatedMonthlyKwh,
      actualBilledKwh,
      discrepancyKwh: Math.round(diff),
      discrepancyPct: pct,
      status: "excess_warning",
      severity: "medium",
      title: `Moderate Usage Variance: +${Math.round(diff)} kWh (${pct}% Above Footprint)`,
      summary: `Your actual bill is ${actualBilledKwh} kWh versus a simulated footprint of ${simulatedMonthlyKwh} kWh. Minor standby power, refrigerator door seal leaks, or longer AC operating hours could explain this difference.`,
      diagnoses: [
        "Refrigerator/Deep Freezer Door Gasket Leak: Warm ambient air ingress causing compressor to run 18+ hours/day.",
        "Standby Vampire Draws: TV boxes, Wi-Fi routers, chargers, and gaming consoles consuming 30–50W continuously.",
        "Higher Ambient AC Temperature: Heatwaves increasing inverter cooling cycle duty ratio.",
      ],
      estimatedLossPkr,
      recommendations: [
        "Check refrigerator magnetic door seals with a paper slip test.",
        "Set Inverter AC temperature to 26°C instead of 22°C (each degree lower increases consumption by 6–8%).",
      ],
    };
  }

  if (diff < -50 && pct <= -20) {
    return {
      simulatedMonthlyKwh,
      actualBilledKwh,
      discrepancyKwh: Math.round(diff),
      discrepancyPct: pct,
      status: "under_reported",
      severity: "medium",
      title: `Simulated Footprint Higher Than Billed: ${Math.round(diff)} kWh`,
      summary: `You declared ${simulatedMonthlyKwh} kWh of appliances, but your bill is only ${actualBilledKwh} kWh. Either appliance hours were estimated generously, or your utility meter is sluggish/under-recording.`,
      diagnoses: [
        "Generous Runtime Estimates: Appliances used less frequently than typical daily defaults.",
        "Sluggish Mechanical/Digital Meter: Potential under-recording, which carries a risk of sudden retrospective detection bills under NEPRA CSM Section 9.1.",
      ],
      estimatedLossPkr: 0,
      recommendations: [
        "Refine daily runtime hours in the simulator to mirror exact habits.",
        "Take regular photographic meter readings to ensure the utility does not slap a lump-sum detection bill later.",
      ],
    };
  }

  return {
    simulatedMonthlyKwh,
    actualBilledKwh,
    discrepancyKwh: Math.round(diff),
    discrepancyPct: pct,
    status: "aligned",
    severity: "none",
    title: "Appliance Usage Aligned with Bill",
    summary: `Your declared appliance footprint (${simulatedMonthlyKwh} kWh) closely matches your billed consumption (${actualBilledKwh} kWh). No abnormal phantom loads detected.`,
    diagnoses: [
      "Your declared household appliances accurately explain your monthly meter consumption.",
    ],
    estimatedLossPkr: 0,
    recommendations: [
      "Keep appliance running hours steady to remain within your current progressive slab.",
    ],
  };
}
