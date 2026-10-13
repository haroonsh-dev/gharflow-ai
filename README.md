# GharFlow AI

A local household electricity evidence workspace for LESCO domestic conventional meters. The main journey is **upload → inspect source → confirm values → compare dated records → open a case → export and track the outcome**.

## Implemented capabilities

- Private accounts and household records in PostgreSQL.
- Local Tesseract OCR with page previews, highlighted value regions, and confidence signals. Every saved bill requires user confirmation. Extracted values, corrections, and confirmation time are recorded separately.
- Electricity connection grouping, meter identity, reading date, reading basis, and meter arrangement. Existing records retain an unknown status until reviewed.
- Bill editing and same-month replacement records. Superseded bills are excluded from checks.
- Comparisons require the right evidence: consecutive unique months, the same conventional meter and multiplier, and actual readings. Household observations are compared only on matching dates. Missing information produces an unavailable check.
- Cases capture immutable calculation snapshots, original document references, notes, attachments, and user-reported status. Reports can be printed or saved as PDF from the browser.
- Consumption targets in kWh from two compatible dated observations. No tariff-based rupee savings claim is made.
- A separate synthetic demo workspace with reset controls and visible fictional-data labels.

The app does not establish a utility error, verified payment posting, a refund, live consumption, or official complaint submission. Real LESCO extraction coverage remains unverified: no redacted held-out real bill corpus has been supplied.

## Run the complete stack

1. Copy `.env.example` to `.env` and replace the two placeholders with independent long random values, such as strings generated with `openssl rand -hex 32`.
2. Run `docker compose up --build -d --wait`.
3. Open `http://localhost:3000` and choose **Explore the synthetic demo**, or create a private household account.

Compose starts PostgreSQL, the internal OCR service, and Next.js. The web container runs pending versioned SQL migrations at startup, protected by a database advisory lock. Source files and generated previews live in a private upload volume. `docker compose down` keeps the volumes; `docker compose down -v` permanently removes them.

The web app and development database port are bound to localhost. Compose uses `COOKIE_SECURE=false` for local HTTP. Before hosted use, enable HTTPS and `COOKIE_SECURE=true`; disable `DEMO_ENABLED` if the demonstration endpoint should be unavailable. Public hosting also needs account recovery, abuse controls, backups, and operational monitoring.

## Development

Install Node dependencies with `npm ci`. Configure an untracked `.env.local` with `DATABASE_URL`, `OCR_URL`, `OCR_INTERNAL_TOKEN`, `UPLOAD_DIR`, and `COOKIE_SECURE=false`. The Compose database is available at localhost port 5439. Export `DATABASE_URL` before `npm run migrate`.

For the OCR service, install Tesseract and Poppler, create a Python virtual environment, install `ocr/requirements.txt`, and run `uvicorn app:app --app-dir ocr --host 127.0.0.1 --port 8000` with `OCR_INTERNAL_TOKEN` exported. Then run `npm run dev`.

English UI copy is collected in `src/lib/en.json`, accessed through `src/lib/copy.ts`. The shipped interface is English; a reviewed Urdu translation and RTL acceptance pass can be added later.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
.venv/bin/python -m unittest discover -s ocr -p 'test_*.py'
REQUIRE_OCR=true node scripts/smoke.mjs
```

The smoke script expects the running app at `http://127.0.0.1:3000`; override with `TEST_BASE_URL`. It creates disposable test accounts and checks OCR/preview, correction provenance, dated observations, case snapshots/export, edits/replacements, tenant isolation, manual recovery, separate demo reset, and deletion. `REQUIRE_OCR=true` requires a working local OCR provider instead of silently accepting fallback. These are synthetic pipeline checks, not real bill accuracy measurements.

Use the evaluator in `ocr/evaluate.py` for a declared held-out redacted corpus. It reports exact field matches, processing time, and human correction time only when measured durations are supplied. The shipped synthetic manifest is labeled `pipeline_fixture`; it cannot establish general LESCO performance.

## Demonstration

Follow [the three-minute walkthrough](docs/DEMO.md). The demo contains a normal bill, a 40 kWh arithmetic difference, two dated observations, and a document without supported fields for manual recovery. Use Settings to reset only the synthetic workspace. Real household data is never used as demo seed data.

## Architecture

Next.js owns authentication, validated routes, PostgreSQL data, and owner-scoped private files. FastAPI processes bounded document jobs in worker threads, with at most two concurrent jobs and two rendered PDF pages. It returns candidate fields and raster previews and does not retain uploaded files. No external AI provider receives document content.

Case calculations and source references are captured on the server from current findings, rather than accepted from the client. Editing a source record does not rewrite a case snapshot; evidence captured by a case survives bill deletion and is removed when the household is deleted. Case status and outcomes remain user reported.
