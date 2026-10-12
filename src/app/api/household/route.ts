import { NextResponse } from "next/server";
import { guard, errorResponse } from "@/lib/http";
import { rows } from "@/lib/db";
import { removeHouseholdFiles } from "@/lib/storage";
import { endSession } from "@/lib/auth";

export const runtime = "nodejs";
export async function DELETE(request: Request) {
  const person = await guard(request);
  if (person instanceof NextResponse) return person;
  try {
    await rows(`DELETE FROM users WHERE id=$1`, [person.userId]);
    await removeHouseholdFiles(person.householdId);
    await endSession();
    return NextResponse.json({ ok: true });
  } catch (error) { return errorResponse(error); }
}
