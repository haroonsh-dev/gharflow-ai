import { randomUUID } from "node:crypto";
import path from "node:path";
import { db, rows } from "./db";
import {
  extractionSchema,
  type Extraction,
  type ocrResponseSchema,
} from "./schemas";
import type { z } from "zod";
import { objectStore } from "./object-store";
import { storageLimit } from "./config";
export type EvidenceKind = "bill" | "receipt" | "reading";
export const MAX_BYTES = 8 * 1024 * 1024;
export class StorageInputError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function sniff(
  bytes: Buffer,
): "application/pdf" | "image/png" | "image/jpeg" | null {
  if (bytes.subarray(0, 5).toString() === "%PDF-") return "application/pdf";
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return "image/png";
  if (bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255])))
    return "image/jpeg";
  return null;
}
async function lockHousehold(
  client: import("pg").PoolClient,
  householdId: string,
) {
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
    householdId,
  ]);
  const result = await client.query<{ deleting: boolean }>(
    "SELECT deleting FROM households WHERE id=$1",
    [householdId],
  );
  if (!result.rows[0] || result.rows[0].deleting)
    throw new StorageInputError("Household unavailable", 409);
}
async function checkQuota(
  client: import("pg").PoolClient,
  householdId: string,
  extra: number,
) {
  const used = await client.query<{ bytes: string }>(
    "SELECT coalesce(sum(byte_size+preview_bytes),0) AS bytes FROM evidence_files WHERE household_id=$1",
    [householdId],
  );
  if (Number(used.rows[0].bytes) + extra > storageLimit())
    throw new StorageInputError(
      "Household storage limit reached. Remove unused documents before uploading more.",
      413,
    );
}
export async function saveEvidence(
  householdId: string,
  kind: EvidenceKind,
  file: File,
) {
  if (file.size < 1 || file.size > MAX_BYTES)
    throw new StorageInputError("File size must be 1-8 MB");
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniff(bytes);
  if (!mime) throw new StorageInputError("Upload a PDF, PNG, or JPEG file");
  const id = randomUUID(),
    key = `${householdId}/${id}`;
  const client = await db.connect();
  let written = false;
  try {
    await client.query("BEGIN");
    await lockHousehold(client, householdId);
    await checkQuota(client, householdId, bytes.length);
    await objectStore().put(key, bytes);
    written = true;
    await client.query(
      "INSERT INTO evidence_files(id,household_id,kind,storage_key,original_name,mime_type,byte_size,ocr_state) VALUES($1,$2,$3,$4,$5,$6,$7,$8)",
      [
        id,
        householdId,
        kind,
        key,
        path.basename(file.name).slice(0, 180),
        mime,
        bytes.length,
        kind === "bill" ? "pending" : "failed",
      ],
    );
    await client.query("COMMIT");
    return { id, bytes, mime };
  } catch (error) {
    await client.query("ROLLBACK");
    if (written)
      await objectStore()
        .remove([key])
        .catch(() => console.error("Storage cleanup requires operator review"));
    throw error;
  } finally {
    client.release();
  }
}
export async function loadEvidence(
  householdId: string,
  id: string,
  page?: number,
) {
  const found = await rows<{
    storage_key: string;
    mime_type: string;
    original_name: string;
    ocr_result: unknown;
  }>(
    "SELECT storage_key,mime_type,original_name,ocr_result FROM evidence_files WHERE id=$1 AND household_id=$2 AND NOT deleting",
    [id, householdId],
  );
  if (!found[0]) return null;
  if (page !== undefined) {
    const parsed = extractionSchema.safeParse(found[0].ocr_result);
    if (
      !parsed.success ||
      !parsed.data.pages.some((item) => item.page === page)
    )
      return null;
    return {
      data: await objectStore().get(`${found[0].storage_key}-preview-${page}`),
      mime: "image/png",
      name: "preview.png",
    };
  }
  return {
    data: await objectStore().get(found[0].storage_key),
    mime: found[0].mime_type,
    name: found[0].original_name,
  };
}
const keysFor = (key: string) => [key, `${key}-preview-1`, `${key}-preview-2`];
export async function removeHouseholdFiles(
  householdId: string,
  client?: import("pg").PoolClient,
) {
  const sql = "SELECT storage_key FROM evidence_files WHERE household_id=$1";
  const files = client
    ? (await client.query<{ storage_key: string }>(sql, [householdId])).rows
    : await rows<{ storage_key: string }>(sql, [householdId]);
  await objectStore().remove(
    files.flatMap((file) => keysFor(file.storage_key)),
  );
}
export async function removeUnusedEvidence(
  householdId: string,
  id: string,
): Promise<boolean> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      householdId,
    ]);
    const files = await client.query<{ storage_key: string }>(
      `UPDATE evidence_files e SET deleting=true WHERE e.id=$1 AND e.household_id=$2
      AND NOT EXISTS(SELECT 1 FROM bills WHERE evidence_file_id=e.id)
      AND NOT EXISTS(SELECT 1 FROM payments WHERE evidence_file_id=e.id)
      AND NOT EXISTS(SELECT 1 FROM meter_readings WHERE evidence_file_id=e.id)
      AND NOT EXISTS(SELECT 1 FROM cases WHERE e.id=ANY(evidence_ids)) RETURNING storage_key`,
      [id, householdId],
    );
    if (!files.rows[0]) {
      await client.query("ROLLBACK");
      return false;
    }
    await objectStore().remove(keysFor(files.rows[0].storage_key));
    await client.query(
      "DELETE FROM evidence_files WHERE id=$1 AND household_id=$2",
      [id, householdId],
    );
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
export async function storeExtraction(
  householdId: string,
  id: string,
  result: z.infer<typeof ocrResponseSchema>,
): Promise<Extraction> {
  const extraction: Extraction = {
    candidates: result.candidates,
    pages: result.pages.map(({ page, width, height, mime }) => ({
      page,
      width,
      height,
      mime,
    })),
    verifiedFormat: false,
  };
  const pages = result.pages.map((page) => ({
    page: page.page,
    bytes: Buffer.from(page.imageBase64, "base64"),
  }));
  if (
    pages.some(
      (page) =>
        sniff(page.bytes) !== "image/png" || page.bytes.length > MAX_BYTES,
    )
  )
    throw new Error("Invalid preview");
  const client = await db.connect();
  const keys: string[] = [];
  try {
    await client.query("BEGIN");
    await lockHousehold(client, householdId);
    const existing = await client.query<{
      storage_key: string;
      preview_bytes: number;
    }>(
      "SELECT storage_key,preview_bytes FROM evidence_files WHERE id=$1 AND household_id=$2 AND NOT deleting",
      [id, householdId],
    );
    if (!existing.rows[0])
      throw new StorageInputError("Evidence unavailable", 404);
    const total = pages.reduce((sum, page) => sum + page.bytes.length, 0);
    await checkQuota(
      client,
      householdId,
      total - existing.rows[0].preview_bytes,
    );
    for (const page of pages) {
      const key = `${existing.rows[0].storage_key}-preview-${page.page}`;
      keys.push(key);
      await objectStore().put(key, page.bytes);
    }
    await client.query(
      "UPDATE evidence_files SET ocr_result=$3,preview_bytes=$4,ocr_state='extracted',processing_started_at=NULL WHERE id=$1 AND household_id=$2",
      [id, householdId, JSON.stringify(extraction), total],
    );
    await client.query("COMMIT");
    return extraction;
  } catch (error) {
    await client.query("ROLLBACK");
    if (keys.length)
      await objectStore()
        .remove(keys)
        .catch(() => console.error("Preview cleanup requires operator review"));
    throw error;
  } finally {
    client.release();
  }
}
