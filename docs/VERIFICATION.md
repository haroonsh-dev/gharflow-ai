# Hackathon upgrade verification

Verified locally on 2026-10-13. These checks establish a runnable local workflow; they do not establish production hosting, utility integration, or real LESCO extraction accuracy.

## Completed checks

- TypeScript typecheck and ESLint passed.
- Ten deterministic rule tests passed: normal records, arithmetic discrepancies, missing months, meter changes, estimated and unknown readings, replacements, duplicates, separate connections, exact observation matches, meter resets, consumption targets, and receipt wording.
- Three Python tests passed for extraction, signatures, token regions, and confidence handling.
- Fresh-database migrations 001, 002, and 003 applied successfully in an isolated temporary database.
- Next.js production build and both Docker images built successfully. PostgreSQL, web, and internal OCR services started with Docker Compose.
- `REQUIRE_OCR=true node scripts/smoke.mjs` passed against the production Docker web service. It exercises account creation, synthetic PDF OCR and private previews, correction provenance, observations and receipts, case snapshots and reports, edits and replacements, cross-household denial, manual recovery, isolated demo reset, and deletion.
- Browser checks exercised the separate synthetic demo, field-source highlighting, case creation, saved notes and status, printable report contents, and an unreadable synthetic upload saved through manual entry.
- The synthetic pipeline manifest matched all ten declared fields across its two fictional documents. This is a fixture result, not a held-out LESCO benchmark. Human correction time was not measured.

## Remaining verification

- Evaluate unseen redacted LESCO bills, including consecutive months, and receipts. Report accuracy and measured correction time only for that dataset.
- A mobile viewport override did not take effect in the available in-app browser (it remained 1280 pixels wide). Mobile CSS exists, but narrow-screen browser acceptance remains unverified.
- The browser checks above use the demo entry point; signup, payment entry, cross-account denial, and deletion were verified through the authenticated API smoke test.
- Report rendering and its print control were inspected. Saving a PDF through a native print dialog was not automated.
- Production deployment, backup/restore, operational monitoring, and an official hackathon rubric remain outside this local release.

## Reproduce

```sh
npm run typecheck
npm run lint
npm test
.venv/bin/python -m unittest discover -s ocr -p 'test*.py'
docker compose up --build -d --wait
REQUIRE_OCR=true node scripts/smoke.mjs
```

The smoke test creates disposable accounts and deletes their records and files at completion. It does not reset existing households. Follow `docs/DEMO.md` for the three-minute presentation.
