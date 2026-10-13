import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";
import { databaseConfig } from "./database-config.mjs";
import { PDFDocument } from "pdf-lib";
const database = new pg.Client(databaseConfig());
await database.connect();
const accountDetails = new Map();
const base = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
const origin = new URL(base).origin;
const accounts = [];
async function call(path, { method = "GET", cookie, body } = {}) {
  const headers = {
    ...(method === "GET" ? {} : { Origin: origin }),
    ...(cookie ? { Cookie: cookie } : {}),
  };
  if (body && !(body instanceof FormData))
    headers["Content-Type"] = "application/json";
  const response = await fetch(base + path, {
    method,
    headers,
    body:
      body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
    redirect: "manual",
  });
  const content = response.headers.get("content-type") ?? "";
  return {
    status: response.status,
    result: content.includes("json")
      ? await response.json()
      : content.includes("application/pdf")
        ? Buffer.from(await response.arrayBuffer())
        : await response.text(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}
async function invitation(email, expired = false) {
  const token = randomBytes(32).toString("base64url");
  await database.query(
    "INSERT INTO invitations(email,token_hash,expires_at) VALUES($1,$2,now()+$3*interval '1 second')",
    [
      email,
      createHash("sha256").update(token).digest("hex"),
      expired ? -1 : 604800,
    ],
  );
  return token;
}
async function signup() {
  const email = `smoke-${randomUUID()}@example.test`,
    password = "smoke-test-password-123";
  const expired = await invitation(email, true);
  assert.equal(
    (
      await call("/api/auth/signup", {
        method: "POST",
        body: { email, password, invitation: expired },
      })
    ).status,
    400,
  );
  const token = await invitation(email);
  assert.equal(
    (
      await call("/api/auth/signup", {
        method: "POST",
        body: { email, password },
      })
    ).status,
    400,
  );
  const result = await call("/api/auth/signup", {
    method: "POST",
    body: { email, password, invitation: token },
  });
  assert.equal(result.status, 201, JSON.stringify(result.result));
  assert.match(result.result.recoveryCode, /^[A-Za-z0-9_-]{43}$/);
  accounts.push(result.cookie);
  accountDetails.set(result.cookie, {
    email,
    password,
    recoveryCode: result.result.recoveryCode,
  });
  assert.equal(
    (
      await call("/api/auth/signup", {
        method: "POST",
        body: { email, password, invitation: token },
      })
    ).status,
    400,
  );
  return result.cookie;
}
async function upload(cookie, kind, name = "discrepancy.pdf", process = true) {
  const data = await readFile(new URL(`../demo/${name}`, import.meta.url));
  const body = new FormData();
  body.set("kind", kind);
  body.set("file", new Blob([data], { type: "application/pdf" }), name);
  const result = await call("/api/upload", { method: "POST", cookie, body });
  assert.equal(result.status, 200, JSON.stringify(result.result));
  if (kind === "bill" && process) {
    assert.equal(result.result.ocrStatus, "pending");
    const processed = await call(
      `/api/files/${result.result.evidenceFileId}/process`,
      { method: "POST", cookie },
    );
    assert.equal(processed.status, 200, JSON.stringify(processed.result));
    return { ...result.result, ...processed.result };
  }
  return result.result;
}
const input = {
  referenceNumber: "12345678901234",
  billMonth: "2026-09-01",
  previousReading: 100,
  currentReading: 200,
  multiplier: 1,
  billedUnits: 120,
  totalAmount: 5000,
  dueDate: "2026-09-20",
  meterIdentity: "M1",
  readingDate: "2026-09-10",
  readingStatus: "actual",
  meterType: "conventional",
  confirmed: true,
};
try {
  let first = await signup();
  const second = await signup();
  const credentials = accountDetails.get(first);
  assert.equal(
    (
      await call("/api/auth/login", {
        method: "POST",
        body: { email: credentials.email, password: "incorrect-password-123" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await call("/api/auth/login", {
        method: "POST",
        body: { email: credentials.email, password: credentials.password },
      })
    ).status,
    200,
  );
  const fractional = await call("/api/bills", {
    method: "POST",
    cookie: first,
    body: {
      ...input,
      billMonth: "2026-11-01",
      currentReading: 200.125,
      billedUnits: 100.125,
    },
  });
  assert.equal(fractional.status, 201);
  assert.equal(
    (await call("/api/overview", { cookie: first })).result.bills.find(
      (bill) => bill.id === fractional.result.id,
    ).currentReading,
    200.125,
  );
  assert.equal(
    (
      await call("/api/bills", {
        method: "POST",
        cookie: first,
        body: { ...input, totalAmount: 5000.001 },
      })
    ).status,
    400,
  );
  const source = await upload(first, "bill");
  if (process.env.REQUIRE_OCR === "true") {
    assert.equal(source.ocrStatus, "extracted");
    assert.ok(source.extraction.candidates.current_reading);
    assert.equal(
      (
        await call(`/api/files/${source.evidenceFileId}?preview=1`, {
          cookie: first,
        })
      ).status,
      200,
    );
  }
  const saved = await call("/api/bills", {
    method: "POST",
    cookie: first,
    body: { ...input, evidenceFileId: source.evidenceFileId },
  });
  assert.equal(saved.status, 201, JSON.stringify(saved.result));
  const billId = saved.result.id;
  const reading = {
    referenceNumber: input.referenceNumber,
    meterIdentity: "M1",
    meterType: "conventional",
    readingDate: "2026-09-10",
    readingValue: 210,
    multiplier: 1,
    note: "Synthetic test observation",
  };
  assert.equal(
    (
      await call("/api/readings", {
        method: "POST",
        cookie: first,
        body: reading,
      })
    ).status,
    201,
  );
  const household = (
    await database.query(
      "SELECT h.id FROM households h JOIN users u ON u.id=h.owner_id WHERE u.email=$1",
      [credentials.email],
    )
  ).rows[0].id;
  const quotaFixture = randomUUID();
  await database.query(
    "INSERT INTO evidence_files(id,household_id,kind,storage_key,original_name,mime_type,byte_size) VALUES($1,$2,'bill',$3,'TEST-QUOTA-METADATA','application/pdf',52428800)",
    [quotaFixture, household, `${household}/${quotaFixture}`],
  );
  try {
    const body = new FormData();
    body.set("kind", "bill");
    body.set("file", new Blob(["%PDF-fixture"]), "TEST.pdf");
    assert.equal(
      (await call("/api/upload", { method: "POST", cookie: first, body }))
        .status,
      413,
    );
  } finally {
    await database.query("DELETE FROM evidence_files WHERE id=$1", [
      quotaFixture,
    ]);
  }
  const interrupted = await upload(first, "bill", "normal.pdf", false);
  await database.query(
    "UPDATE evidence_files SET ocr_state='processing',processing_started_at=now() WHERE id=$1",
    [interrupted.evidenceFileId],
  );
  assert.equal(
    (
      await call(`/api/files/${interrupted.evidenceFileId}/process`, {
        method: "POST",
        cookie: first,
      })
    ).result.ocrStatus,
    "processing",
  );
  await database.query(
    "UPDATE evidence_files SET processing_started_at=now()-interval '3 minutes' WHERE id=$1",
    [interrupted.evidenceFileId],
  );
  const retry = await call(`/api/files/${interrupted.evidenceFileId}/process`, {
    method: "POST",
    cookie: first,
  });
  assert.equal(retry.status, 200);
  if (process.env.REQUIRE_OCR === "true")
    assert.equal(retry.result.ocrStatus, "extracted");
  assert.equal(
    (
      await call(`/api/files/${interrupted.evidenceFileId}`, {
        method: "DELETE",
        cookie: first,
      })
    ).status,
    200,
  );
  assert.equal(
    (
      await call(`/api/files/${interrupted.evidenceFileId}?preview=1`, {
        cookie: first,
      })
    ).status,
    404,
  );
  const receipt = await upload(first, "receipt");
  assert.equal(
    (
      await call("/api/payments", {
        method: "POST",
        cookie: first,
        body: {
          billId,
          evidenceFileId: receipt.evidenceFileId,
          amount: 4500,
          paidAt: "2026-09-18",
          channel: "bank",
        },
      })
    ).status,
    201,
  );
  const initialOverview = await call("/api/overview", { cookie: first });
  assert.equal(
    initialOverview.status,
    200,
    JSON.stringify(initialOverview.result),
  );
  let data = initialOverview.result;
  if (process.env.REQUIRE_OCR === "true")
    assert.equal(
      data.evidence.find((file) => file.id === source.evidenceFileId).extraction
        .candidates.current_reading.value,
      "1220",
    );
  for (const code of ["units", "payment", "observation"])
    assert.ok(
      data.findings.some((finding) => finding.id === `${billId}:${code}`),
    );
  if (process.env.REQUIRE_OCR === "true")
    assert.equal(
      data.bills.find((bill) => bill.id === billId).corrections.currentReading
        .extracted,
      "1220",
    );
  const opened = await call("/api/cases", {
    method: "POST",
    cookie: first,
    body: { findingId: `${billId}:units`, notes: "Synthetic investigation" },
  });
  assert.equal(opened.status, 201, JSON.stringify(opened.result));
  const caseId = opened.result.id;
  const originalCase = (await call(`/api/cases/${caseId}`, { cookie: first }))
    .result;
  assert.equal(originalCase.snapshot.bills[0].billedUnits, 120);
  assert.equal(
    (
      await call(`/api/cases/${caseId}`, {
        method: "PATCH",
        cookie: first,
        body: {
          status: "resolved",
          notes: "",
          outcome: "",
          evidenceIds: originalCase.evidenceIds,
        },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call(`/api/cases/${caseId}`, {
        method: "PATCH",
        cookie: first,
        body: {
          status: "awaiting_response",
          notes: "Request prepared",
          outcome: "",
          evidenceIds: originalCase.evidenceIds,
          checklist: {
            inspectSource: true,
            checkRecords: true,
            prepareReport: false,
            recordOutcome: false,
          },
        },
      })
    ).status,
    200,
  );
  assert.equal(
    (await call(`/cases/${caseId}/report`, { cookie: first })).status,
    200,
  );
  assert.equal(
    (await call(`/api/cases/${caseId}`, { cookie: first })).result.checklist
      .inspectSource,
    true,
  );
  const exported = await call(`/api/cases/${caseId}/export`, { cookie: first });
  assert.equal(exported.status, 200);
  assert.equal(exported.result.subarray(0, 5).toString(), "%PDF-");
  assert.ok((await PDFDocument.load(exported.result)).getPageCount() > 0);
  const observed = data.readings.find((item) => item.meterIdentity === "M1");
  const payment = data.payments.find((item) => item.billId === billId);
  assert.equal(observed.revision, 1);
  assert.equal(payment.revision, 1);
  for (const [kind, record, body] of [
    [
      "readings",
      observed,
      {
        ...reading,
        readingValue: 200,
        evidenceFileId: observed.evidenceFileId,
      },
    ],
    [
      "payments",
      payment,
      {
        billId,
        amount: 5000,
        paidAt: "2026-09-18",
        channel: "bank",
        reference: "corrected test",
        evidenceFileId: payment.evidenceFileId,
      },
    ],
  ]) {
    const path = `/api/${kind}/${record.id}`;
    assert.equal(
      (
        await call(path, {
          method: "PATCH",
          cookie: second,
          body: { ...body, revision: 1 },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(path, {
          method: "DELETE",
          cookie: second,
          body: { revision: 1 },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await call(path, {
          method: "PATCH",
          cookie: first,
          body: { ...body, revision: 99 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(path, {
          method: "PATCH",
          cookie: first,
          body: { ...body, revision: 1 },
        })
      ).status,
      200,
    );
    assert.equal(
      (
        await call(path, {
          method: "PATCH",
          cookie: first,
          body: { ...body, revision: 1 },
        })
      ).status,
      409,
    );
    const recordKind = kind === "readings" ? "reading" : "payment";
    const historyPath = `/api/record-history?kind=${recordKind}&id=${record.id}`;
    const ownHistory = await call(historyPath, { cookie: first });
    assert.equal(ownHistory.status, 200, JSON.stringify(ownHistory.result));
    assert.equal(ownHistory.result.entries.length, 1);
    assert.equal(
      (await call(historyPath, { cookie: second })).result.entries.length,
      0,
    );
    assert.equal(
      (
        await call(path, {
          method: "DELETE",
          cookie: first,
          body: { revision: 1 },
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(path, {
          method: "DELETE",
          cookie: first,
          body: { revision: 2 },
        })
      ).status,
      200,
    );
    assert.equal(
      (await call(historyPath, { cookie: first })).result.entries[0].action,
      "deleted",
    );
    assert.equal(
      (
        await call(path, {
          method: "DELETE",
          cookie: first,
          body: { revision: 2 },
        })
      ).status,
      404,
    );
  }
  assert.deepEqual(
    (await call(`/api/cases/${caseId}`, { cookie: first })).result.snapshot,
    originalCase.snapshot,
  );

  assert.equal(
    (
      await call(`/api/bills/${billId}`, {
        method: "PUT",
        cookie: first,
        body: {
          ...input,
          evidenceFileId: source.evidenceFileId,
          billedUnits: 100,
        },
      })
    ).status,
    200,
  );
  data = (await call("/api/overview", { cookie: first })).result;
  assert.ok(!data.findings.some((finding) => finding.id === `${billId}:units`));
  assert.deepEqual(data.cases[0].snapshot, originalCase.snapshot);
  const replacement = await call("/api/bills", {
    method: "POST",
    cookie: first,
    body: { ...input, billedUnits: 100, replacesBillId: billId },
  });
  assert.equal(replacement.status, 201);
  data = (await call("/api/overview", { cookie: first })).result;
  assert.equal(
    data.bills.find((bill) => bill.id === billId).supersededById,
    replacement.result.id,
  );
  assert.ok(!data.findings.some((finding) => finding.billId === billId));
  assert.equal(
    (await call("/api/overview", { cookie: second })).result.bills.length,
    0,
  );
  for (const path of [
    `/api/files/${source.evidenceFileId}`,
    `/api/files/${source.evidenceFileId}?preview=1`,
    `/api/cases/${caseId}`,
    `/cases/${caseId}/report`,
    `/api/cases/${caseId}/export`,
    `/api/files/${source.evidenceFileId}/process`,
  ])
    assert.equal((await call(path, { cookie: second })).status, 404, path);
  assert.equal(
    (
      await call(`/api/bills/${billId}`, {
        method: "PUT",
        cookie: second,
        body: input,
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/api/cases", {
        method: "POST",
        cookie: second,
        body: { findingId: `${billId}:units` },
      })
    ).status,
    409,
  );
  assert.equal(
    (
      await call(`/api/cases/${caseId}`, {
        method: "PATCH",
        cookie: second,
        body: { status: "open", notes: "", outcome: "", evidenceIds: [] },
      })
    ).status,
    404,
  );
  assert.equal(
    (
      await call("/api/bills", {
        method: "POST",
        cookie: second,
        body: { ...input, replacesBillId: replacement.result.id },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await call("/api/demo", {
        method: "POST",
        cookie: first,
        body: { reset: true },
      })
    ).status,
    404,
  );
  assert.equal(
    (await call(`/api/bills/${billId}`, { method: "DELETE", cookie: first }))
      .status,
    200,
  );
  assert.equal(
    (await call(`/api/files/${source.evidenceFileId}`, { cookie: first }))
      .status,
    200,
    "case captured evidence is retained",
  );
  if (process.env.TEST_LARGE_IMAGE) {
    const imageBody = new FormData();
    imageBody.set("kind", "bill");
    imageBody.set(
      "file",
      new Blob([await readFile(process.env.TEST_LARGE_IMAGE)], {
        type: "image/png",
      }),
      "TEST-LARGE-IMAGE.png",
    );
    const image = await call("/api/upload", {
      method: "POST",
      cookie: first,
      body: imageBody,
    });
    assert.equal(image.status, 200);
    const processed = await call(
      `/api/files/${image.result.evidenceFileId}/process`,
      { method: "POST", cookie: first },
    );
    assert.equal(processed.status, 200);
    assert.equal(processed.result.ocrStatus, "extracted");
    assert.ok(processed.result.extraction.pages[0].height <= 1400);
    assert.equal(
      (
        await call(`/api/files/${image.result.evidenceFileId}`, {
          method: "DELETE",
          cookie: first,
        })
      ).status,
      200,
    );
  }
  const invalid = new FormData();
  invalid.set("kind", "bill");
  invalid.set("file", new Blob(["not a PDF"]), "fake.pdf");
  assert.equal(
    (
      await call("/api/upload", {
        method: "POST",
        cookie: first,
        body: invalid,
      })
    ).status,
    400,
  );
  const unreadable = await upload(first, "bill", "unreadable.pdf");
  assert.equal(Object.keys(unreadable.fields).length, 0);
  assert.equal(
    (
      await call("/api/bills", {
        method: "POST",
        cookie: first,
        body: {
          ...input,
          billMonth: "2026-10-01",
          evidenceFileId: unreadable.evidenceFileId,
        },
      })
    ).status,
    201,
  );
  assert.equal(
    (await call("/api/demo", { method: "POST", body: { reset: false } }))
      .status,
    404,
  );
  assert.equal(
    (
      await call("/api/auth/recovery-code", {
        method: "POST",
        cookie: first,
        body: { password: "wrong-password-123" },
      })
    ).status,
    401,
  );
  const renewed = await call("/api/auth/recovery-code", {
    method: "POST",
    cookie: first,
    body: { password: credentials.password },
  });
  assert.equal(renewed.status, 200);
  assert.notEqual(renewed.result.recoveryCode, credentials.recoveryCode);
  assert.equal(
    (
      await call("/api/auth/recover", {
        method: "POST",
        body: {
          email: credentials.email,
          password: "new-smoke-password-456",
          recoveryCode: credentials.recoveryCode,
        },
      })
    ).status,
    400,
  );
  credentials.recoveryCode = renewed.result.recoveryCode;
  const recover = await call("/api/auth/recover", {
    method: "POST",
    body: {
      email: credentials.email,
      password: "new-smoke-password-456",
      recoveryCode: credentials.recoveryCode,
    },
  });
  assert.equal(recover.status, 200);
  assert.notEqual(recover.result.recoveryCode, credentials.recoveryCode);
  assert.equal((await call("/api/overview", { cookie: first })).status, 401);
  assert.equal(
    (
      await call("/api/auth/recover", {
        method: "POST",
        body: {
          email: credentials.email,
          password: "new-smoke-password-456",
          recoveryCode: credentials.recoveryCode,
        },
      })
    ).status,
    400,
  );
  const signedIn = await call("/api/auth/login", {
    method: "POST",
    body: { email: credentials.email, password: "new-smoke-password-456" },
  });
  assert.equal(signedIn.status, 200);
  first = signedIn.cookie;
  accounts.push(first);
  assert.equal(
    (await call("/api/household", { method: "DELETE", cookie: first })).status,
    200,
  );
  assert.equal((await call("/api/overview", { cookie: first })).status, 401);
  console.log(
    "Passed: OCR/preview, correction provenance, compatible observations, case snapshot/export, edits/replacements, tenant isolation, manual recovery, invitation/recovery/session revocation, disabled demo, PDF/checklist, deletion.",
  );
} finally {
  for (const cookie of accounts)
    await call("/api/household", { method: "DELETE", cookie }).catch(() => {});
  await database.query(
    "DELETE FROM invitations WHERE email LIKE 'smoke-%@example.test'",
  );
  await database.end();
}
