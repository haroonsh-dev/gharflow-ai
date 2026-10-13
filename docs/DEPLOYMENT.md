# Real household deployment: Render + Supabase

The hosted application starts empty. It requires invitations and never creates synthetic accounts or documents. Existing local files are not migrated automatically.

## Required operator access

Use a dedicated Supabase Free project and a Render account connected to this repository. Choose a nearby region offered by both providers. No paid domain or paid compute is required for this pilot. The provider-assigned HTTPS subdomain is the application URL.

Copy `.env.operator.example` to the ignored `.env.operator` file and set `chmod 600 .env.operator`. Supply the **session pooler** connection on port 5432, the project URL, and server-only storage key. URL-encode database password characters. Keep `DATABASE_SSL=true`; use a trusted CA file if your endpoint requires it. Never disable certificate verification.

## Prepare persistent storage

```sh
node --env-file=.env.operator scripts/migrate.mjs
node --env-file=.env.operator scripts/storage-setup.mjs
```

Use a dedicated private `household-evidence` bucket. The browser receives no Supabase key and has no bucket policies permitting direct access. Application tables use RLS with no browser policies, and grants to `anon` and `authenticated` are revoked. PostgreSQL access is server-only through the configured operator database role. Disable the Supabase Data API as an additional project setting if it is not used elsewhere.

## Deploy

Create a Render Blueprint from `render.yaml`, choose the **Free** instance, and supply its three prompted secrets: `DATABASE_URL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_KEY`. No secrets belong in the Blueprint or GitHub.

The container starts migrations, a single loopback OCR worker, and the Next standalone server under process supervision. Only the Next port is exposed. Render supplies `RENDER_EXTERNAL_URL`, which is used for origin validation; `APP_ORIGIN` can explicitly override it. Secure cookies, verified database TLS, private cloud storage, and disabled demo are checked by `/api/health`.

After readiness, verify the assigned HTTPS URL, create a disposable invitation account, upload explicitly labeled test evidence, download its report, and redeploy. Verify the same original, preview, record, and case survive. Delete that account afterward. Do not claim this gate passed without the real hosted run.

## Invite real households

```sh
node --env-file=.env.operator scripts/invite.mjs household@example.com
```

The operator receives a code once and shares it privately. Codes expire after seven days, are email-bound, and cannot be reused. Issuing another code revokes older unused codes for that email. The CLI reserves capacity for pending invitations; signup enforces the actual household cap transactionally. Default capacity is ten households, with 50 MB of originals and previews per household.

Signup displays a recovery code once. Users must save it securely. Recovery changes the password, rotates the recovery code, and revokes all sessions. Email ownership is not verified and no email is automatically sent. Signed-in users can renew a lost recovery code from Settings after confirming their current password. If both password and recovery code are lost, an independently verified operator support procedure is required; there is no hidden bypass endpoint.

## Backups, deletion, and recovery

Run backups on the operator's computer during a maintenance window:

```sh
node --env-file=.env.operator scripts/backup.mjs backup /secure/path/gharflow-backup.enc
node --env-file=.env.operator scripts/backup.mjs tombstones /secure/path/latest-deletion-ledger.json
```

Format 2 streams database cursor batches and individual files rather than building one giant JSON string, so the aggregate file quota does not exceed a JavaScript string limit. The archive contains encrypted database records and originals/previews. AES-256-GCM authenticates the entire archive before restoration starts, with a scrypt-derived key from `BACKUP_PASSPHRASE`. Sessions are excluded. Store the passphrase separately from the archive. Take a backup before each release and weekly while real users are active; retain archives for no more than seven days. Full file backups consume storage egress, so check the provider budget before increasing frequency. Changes since the last completed backup are outside its recovery point. Retention and execution are operator tasks, not an installed scheduler.

Before restoration, export the latest deletion ledger from the live source. The restore command requires a ledger less than 24 hours old, a freshly migrated empty target database, and a dedicated empty storage destination. Never restore over the live database or bucket. If the source is lost and a current ledger is unavailable, stop and reconcile deletions before restoration.

```sh
# Use a separate ignored environment file containing TARGET database/storage credentials.
RESTORE_CONFIRM=EMPTY_TARGET node --env-file=.env.restore scripts/backup.mjs restore /secure/path/gharflow-backup.enc /secure/path/latest-deletion-ledger.json
```

Deleted household IDs in the ledger are excluded from restoration. Retain the latest deletion ledger outside expiring archives. All restored users must sign in again. Account deletion removes live cloud objects before deleting records; if storage fails, account deletion remains pending and is retryable from Settings. Historical encrypted backups can contain deleted records until the retention window ends; they must never revive those households.

## Rollback and operations

Deployments are manual. Pin the tested Git commit. The migrations preserve existing records. For a code rollback, retain the upgraded schema and use a tested invitation-capable release. The pre-pilot application allowed unrestricted signup and must not be exposed online as a rollback target; if no safe release exists, suspend public access while repairing the current release. Do not run destructive down migrations on household data. Use a tested backup and an empty target for database disaster recovery.

Read `/api/health` for minimal readiness, provider logs for failures without document text, and provider dashboards for storage/database/egress limits. Successful health does not prove an OCR job or backup completed. Rate limits persist in PostgreSQL across process restarts. Review and remove expired rate-limit rows during maintenance.

Render Free sleeps when idle, has an ephemeral filesystem, and is not recommended by Render for production availability. Supabase Free has storage, database, egress, and inactivity limits. The app is a real invitation-only pilot; availability is limited by these services. Do not add fake keep-alive traffic or silently upgrade to paid plans.

Sources: [Render Free](https://render.com/docs/free), [Render Blueprint](https://render.com/docs/blueprint-spec), [Supabase pricing](https://supabase.com/pricing), [private buckets](https://supabase.com/docs/guides/storage/buckets/fundamentals).
