import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createObjectStore, validateKey } from "../src/lib/object-store";
import { guidance } from "../src/lib/guidance";
import { checklistSchema } from "../src/lib/schemas";
import { boundedBody } from "../src/lib/request-body";
import { evidencePdf } from "../src/lib/report-pdf";
import { PDFDocument } from "pdf-lib";
import type { CaseRecord } from "../src/lib/types";
const key =
  "11111111-1111-1111-1111-111111111111/22222222-2222-2222-2222-222222222222";
test("legacy finding guidance targets the missing evidence without inventing readings", () => {
  const finding = {
    id: "bill:observation_missing",
    billId: "bill",
    kind: "info" as const,
    title: "",
    detail: "",
    evidence: [],
    relatedBillIds: [],
    readingIds: [],
    missing: [],
    ruleVersion: "2",
  };
  assert.equal(guidance(finding)[1].kind, "reading");
  assert.match(guidance(finding)[1].description, /Do not invent/);
  assert.equal(
    guidance({ ...finding, code: "comparison" })[1].kind,
    "previousBill",
  );
  assert.equal(guidance({ ...finding, code: "duplicate" })[0].kind, "bill");
});
test("checklists default safely and reject unvalidated input", () => {
  assert.equal(checklistSchema.parse({}).inspectSource, false);
  assert.equal(
    checklistSchema.safeParse({ inspectSource: "yes" }).success,
    false,
  );
});
test("oversized streamed bodies are bounded even without Content-Length", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: "x".repeat(100),
  });
  await assert.rejects(boundedBody(request, 20), /too large/);
});
test("storage blocks traversal and local objects survive adapter restart", async () => {
  assert.throws(() => validateKey("../secret"));
  const directory = await mkdtemp(path.join(tmpdir(), "gharflow-storage-"));
  const old = process.env.UPLOAD_DIR;
  try {
    process.env.UPLOAD_DIR = directory;
    const store = createObjectStore();
    await store.put(key, Buffer.from("private"));
    assert.equal((await createObjectStore().get(key)).toString(), "private");
    await store.remove([key]);
    await assert.rejects(store.get(key));
  } finally {
    process.env.UPLOAD_DIR = old;
    await rm(directory, { recursive: true, force: true });
  }
});
test("cloud storage failures remain errors and a public bucket is rejected", async () => {
  let mode = "public";
  const server = createServer((_req, res) => {
    if (mode === "public") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          id: "household-evidence",
          name: "household-evidence",
          public: true,
        }),
      );
    } else {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "simulated failure" }));
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const old = {
    driver: process.env.STORAGE_DRIVER,
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_SERVICE_KEY,
  };
  try {
    process.env.STORAGE_DRIVER = "supabase";
    process.env.SUPABASE_URL = `http://127.0.0.1:${address.port}`;
    process.env.SUPABASE_SERVICE_KEY = "test-only-key";
    const store = createObjectStore();
    await assert.rejects(store.health(), /private storage bucket/);
    mode = "failure";
    await assert.rejects(
      store.put(key, Buffer.from("private")),
      /write failed/,
    );
    await assert.rejects(store.get(key), /read failed/);
    await assert.rejects(store.remove([key]), /deletion failed/);
  } finally {
    for (const [name, value] of Object.entries({
      STORAGE_DRIVER: old.driver,
      SUPABASE_URL: old.url,
      SUPABASE_SERVICE_KEY: old.key,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
test("private PDF paginates long notes and retains captured comparison", async () => {
  const record: CaseRecord = {
    id: "case",
    billId: null,
    status: "open",
    checklist: checklistSchema.parse({ inspectSource: true }),
    evidenceIds: [],
    notes: "Long user note. ".repeat(1000) + " Urdu نام",
    outcome: "",
    createdAt: "now",
    updatedAt: "now",
    snapshot: {
      ruleVersion: "2",
      capturedAt: "now",
      isDemo: false,
      finding: {
        id: "bill:units",
        billId: "bill",
        kind: "review",
        title: "Check units",
        detail: "Source difference",
        evidence: ["(200 - 100) x 1 = 100 kWh"],
        missing: [],
        relatedBillIds: [],
        readingIds: [],
        ruleVersion: "2",
      },
      bills: [],
      readings: [],
      payments: [],
      documents: [],
    },
  };
  const before = JSON.stringify(record.snapshot);
  const bytes = await evidencePdf(record, []);
  assert.equal(Buffer.from(bytes).subarray(0, 5).toString(), "%PDF-");
  assert.ok((await PDFDocument.load(bytes)).getPageCount() > 1);
  assert.equal(JSON.stringify(record.snapshot), before);
});

test("meter changes and duplicate versions do not suggest redundant uploads", () => {
  const finding = {
    id: "bill:comparison",
    billId: "bill",
    code: "comparison" as const,
    kind: "info" as const,
    title: "",
    detail: "",
    evidence: [],
    relatedBillIds: ["earlier"],
    readingIds: [],
    missing: [],
    ruleVersion: "2.1",
  };
  const meter = guidance({ ...finding, unavailableReason: "meter_metadata" });
  assert.equal(meter[1].kind, "bill");
  assert.equal(meter[1].billId, "earlier");
  assert.ok(
    !guidance({ ...finding, unavailableReason: "duplicate_versions" }).some(
      (action) => action.kind === "previousBill",
    ),
  );
});

test("database-bound numeric inputs cannot silently round accepted values", async () => {
  const { billSchema } = await import("../src/lib/schemas");
  const input = {
    referenceNumber: "12345678901234",
    billMonth: "2026-09-01",
    previousReading: 100.125,
    currentReading: 200.125,
    multiplier: 1,
    billedUnits: 100,
    totalAmount: 5000,
    dueDate: null,
    confirmed: true,
  };
  assert.equal(billSchema.parse(input).currentReading, 200.125);
  assert.equal(
    billSchema.safeParse({ ...input, totalAmount: 5000.001 }).success,
    false,
  );
  assert.equal(
    billSchema.safeParse({ ...input, multiplier: 1.0001 }).success,
    false,
  );
});
