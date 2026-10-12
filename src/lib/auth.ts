import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { rows } from "@/lib/db";

const COOKIE = "gharflow_session";
const SESSION_DAYS = 14;

export type Identity = { userId: string; householdId: string; email: string };

export async function identity(): Promise<Identity | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const hash = createHash("sha256").update(token).digest("hex");
  const found = await rows<{ user_id: string; household_id: string; email: string }>(
    `SELECT u.id AS user_id, h.id AS household_id, u.email FROM sessions s
     JOIN users u ON u.id=s.user_id JOIN households h ON h.owner_id=u.id
     WHERE s.token_hash=$1 AND s.expires_at > now()`, [hash]);
  return found[0] ? { userId: found[0].user_id, householdId: found[0].household_id, email: found[0].email } : null;
}

export async function startSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");
  await rows(`INSERT INTO sessions (user_id, token_hash, expires_at) VALUES ($1,$2,now()+interval '14 days')`, [userId, hash]);
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_DAYS * 86400 });
}

export async function endSession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await rows(`DELETE FROM sessions WHERE token_hash=$1`, [createHash("sha256").update(token).digest("hex")]);
  jar.delete(COOKIE);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).host === request.headers.get("host"); } catch { return false; }
}
