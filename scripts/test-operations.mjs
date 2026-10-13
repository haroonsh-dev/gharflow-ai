import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import pg from "pg";
import { databaseConfig } from "./database-config.mjs";
const admin = new pg.Client(databaseConfig());
await admin.connect();
const suffix = randomBytes(5).toString("hex");
const source = `gharflow_ops_${suffix}`,
  target = `gharflow_restore_${suffix}`;
const directory = await mkdtemp(path.join(tmpdir(), "gharflow-ops-"));
const uploadDir = path.join(directory, "source"),
  restoreDir = path.join(directory, "restore");
const passphrase = randomBytes(32).toString("hex");
function envFor(database, uploads = uploadDir) {
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `/${database}`;
  return {
    ...process.env,
    DATABASE_URL: url.toString(),
    STORAGE_DRIVER: "local",
    UPLOAD_DIR: uploads,
    BACKUP_PASSPHRASE: passphrase,
    RESTORE_CONFIRM: "EMPTY_TARGET",
  };
}
function run(script, args, env, success = true) {
  const result = spawnSync(process.execPath, [script, ...args], {
    env,
    encoding: "utf8",
  });
  assert.equal(result.status === 0, success, result.stderr);
  return result;
}
let sourceDb, targetDb;
try {
  await admin.query(`CREATE DATABASE ${source}`);
  await admin.query(`CREATE DATABASE ${target}`);
  run("scripts/migrate.mjs", [], envFor(source));
  run("scripts/migrate.mjs", [], envFor(target));
  sourceDb = new pg.Client({ connectionString: envFor(source).DATABASE_URL });
  await sourceDb.connect();
  targetDb = new pg.Client({ connectionString: envFor(target).DATABASE_URL });
  await targetDb.connect();
  const keptUser = randomUUID(),
    deletedUser = randomUUID(),
    keptHouse = randomUUID(),
    deletedHouse = randomUUID(),
    fileId = randomUUID(),
    billId = randomUUID(),
    replacementId = randomUUID();
  for (const [u, h, email] of [
    [keptUser, keptHouse, "keep@example.test"],
    [deletedUser, deletedHouse, "delete@example.test"],
  ]) {
    await sourceDb.query(
      "INSERT INTO users(id,email,password_hash) VALUES($1,$2,$3)",
      [u, email, "test-only-hash"],
    );
    await sourceDb.query("INSERT INTO households(id,owner_id) VALUES($1,$2)", [
      h,
      u,
    ]);
  }
  const key = `${keptHouse}/${fileId}`;
  await mkdir(path.join(uploadDir, keptHouse), { recursive: true });
  await writeFile(path.join(uploadDir, key), "%PDF-test-private-fixture");
  await sourceDb.query(
    "INSERT INTO evidence_files(id,household_id,kind,storage_key,original_name,mime_type,byte_size) VALUES($1,$2,'bill',$3,'TEST.pdf','application/pdf',24)",
    [fileId, keptHouse, key],
  );
  for (const id of [billId, replacementId])
    await sourceDb.query(
      "INSERT INTO bills(id,household_id,evidence_file_id,reference_number,bill_month,total_amount) VALUES($1,$2,$3,'12345678901234','2026-01-01',100)",
      [id, keptHouse, fileId],
    );
  await sourceDb.query("UPDATE bills SET superseded_by_id=$2 WHERE id=$1", [
    billId,
    replacementId,
  ]);
  await sourceDb.query(
    "INSERT INTO sessions(user_id,token_hash,expires_at) VALUES($1,'TEST-SESSION',now()+interval '1 day')",
    [keptUser],
  );
  run("scripts/invite.mjs", ["operator-one@example.test"], {
    ...envFor(source),
    HOUSEHOLD_LIMIT: "3",
  });
  run(
    "scripts/invite.mjs",
    ["operator-two@example.test"],
    { ...envFor(source), HOUSEHOLD_LIMIT: "3" },
    false,
  );
  const archive = path.join(directory, "backup.enc");
  run("scripts/backup.mjs", ["backup", archive], envFor(source));
  assert.ok(!(await readFile(archive, "utf8")).includes("keep@example.test"));
  await sourceDb.query(
    "INSERT INTO deletion_tombstones(user_id,household_id) VALUES($1,$2)",
    [deletedUser, deletedHouse],
  );
  await sourceDb.query("DELETE FROM users WHERE id=$1", [deletedUser]);
  const ledger = path.join(directory, "ledger.json");
  run("scripts/backup.mjs", ["tombstones", ledger], envFor(source));
  run(
    "scripts/backup.mjs",
    ["restore", archive, ledger],
    {
      ...envFor(target, restoreDir),
      BACKUP_PASSPHRASE: "wrong-password-that-is-long-enough",
    },
    false,
  );
  assert.equal(
    (await targetDb.query("SELECT count(*) FROM users")).rows[0].count,
    "0",
  );
  run(
    "scripts/backup.mjs",
    ["restore", archive, ledger],
    envFor(target, restoreDir),
  );
  assert.equal(
    (await targetDb.query("SELECT count(*) FROM users")).rows[0].count,
    "1",
  );
  assert.equal(
    (await targetDb.query("SELECT count(*) FROM sessions")).rows[0].count,
    "0",
  );
  assert.equal(
    (
      await targetDb.query("SELECT superseded_by_id FROM bills WHERE id=$1", [
        billId,
      ])
    ).rows[0].superseded_by_id,
    replacementId,
  );
  assert.equal(
    await readFile(path.join(restoreDir, key), "utf8"),
    "%PDF-test-private-fixture",
  );
  // A non-owner role cannot read rows or bypass RLS, even if granted SELECT.
  await targetDb.query("BEGIN");
  await targetDb.query("CREATE ROLE gharflow_ops_browser NOLOGIN");
  await targetDb.query("GRANT USAGE ON SCHEMA public TO gharflow_ops_browser");
  await targetDb.query("GRANT SELECT ON users TO gharflow_ops_browser");
  await targetDb.query("SET LOCAL ROLE gharflow_ops_browser");
  assert.equal((await targetDb.query("SELECT * FROM users")).rows.length, 0);
  await targetDb.query("ROLLBACK");
  console.log(
    "Passed: fresh migrations, encrypted backup, wrong-key rejection, restore with deletion exclusions, retained replacement links/files, revoked sessions, database RLS denial.",
  );
} finally {
  await sourceDb?.end();
  await targetDb?.end();
  for (const name of [source, target])
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  await admin.end();
  await rm(directory, { recursive: true, force: true });
}
