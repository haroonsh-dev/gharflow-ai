# GharFlow AI

A runnable, local-first LESCO household electricity MVP. It keeps bills, meter readings, and payment records together, then flags differences a family can review. The app does **not** verify LESCO billing errors, payment posting, live meter usage, or utility account status.

## What works

- Email/password account and private household data.
- Bill PDF/image upload, local Tesseract OCR hints, mandatory field review, and manual entry when OCR fails.
- Deterministic checks: reading arithmetic, consecutive-bill continuity, duplicate periods, unusual usage increases, and receipt-total differences.
- Usage history and an approximate savings scenario using recent bill totals.
- Meter reading log, payment records with optional receipt files, evidence download, and full account/data deletion.

**Coverage:** The OCR patterns are conservative hints, not a validated LESCO parser. No redacted LESCO bills were available during implementation. Actual extraction coverage requires testing supplied redacted bills, including a consecutive-month pair. Users must confirm all values.

## Run with Docker Compose

1. Copy `.env.example` to `.env`. Replace both placeholders with different long random values (for example, generated with `openssl rand -hex 32`).
2. Run `docker compose up --build`.
3. Open `http://localhost:3000` and create an account.

The Compose stack contains PostgreSQL, the private OCR service, and Next.js. The web service applies pending SQL migrations at startup. Uploads live in the private `uploads` volume. `docker compose down` keeps data; `docker compose down -v` removes it.

Compose serves plain HTTP on localhost and sets `COOKIE_SECURE=false` for that environment. Set `COOKIE_SECURE=true` behind HTTPS before any hosted deployment.

## Local development

The app requires PostgreSQL and the OCR service. Set `DATABASE_URL`, `OCR_URL`, `OCR_INTERNAL_TOKEN`, and `UPLOAD_DIR` in an untracked `.env.local`; run `npm run migrate` with `DATABASE_URL` exported in your shell. For OCR, install Tesseract and Poppler, create a Python virtual environment, install `ocr/requirements.txt`, and run `uvicorn app:app --app-dir ocr --host 127.0.0.1 --port 8000`. Then run `npm install` and `npm run dev`.

## Reproducible checks

```sh
npm run typecheck
npm run lint
npm test
npm run build
python3 -m unittest discover -s ocr -p 'test_*.py'
node scripts/smoke.mjs
```

The Python test uses the environment where `ocr/requirements.txt` is installed. The smoke script expects a running app at `http://127.0.0.1:3000` by default. Set `TEST_BASE_URL` if different. It creates temporary accounts and synthetic records, exercises upload, bill review/save, findings, readings, receipts, cross-household access denial, and deletion. It does not validate OCR accuracy or render the browser UI.

## First household walkthrough

1. Create an account; choose **Add a bill**.
2. Upload a redacted LESCO bill or enter details manually. Verify every OCR hint against the document, especially the reference number, readings, units, amount, and month.
3. Save the bill. Review any finding and its compared values on **Bills & findings**.
4. Add a second consecutive bill to enable reading continuity and usage-change checks.
5. Add a dated meter reading and a payment record with an optional receipt. A receipt comparison does not prove the utility received payment.
6. Use the overview trend and savings slider as estimates. The estimate scales recent bill totals and does not model tariff slabs, fixed charges, or taxes.
7. Download your evidence from the bill/receipt record; delete the household from Settings when finished.

## Architecture and data boundaries

Next.js handles UI, authenticated route handlers, PostgreSQL queries, and owner-scoped private files. The internal FastAPI service reads at most two pages of a PDF or one image with Tesseract and returns candidate fields; it does not persist files. No external model receives document content. Passwords use Argon2id and sessions use random, hashed tokens in HTTP-only cookies. Mutating routes check request origin and validate JSON with Zod.

This is a local MVP, not a production hosting setup. Before a public launch, add email verification/recovery, abuse controls, database migration management for existing volumes, backups, operational monitoring, privacy/legal review, and verified bill-format fixtures. Do not advertise LESCO integration or an OCR accuracy figure without evidence.
