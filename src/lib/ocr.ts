import { ocrResponseSchema, extractionSchema } from "./schemas";
import { storeExtraction, loadEvidence } from "./storage";
import { rows } from "./db";
export async function extractSaved(
  householdId: string,
  saved: { id: string; bytes: Buffer; mime: string },
  name: string,
) {
  const body = new FormData();
  body.set(
    "file",
    new Blob([Uint8Array.from(saved.bytes)], { type: saved.mime }),
    name,
  );
  const response = await fetch(
    `${process.env.OCR_URL ?? "http://ocr:8000"}/extract`,
    {
      method: "POST",
      headers: { "x-internal-token": process.env.OCR_INTERNAL_TOKEN ?? "" },
      body,
      signal: AbortSignal.timeout(120000),
    },
  );
  if (!response.ok) throw new Error("Document processing unavailable");
  const result = ocrResponseSchema.parse(await response.json());
  return {
    fields: result.fields,
    extraction: await storeExtraction(householdId, saved.id, result),
  };
}
export async function processEvidence(householdId: string, id: string) {
  const current = await rows<{ ocr_result: unknown }>(
    "SELECT ocr_result FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='bill' AND NOT deleting",
    [id, householdId],
  );
  if (!current[0]) return null;
  const parsed = extractionSchema.safeParse(current[0].ocr_result);
  if (parsed.success)
    return {
      fields: Object.fromEntries(
        Object.entries(parsed.data.candidates).map(([key, value]) => [
          key,
          value.value,
        ]),
      ),
      extraction: parsed.data,
      ocrStatus: "extracted",
    };
  const claimed = await rows<{ id: string }>(
    `UPDATE evidence_files SET ocr_state='processing',processing_started_at=now() WHERE id=$1 AND household_id=$2 AND NOT deleting AND (ocr_state<>'processing' OR processing_started_at<now()-interval '150 seconds') RETURNING id`,
    [id, householdId],
  );
  if (!claimed[0])
    return { fields: {}, extraction: null, ocrStatus: "processing" };
  try {
    const file = await loadEvidence(householdId, id);
    if (!file) throw new Error("Evidence unavailable");
    return {
      ...(await extractSaved(
        householdId,
        { id, bytes: file.data, mime: file.mime },
        file.name,
      )),
      ocrStatus: "extracted",
    };
  } catch {
    await rows(
      "UPDATE evidence_files SET ocr_state='failed',processing_started_at=NULL WHERE id=$1 AND household_id=$2 AND ocr_state='processing'",
      [id, householdId],
    );
    return { fields: {}, extraction: null, ocrStatus: "failed" };
  }
}
