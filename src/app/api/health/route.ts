import { NextResponse } from "next/server";
import { rows } from "@/lib/db";
import { objectStore } from "@/lib/object-store";
let storageCheckedAt = 0;
export const runtime = "nodejs";
export async function GET() {
  try {
    const origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
    if (
      process.env.PILOT_MODE === "true" &&
      (!origin ||
        new URL(origin).protocol !== "https:" ||
        (!process.env.RENDER_EXTERNAL_URL && !process.env.APP_ORIGIN) ||
        process.env.STORAGE_DRIVER !== "supabase" ||
        process.env.DATABASE_SSL !== "true" ||
        process.env.DEMO_ENABLED === "true")
    )
      throw new Error("Pilot configuration incomplete");
    await rows("SELECT 1");
    if (Date.now() - storageCheckedAt > 60000) {
      await objectStore().health();
      storageCheckedAt = Date.now();
    }
    const response = await fetch(
      `${process.env.OCR_URL ?? "http://ocr:8000"}/health`,
      { signal: AbortSignal.timeout(3000) },
    );
    if (!response.ok) throw new Error("OCR unavailable");
    return NextResponse.json(
      { status: "ready" },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "unavailable" },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
