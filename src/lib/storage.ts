import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises";
import path from "node:path";
import { rows } from "@/lib/db";

export type EvidenceKind = "bill" | "receipt" | "reading";
export const MAX_BYTES = 8 * 1024 * 1024;
const root = () => path.resolve(/*turbopackIgnore: true*/ process.env.UPLOAD_DIR ?? "./private_uploads");

export function sniff(bytes: Buffer): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255,216,255]))) return "image/jpeg";
  return null;
}

export async function saveEvidence(householdId: string, kind: EvidenceKind, file: File): Promise<{ id: string; bytes: Buffer; mime: string }> {
  if (file.size < 1 || file.size > MAX_BYTES) throw new Error("File size must be 1-8 MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime) throw new Error("Upload a PDF, PNG, or JPEG file");
  const id = randomUUID();
  const storageKey = `${householdId}/${id}`;
  const directory = path.join(/*turbopackIgnore: true*/ root(), householdId);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  await writeFile(/*turbopackIgnore: true*/ path.join(directory, id), bytes, { mode: 0o600, flag: "wx" });
  try {
    await rows(`INSERT INTO evidence_files (id,household_id,kind,storage_key,original_name,mime_type,byte_size) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [id, householdId, kind, storageKey, path.basename(file.name).slice(0, 180), mime, bytes.length]);
  } catch (error) {
    await unlink(/*turbopackIgnore: true*/ path.join(directory, id));
    throw error;
  }
  return { id, bytes, mime };
}

export async function loadEvidence(householdId: string, id: string): Promise<{ data: Buffer; mime: string; name: string } | null> {
  const found = await rows<{ storage_key: string; mime_type: string; original_name: string }>(`SELECT storage_key,mime_type,original_name FROM evidence_files WHERE id=$1 AND household_id=$2`, [id, householdId]);
  if (!found[0]) return null;
  const data = await readFile(/*turbopackIgnore: true*/ path.join(root(), householdId, id));
  return { data, mime: found[0].mime_type, name: found[0].original_name };
}

export async function removeHouseholdFiles(householdId: string): Promise<void> {
  const { rm } = await import("node:fs/promises");
  await rm(/*turbopackIgnore: true*/ path.join(root(), householdId), { recursive: true, force: true });
}

export async function removeUnusedEvidence(householdId: string, id: string): Promise<boolean> {
  const deleted = await rows<{ id: string }>(`DELETE FROM evidence_files e WHERE e.id=$1 AND e.household_id=$2
    AND NOT EXISTS (SELECT 1 FROM bills b WHERE b.evidence_file_id=e.id)
    AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.evidence_file_id=e.id)
    AND NOT EXISTS (SELECT 1 FROM meter_readings m WHERE m.evidence_file_id=e.id)
    RETURNING e.id`, [id, householdId]);
  if (!deleted[0]) return false;
  await unlink(/*turbopackIgnore: true*/ path.join(root(), householdId, id));
  return true;
}
