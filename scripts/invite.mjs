import pg from "pg";
import { randomBytes, createHash } from "node:crypto";
import { databaseConfig } from "./database-config.mjs";
const email = process.argv[2]?.trim().toLowerCase();
if (!email || !/^\S+@\S+\.\S+$/.test(email) || email.length > 254)
  throw new Error(
    "Usage: node --env-file=.env.operator scripts/invite.mjs household@example.com",
  );
const client = new pg.Client(databaseConfig());
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(741383)");
  const count = await client.query(
    "SELECT count(*) FROM households WHERE NOT is_demo",
  );
  const pending = await client.query(
    "SELECT count(DISTINCT email) FROM invitations WHERE consumed_at IS NULL AND expires_at>now() AND email<>$1",
    [email],
  );
  if (
    Number(count.rows[0].count) + Number(pending.rows[0].count) >=
    Number(process.env.HOUSEHOLD_LIMIT ?? 10)
  )
    throw new Error("Household invitation capacity reached");
  if (
    (await client.query("SELECT 1 FROM users WHERE email=$1", [email])).rowCount
  )
    throw new Error("Account already exists");
  await client.query(
    "UPDATE invitations SET expires_at=now() WHERE email=$1 AND consumed_at IS NULL",
    [email],
  );
  const token = randomBytes(32).toString("base64url");
  await client.query(
    "INSERT INTO invitations(email,token_hash) VALUES($1,$2)",
    [email, createHash("sha256").update(token).digest("hex")],
  );
  await client.query("COMMIT");
  console.log(
    `Invitation for ${email}\nCode: ${token}\nExpires in seven days. Share privately with the intended household. No email was sent.`,
  );
} catch (error) {
  await client.query("ROLLBACK");
  console.error(error instanceof Error ? error.message : "Invitation failed");
  process.exitCode = 1;
} finally {
  await client.end();
}
