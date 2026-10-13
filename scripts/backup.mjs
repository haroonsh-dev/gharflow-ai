import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
  scryptSync,
} from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import {
  readFile,
  writeFile,
  mkdir,
  open,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import path from "node:path";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { databaseConfig } from "./database-config.mjs";
const tables = [
  "users",
  "households",
  "invitations",
  "evidence_files",
  "bills",
  "meter_readings",
  "payments",
  "cases",
  "record_changes",
  "deletion_tombstones",
];
const [mode, file, ledger] = process.argv.slice(2);
if (!["backup", "restore", "tombstones"].includes(mode) || !file)
  throw new Error(
    "Usage: backup.mjs backup|tombstones FILE, or restore FILE CURRENT_DELETION_LEDGER",
  );
const client = new pg.Client(databaseConfig());
await client.connect();
const bucket = process.env.SUPABASE_STORAGE_BUCKET ?? "household-evidence";
const remote =
  process.env.STORAGE_DRIVER === "supabase"
    ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      }).storage.from(bucket)
    : null;
function validKey(key) {
  if (
    typeof key !== "string" ||
    !/^[a-f0-9-]{36}\/[a-f0-9-]{36}(?:-preview-[12])?$/.test(key)
  )
    throw new Error("Invalid archive object key");
  return key;
}
const keyPath = (key) =>
  path.resolve(process.env.UPLOAD_DIR ?? "./private_uploads", validKey(key));
async function getObject(key) {
  if (remote) {
    const result = await remote.download(validKey(key));
    if (result.error) throw new Error("Backup object read failed");
    return Buffer.from(await result.data.arrayBuffer());
  }
  return readFile(keyPath(key));
}
async function putObject(key, bytes) {
  if (bytes.length > 8 * 1024 * 1024)
    throw new Error("Archive object exceeds upload limit");
  if (remote) {
    const result = await remote.upload(validKey(key), bytes, {
      upsert: false,
      contentType: "application/octet-stream",
    });
    if (result.error) throw new Error("Restore object write failed");
  } else {
    await mkdir(path.dirname(keyPath(key)), { recursive: true, mode: 0o700 });
    await writeFile(keyPath(key), bytes, { mode: 0o600, flag: "wx" });
  }
}
const phrase = process.env.BACKUP_PASSPHRASE;
const written = [];
let output,
  temp,
  created = false;
async function appendBytes(bytes) {
  let offset = 0;
  while (offset < bytes.length) {
    const result = await output.write(
      bytes,
      offset,
      bytes.length - offset,
      null,
    );
    offset += result.bytesWritten;
  }
}
async function backup() {
  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ");
  const households = (
    await client.query(
      "SELECT id,owner_id,deleting FROM households ORDER BY id",
    )
  ).rows;
  for (const household of households)
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [
      household.id,
    ]);
  const deletedHouses = new Set(
    households.filter((h) => h.deleting).map((h) => h.id),
  );
  const deletedUsers = new Set(
    households.filter((h) => h.deleting).map((h) => h.owner_id),
  );
  const salt = randomBytes(16),
    iv = randomBytes(12);
  const header = Buffer.from(
    JSON.stringify({
      version: 2,
      salt: salt.toString("base64"),
      iv: iv.toString("base64"),
    }) + "\n",
  );
  const cipher = createCipheriv(
    "aes-256-gcm",
    scryptSync(phrase, salt, 32),
    iv,
  );
  cipher.setAAD(header);
  output = await open(file, "wx", 0o600);
  created = true;
  await appendBytes(header);
  const append = async (record) =>
    appendBytes(cipher.update(Buffer.from(JSON.stringify(record) + "\n")));
  await append({
    kind: "manifest",
    version: 2,
    capturedAt: new Date().toISOString(),
  });
  // Cursor batches and one object per line keep a full 500 MB pilot archive off the JS heap.
  for (const table of tables) {
    await client.query(
      `DECLARE archive_rows NO SCROLL CURSOR FOR SELECT to_jsonb(t) AS data FROM ${table} t`,
    );
    while (true) {
      const batch = await client.query("FETCH 100 FROM archive_rows");
      if (!batch.rowCount) break;
      for (const item of batch.rows) {
        const row = item.data;
        if (
          (table === "users" && deletedUsers.has(row.id)) ||
          (table === "households" && deletedHouses.has(row.id)) ||
          deletedHouses.has(row.household_id)
        )
          continue;
        await append({ kind: "row", table, data: row });
        if (table === "evidence_files")
          for (const key of [
            row.storage_key,
            ...(row.ocr_result?.pages ?? []).map(
              (p) => `${row.storage_key}-preview-${p.page}`,
            ),
          ]) {
            const bytes = await getObject(key);
            if (bytes.length > 8 * 1024 * 1024)
              throw new Error("Source object exceeds upload limit");
            await append({
              kind: "object",
              key,
              bytes: bytes.toString("base64"),
            });
          }
      }
    }
    await client.query("CLOSE archive_rows");
  }
  await client.query("COMMIT");
  await appendBytes(cipher.final());
  await appendBytes(cipher.getAuthTag());
  await output.sync();
  await output.close();
  output = null;
  console.log(
    "Encrypted streaming archive written. Session credentials are excluded.",
  );
}
async function authenticatedPlaintext() {
  temp = await mkdtemp(path.join(tmpdir(), "gharflow-restore-"));
  const handle = await open(file, "r");
  let header, tag, size;
  try {
    size = (await handle.stat()).size;
    const start = Buffer.alloc(1024);
    const read = await handle.read(start, 0, 1024, 0);
    const newline = start.subarray(0, read.bytesRead).indexOf(10);
    if (newline < 0 || size < newline + 18)
      throw new Error("Invalid archive header");
    header = start.subarray(0, newline + 1);
    tag = Buffer.alloc(16);
    await handle.read(tag, 0, 16, size - 16);
  } finally {
    await handle.close();
  }
  const envelope = JSON.parse(header.toString());
  if (envelope.version !== 2) throw new Error("Unsupported archive format");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    scryptSync(phrase, Buffer.from(envelope.salt, "base64"), 32),
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAAD(header);
  decipher.setAuthTag(tag);
  const plaintext = path.join(temp, "authenticated.ndjson");
  // Authenticate the entire archive before restoring any rows or objects.
  await pipeline(
    createReadStream(file, { start: header.length, end: size - 17 }),
    decipher,
    createWriteStream(plaintext, { flags: "wx", mode: 0o600 }),
  );
  return plaintext;
}
async function restore() {
  if (process.env.RESTORE_CONFIRM !== "EMPTY_TARGET" || !ledger)
    throw new Error(
      "Restore requires RESTORE_CONFIRM=EMPTY_TARGET and the latest deletion ledger",
    );
  const deletionLedger = JSON.parse(await readFile(ledger, "utf8"));
  const age = Date.now() - Date.parse(deletionLedger.capturedAt);
  if (
    !Array.isArray(deletionLedger.deletions) ||
    !Number.isFinite(age) ||
    age < -60000 ||
    age > 24 * 3600000
  )
    throw new Error("Export a current deletion ledger before restoring");
  const plaintext = await authenticatedPlaintext();
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(741383)");
  for (const table of tables)
    if ((await client.query(`SELECT 1 FROM ${table} LIMIT 1`)).rowCount)
      throw new Error("Restore target must be empty");
  const deletedHouses = new Set(
      deletionLedger.deletions.map((row) => row.household_id),
    ),
    deletedUsers = new Set(deletionLedger.deletions.map((row) => row.user_id));
  const deletedEmails = new Set(),
    expected = new Set(),
    replacements = [];
  let manifest = false;
  const lines = createInterface({
    input: createReadStream(plaintext),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.length > 12 * 1024 * 1024)
      throw new Error("Archive frame exceeds safety limit");
    const frame = JSON.parse(line);
    if (frame.kind === "manifest") {
      if (manifest || frame.version !== 2) throw new Error("Invalid manifest");
      manifest = true;
      continue;
    }
    if (!manifest) throw new Error("Missing manifest");
    if (frame.kind === "row") {
      if (!tables.includes(frame.table))
        throw new Error("Unsupported archive table");
      const table = frame.table,
        row = { ...frame.data };
      if (table === "users" && deletedUsers.has(row.id)) {
        deletedEmails.add(row.email);
        continue;
      }
      if (
        (table === "households" && deletedHouses.has(row.id)) ||
        (table === "invitations" && deletedEmails.has(row.email)) ||
        (table !== "deletion_tombstones" && deletedHouses.has(row.household_id))
      )
        continue;
      if (table === "bills" && row.superseded_by_id) {
        replacements.push([row.id, row.superseded_by_id]);
        row.superseded_by_id = null;
      }
      await client.query(
        `INSERT INTO ${table} SELECT * FROM json_populate_record(NULL::${table},$1::json)`,
        [JSON.stringify(row)],
      );
      if (table === "evidence_files")
        for (const key of [
          row.storage_key,
          ...(row.ocr_result?.pages ?? []).map(
            (p) => `${row.storage_key}-preview-${p.page}`,
          ),
        ])
          expected.add(validKey(key));
    } else if (frame.kind === "object") {
      validKey(frame.key);
      if (deletedHouses.has(frame.key.split("/")[0])) continue;
      if (!expected.has(frame.key) || written.includes(frame.key))
        throw new Error("Unexpected archive object");
      await putObject(frame.key, Buffer.from(frame.bytes, "base64"));
      written.push(frame.key);
    } else throw new Error("Unsupported archive frame");
  }
  if (!manifest || written.length !== expected.size)
    throw new Error("Archive evidence is incomplete");
  for (const [id, replacement] of replacements)
    await client.query("UPDATE bills SET superseded_by_id=$2 WHERE id=$1", [
      id,
      replacement,
    ]);
  for (const entry of deletionLedger.deletions)
    await client.query(
      "INSERT INTO deletion_tombstones(user_id,household_id) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [entry.user_id, entry.household_id],
    );
  await client.query("COMMIT");
  console.log(
    "Restore completed; deleted households excluded and all sessions revoked.",
  );
}
try {
  if (mode === "tombstones") {
    const result = await client.query(
      "SELECT user_id,household_id FROM deletion_tombstones",
    );
    await writeFile(
      file,
      JSON.stringify({
        capturedAt: new Date().toISOString(),
        deletions: result.rows,
      }),
      { mode: 0o600, flag: "wx" },
    );
    console.log(
      "Deletion ledger exported. Keep the newest ledger outside old archives.",
    );
  } else {
    if (!phrase || phrase.length < 24)
      throw new Error(
        "Set BACKUP_PASSPHRASE to at least 24 characters in secure operator configuration",
      );
    if (mode === "backup") await backup();
    else await restore();
  }
} catch (error) {
  await client.query("ROLLBACK").catch(() => {});
  if (written.length) {
    if (remote) await remote.remove(written);
    else for (const key of written) await rm(keyPath(key), { force: true });
  }
  if (output) await output.close();
  if (mode === "backup" && created) await rm(file, { force: true });
  console.error(
    "Operator task failed:",
    error instanceof Error ? error.message : "unknown",
  );
  process.exitCode = 1;
} finally {
  if (temp) await rm(temp, { recursive: true, force: true });
  await client.end();
}
