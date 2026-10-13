# GharFlow AI

A private household electricity evidence platform for LESCO conventional domestic bills. Families upload bills, confirm extracted values, compare compatible meter records, investigate source differences, and keep a case with a downloadable evidence report.

The hosted product starts with empty records and invitation-only access. Bill OCR uses local Python/Tesseract. Numeric checks remain deterministic. An optional AI investigator can explain one finding using the question, selected finding, and up to 24 months of structured records from that household connection; each request requires explicit consent. It excludes source documents, connection numbers, meter serials, names, and email addresses. OpenAI processes the request under the configured API account terms. GharFlow does not store AI answers. Findings do not establish utility error, verified payment posting, refunds, or official complaint submission.

## Local setup

Requirements: Node 24+, Docker Compose, and Python with Tesseract/Poppler for optional host development.

1. Copy `.env.example` to `.env` and replace database password and OCR token with independent random values. To enable AI investigations, set the server-side `OPENAI_API_KEY` and optionally `OPENAI_MODEL`; never use a `NEXT_PUBLIC_` variable for the key. Without the key, all non-AI household features remain available.
2. Run `docker compose up --build -d --wait`.
3. Open `http://localhost:3000/login`.
4. Configure an ignored `.env.local` with `DATABASE_URL=postgresql://gharflow:YOUR_URL_ENCODED_PASSWORD@127.0.0.1:5439/gharflow`. Generate an invitation using `node --env-file=.env.local scripts/invite.mjs household@example.com`.
5. Use that email and invitation to sign up. Save the one-time recovery code before continuing.

No documents are seeded. `demo/` contains explicitly synthetic **test fixtures**, excluded from the hosted image. The demo endpoint is disabled by default and always disabled in pilot mode.

## Hosted packaging and free-tier check

```sh
docker compose -f compose.yaml -f compose.hosted.yaml up --build -d --wait
```

This runs web and loopback OCR in one supervised container with a 512 MB memory limit and 0.1 CPU allocation. Local storage remains a Docker volume for this check; actual hosting uses private Supabase Storage. Follow [deployment instructions](docs/DEPLOYMENT.md) for Render and Supabase setup, invitations, encrypted backups, restoration, rollback, and operational limits.

## Verification

```sh
npm run typecheck
npm run lint
npm test
.venv/bin/python -m unittest discover -s ocr -p 'test*.py'
TEST_BASE_URL=http://127.0.0.1:3000 REQUIRE_OCR=true node --env-file=.env.local scripts/smoke.mjs
node --env-file=.env.local scripts/test-operations.mjs
node scripts/check-resources.mjs
```

Smoke tests create disposable invited accounts and delete them. They use synthetic files only as test inputs. Operations tests create isolated temporary databases and encrypted fixture archives, verify restoration and deletion exclusions, then remove them. See [verification record](docs/VERIFICATION.md) for completed checks and remaining gates.

## Evidence boundaries

LESCO extraction accuracy is **unverified** until unseen redacted real documents, including consecutive months, are evaluated. OCR confidence is a processing signal, not proof of accuracy. Users confirm fields before saving. Missing dates, meter identity, unknown/estimated readings, unsupported arrangements, duplicates, and gaps produce explicit unavailable comparisons.

Consumption planning uses compatible dated readings and kWh targets. It does not predict future consumption or calculate tariff savings. Case outcomes and checklists remain user reported; editing a bill cannot rewrite an existing case snapshot.

English copy lives in `src/lib/en.json`; Urdu translation and Unicode PDF fonts remain future work. The current English PDF explicitly marks unsupported characters instead of silently dropping notes.
