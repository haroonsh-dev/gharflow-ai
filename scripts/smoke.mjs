import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const origin = new URL(base).origin;
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9WlWj2sAAAAASUVORK5CYII=", "base64");

async function call(path, { method = "GET", cookie, body } = {}) {
  const headers = { ...(method === "GET" ? {} : { Origin: origin }), ...(cookie ? { Cookie: cookie } : {}) };
  if (body && !(body instanceof FormData)) headers["Content-Type"] = "application/json";
  const response = await fetch(`${base}${path}`, { method, headers, body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined, redirect: "manual" });
  const result = await response.json();
  return { status: response.status, result, cookie: response.headers.get("set-cookie")?.split(";")[0] };
}

async function signup() {
  const email = `smoke-${randomUUID()}@example.test`;
  const result = await call("/api/auth/signup", { method: "POST", body: { email, password: "smoke-test-password-123" } });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.ok(result.cookie);
  return { email, cookie: result.cookie };
}

async function upload(cookie, kind) {
  const body = new FormData(); body.set("kind", kind); body.set("file", new Blob([png], { type: "image/png" }), `${kind}.png`);
  const result = await call("/api/upload", { method: "POST", cookie, body });
  assert.equal(result.status, 200, JSON.stringify(result.result));
  assert.ok(result.result.evidenceFileId);
  return result.result.evidenceFileId;
}

const first = await signup();
const second = await signup();
try {
  const evidenceFileId = await upload(first.cookie, "bill");
  const bill = await call("/api/bills", { method: "POST", cookie: first.cookie, body: { evidenceFileId, referenceNumber: "12345678901234", billMonth: "2026-08-01", previousReading: 100, currentReading: 200, multiplier: 1, billedUnits: 120, totalAmount: 5000, dueDate: "2026-08-20", fieldSources: { referenceNumber: "user" }, ocrStatus: "failed" } });
  assert.equal(bill.status, 201, JSON.stringify(bill.result));
  const billId = bill.result.id;
  assert.equal((await call("/api/readings", { method: "POST", cookie: first.cookie, body: { readingDate: "2026-08-01", readingValue: 200, note: "smoke" } })).status, 201);
  const receiptId = await upload(first.cookie, "receipt");
  assert.equal((await call("/api/payments", { method: "POST", cookie: first.cookie, body: { billId, evidenceFileId: receiptId, amount: 4500, paidAt: "2026-08-18", channel: "bank", reference: "smoke" } })).status, 201);
  const overview = await call("/api/overview", { cookie: first.cookie });
  assert.equal(overview.status, 200);
  assert.ok(overview.result.findings.some((finding) => finding.id === `${billId}:units`));
  assert.ok(overview.result.findings.some((finding) => finding.id === `${billId}:payment`));
  const other = await call("/api/overview", { cookie: second.cookie });
  assert.equal(other.result.bills.length, 0);
  assert.equal((await call(`/api/files/${evidenceFileId}`, { cookie: second.cookie })).status, 404);
  assert.equal((await call(`/api/bills/${billId}`, { method: "DELETE", cookie: second.cookie })).status, 404);
  assert.equal((await call("/api/payments", { method: "POST", cookie: second.cookie, body: { billId, amount: 1, paidAt: "2026-08-18", channel: "bank" } })).status, 404);
  assert.equal((await call("/api/household", { method: "DELETE", cookie: first.cookie })).status, 200);
  assert.equal((await call("/api/overview", { cookie: first.cookie })).status, 401);
  console.log("Smoke flow passed: account, upload, review save, findings, reading, receipt, tenant isolation, deletion.");
} finally {
  await call("/api/household", { method: "DELETE", cookie: second.cookie });
}
