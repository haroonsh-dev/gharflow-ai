import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { jsonBody } from "@/lib/request-body";
import { rows } from "@/lib/db";
import type { ApplianceUsage, HouseholdApplianceProfile } from "@/lib/appliances";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;

    const url = new URL(request.url);
    const referenceNumber = url.searchParams.get("referenceNumber") ?? "";

    const found = await rows<{
      id: string;
      reference_number: string;
      name: string;
      usages: ApplianceUsage[];
      is_protected: boolean;
      updated_at: string;
    }>(
      `SELECT id, reference_number, name, usages, is_protected, updated_at::text
       FROM household_appliance_profiles
       WHERE household_id = $1 AND reference_number = $2`,
      [person.householdId, referenceNumber],
    );

    if (!found[0]) {
      return NextResponse.json({ profile: null });
    }

    const profile: HouseholdApplianceProfile = {
      id: found[0].id,
      householdId: person.householdId,
      referenceNumber: found[0].reference_number,
      name: found[0].name,
      usages: Array.isArray(found[0].usages) ? found[0].usages : [],
      isProtected: found[0].is_protected,
      updatedAt: found[0].updated_at,
    };

    return NextResponse.json({ profile });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const person = await guard(request);
    if (person instanceof NextResponse) return person;

    const body = (await jsonBody(request)) as {
      referenceNumber?: string;
      name?: string;
      usages?: ApplianceUsage[];
      isProtected?: boolean;
    };

    const referenceNumber = (body.referenceNumber ?? "").trim();
    const name = (body.name ?? "Household Profile").trim() || "Household Profile";
    const isProtected = body.isProtected ?? true;
    const usages = Array.isArray(body.usages) ? body.usages : [];

    // Sanitize and bound usages
    const sanitizedUsages: ApplianceUsage[] = usages
      .filter((u) => u && typeof u.applianceId === "string" && u.applianceId.trim())
      .map((u) => ({
        applianceId: u.applianceId.trim(),
        quantity: Math.max(0, Math.min(50, Math.round(Number(u.quantity) || 0))),
        hoursPerDay: Math.max(
          0,
          Math.min(24, Math.round((Number(u.hoursPerDay) || 0) * 10) / 10),
        ),
        customName: u.customName ? String(u.customName).slice(0, 80) : undefined,
        customWatts:
          u.customWatts != null
            ? Math.max(1, Math.min(10000, Number(u.customWatts)))
            : undefined,
        category: u.category,
      }));

    const result = await rows<{
      id: string;
      reference_number: string;
      name: string;
      usages: ApplianceUsage[];
      is_protected: boolean;
      updated_at: string;
    }>(
      `INSERT INTO household_appliance_profiles (
         household_id, reference_number, name, usages, is_protected, updated_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, now())
       ON CONFLICT (household_id, reference_number)
       DO UPDATE SET
         name = EXCLUDED.name,
         usages = EXCLUDED.usages,
         is_protected = EXCLUDED.is_protected,
         updated_at = now()
       RETURNING id, reference_number, name, usages, is_protected, updated_at::text`,
      [
        person.householdId,
        referenceNumber,
        name,
        JSON.stringify(sanitizedUsages),
        isProtected,
      ],
    );

    const saved = result[0];
    const profile: HouseholdApplianceProfile = {
      id: saved.id,
      householdId: person.householdId,
      referenceNumber: saved.reference_number,
      name: saved.name,
      usages: saved.usages,
      isProtected: saved.is_protected,
      updatedAt: saved.updated_at,
    };

    return NextResponse.json({ success: true, profile });
  } catch (error) {
    return errorResponse(error);
  }
}
