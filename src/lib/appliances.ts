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

export type ApplianceSimulationResult = {
  totalMonthlyKwh: number;
  totalEstimatedCostPkr: number;
  currentSlabName: string;
  isProtectedSlab: boolean;
  slabThresholdAlert?: string;
  items: ApplianceBreakdownItem[];
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
    const def = APPLIANCE_CATALOG.find((a) => a.id === usage.applianceId);
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
  };
}
