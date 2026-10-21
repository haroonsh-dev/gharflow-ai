import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { jsonBody } from "@/lib/request-body";
import { rows } from "@/lib/db";
import type { PortionInput } from "@/lib/submeter";

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
      portions: PortionInput[];
      common_load_handling: "equal_split" | "proportional" | "landlord_absorb";
      updated_at: string;
    }>(
      `SELECT id, reference_number, name, portions, common_load_handling, updated_at::text
       FROM household_submeter_configurations
       WHERE household_id = $1 AND reference_number = $2`,
      [person.householdId, referenceNumber],
    );

    if (!found[0]) {
      return NextResponse.json({ config: null });
    }

    return NextResponse.json({
      config: {
        id: found[0].id,
        referenceNumber: found[0].reference_number,
        name: found[0].name,
        portions: Array.isArray(found[0].portions) ? found[0].portions : [],
        commonLoadHandling: found[0].common_load_handling,
        updatedAt: found[0].updated_at,
      },
    });
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
      portions?: PortionInput[];
      commonLoadHandling?: "equal_split" | "proportional" | "landlord_absorb";
    };

    const referenceNumber = (body.referenceNumber ?? "").trim();
    const name = (body.name ?? "Shared Meter Setup").trim() || "Shared Meter Setup";
    const commonLoadHandling =
      body.commonLoadHandling === "proportional" ||
      body.commonLoadHandling === "landlord_absorb"
        ? body.commonLoadHandling
        : "equal_split";

    const rawPortions = Array.isArray(body.portions) ? body.portions : [];
    const portions: PortionInput[] = rawPortions
      .filter((p) => p && typeof p.name === "string" && p.name.trim())
      .map((p, idx) => ({
        id: p.id || `portion_${idx + 1}_${Date.now()}`,
        name: String(p.name).trim().slice(0, 80),
        tenantName: p.tenantName ? String(p.tenantName).trim().slice(0, 80) : undefined,
        previousReading:
          p.previousReading != null && !isNaN(Number(p.previousReading))
            ? Number(p.previousReading)
            : undefined,
        currentReading:
          p.currentReading != null && !isNaN(Number(p.currentReading))
            ? Number(p.currentReading)
            : undefined,
        unitsConsumed:
          p.unitsConsumed != null && !isNaN(Number(p.unitsConsumed))
            ? Number(p.unitsConsumed)
            : undefined,
        notes: p.notes ? String(p.notes).slice(0, 200) : undefined,
      }));

    const result = await rows<{
      id: string;
      reference_number: string;
      name: string;
      portions: PortionInput[];
      common_load_handling: "equal_split" | "proportional" | "landlord_absorb";
      updated_at: string;
    }>(
      `INSERT INTO household_submeter_configurations (
         household_id, reference_number, name, portions, common_load_handling, updated_at
       ) VALUES ($1, $2, $3, $4::jsonb, $5, now())
       ON CONFLICT (household_id, reference_number)
       DO UPDATE SET
         name = EXCLUDED.name,
         portions = EXCLUDED.portions,
         common_load_handling = EXCLUDED.common_load_handling,
         updated_at = now()
       RETURNING id, reference_number, name, portions, common_load_handling, updated_at::text`,
      [
        person.householdId,
        referenceNumber,
        name,
        JSON.stringify(portions),
        commonLoadHandling,
      ],
    );

    const saved = result[0];
    return NextResponse.json({
      success: true,
      config: {
        id: saved.id,
        referenceNumber: saved.reference_number,
        name: saved.name,
        portions: saved.portions,
        commonLoadHandling: saved.common_load_handling,
        updatedAt: saved.updated_at,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
