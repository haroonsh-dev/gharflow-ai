# Invitation-only pilot verification

Verified locally on 2026-10-13. This record distinguishes the tested release from cloud deployment and real LESCO extraction accuracy.

## Completed checks

- TypeScript typecheck and ESLint passed; 21 TypeScript tests and four Python tests passed.
- Tests cover arithmetic, gaps, replacements, meter changes, estimated readings, separate connections, exact observations, correction provenance, unavailable comparisons, input precision, bounded request bodies, private storage, provider failures, validated checklists, and paginated PDF reports.
- Fresh isolated databases applied migrations 001–006. Encrypted streaming backup/restore passed, including wrong-passphrase rejection, deleted-household exclusions, retained private files/replacement links, session revocation, and database RLS access denial.
- Production Next.js build and the supervised web/Python Docker image passed. Synthetic fixtures are absent from the hosted runtime image.
- Authenticated production-container smoke tests exercise invitation expiry/reuse/email binding, signup, login, recovery-code rotation and session revocation, upload, private preview, correction, observations, receipts, investigation checklists, immutable snapshots, PDF download, replacement bills, cross-household denial, interrupted OCR retry, quota exhaustion, manual recovery, disabled demo creation, and deletion.
- Browser acceptance used an invited, non-demo account starting with empty records. Signup and recovery acknowledgement, original-document highlighting, correction retained after retry, observation and payment entry, replacement bill saving, case notes/status/checklists, and PDF download were checked. Disposable test data and its account were subsequently deleted. The bill files used for testing are explicitly synthetic, not real customer documents.
- Actual Chrome viewports measured 390/390 and 768/768 pixels for viewport/document width. Keyboard navigation, mobile menu focus, Escape dismissal, and offscreen inert navigation were checked.
- A 12-megapixel image and the full API journey ran in a local ARM64 container capped at 512 MiB and 0.1 CPU, without an OOM kill. After raster-copy optimization, the final release check measured a kernel peak of 327.6 MiB (an earlier isolated run measured 263.3 MiB). This is local constrained-resource evidence; Render's actual AMD64 instance remains untested.
- Runtime npm audit reported zero vulnerabilities. Full audit reported five development-only dependency advisories inherited through the Next ESLint/fast-glob/micromatch/braces chain (GHSA-vfj7-8cjw-p6xm). No compatible patched braces release was available; linting was retained and no forced framework downgrade was applied.

## Cloud deployment blocked

Render requires the user to sign in. Supabase's New Project page reports that the account's two active free-project slots are full. The operator must select a project to pause or provide an existing project dedicated to GharFlow. No unrelated project was modified. Secure deployment configuration has not been supplied.

Accordingly, real Supabase pooler TLS/storage integration, Render HTTPS, persistence across cloud redeployment, and hosted end-to-end acceptance remain unverified. Provider error handling was tested with mocks; local private persistence was tested with real filesystem objects. There is no claimed live hosted URL.

## Evidence boundaries

Unseen redacted LESCO bills, a consecutive-month pair, and receipts are still needed for extraction evaluation. Neither real field accuracy nor human correction time has been measured. OCR confidence never establishes accuracy. Outcomes and checklists remain user reported. No utility integration, automatic complaint delivery, live consumption, verified payment posting, or refund claim is implemented.

The current PDF uses English standard fonts and explicitly marks unsupported Unicode characters; reviewed Urdu copy and embedded Unicode fonts remain future work.

## Reproduce

```sh
npm run typecheck
npm run lint
npm test
.venv/bin/python -m unittest discover -s ocr -p 'test*.py'
node --env-file=.env.local scripts/test-operations.mjs
docker compose -f compose.yaml -f compose.hosted.yaml up --build -d --wait
TEST_BASE_URL=http://127.0.0.1:3000 REQUIRE_OCR=true node --env-file=.env.local scripts/smoke.mjs
node scripts/check-resources.mjs
```

Smoke tests delete only their disposable invited accounts. Operations tests use temporary databases and encrypted archives. Existing households are not reset. See DEPLOYMENT.md for secure cloud setup, invitations, backups, restoration, and rollback.

## Modern interface follow-up

The interface update passed typecheck, lint, all 23 TypeScript tests, and a production Next.js build. Two new rendering tests distinguish an empty household from a confirmed record without review flags, and verify that guide answers retain the actual finding, calculation, and missing evidence.

Browser checks used a disposable invited account with initially empty records. A manually entered test bill was saved, its 20 kWh arithmetic discrepancy appeared in the guide, and the guide opened that exact bill for editing. The privacy answer, upload navigation, 390/768/1280-pixel layouts with matching document widths, menu inert state, and Escape focus restoration were verified. Test bill and account were deleted. This guide uses existing saved findings and deterministic guidance, not an LLM. No external AI provider was added. Cloud deployment remains pending hosting configuration.

The optional AI investigator was added afterward. It uses the configured OpenAI Responses API with strict JSON Schema output and `store: false`; each request is user-initiated and consent-gated. This integration has not been exercised against a configured provider key, evaluated for answer quality, or deployed. Do not describe these gates as passed until they are run.

## Deeper investigation follow-up

Migration 007 adds optimistic revision numbers for observations/payments and private record-change history. Typecheck, lint, all 27 TypeScript tests, and four Python tests passed. Fresh migrations 001–007 and encrypted restoration passed, including revision-history retention, deleted-household exclusion, and RLS denial for the new history table. Authenticated API smoke tests cover owner-scoped correction/deletion, stale revisions, cross-household denial, history isolation, and unchanged case snapshots after record edits and deletion.

Browser acceptance used fictional values in a disposable invited account. A missing September period was located, its action prefilled the connection/month, and saving it through the review form enabled the compatible September–October comparison: 120 kWh over 30 days, 4 kWh/day. Observation and payment corrections persisted as revision 2; the original case snapshot remained unchanged. Private reading history showed the captured before/after values. Investigation layouts measured 390/390, 768/768, and 1280/1280 pixels for viewport/document width; the correction dialog was also checked at 390 pixels. The acceptance account and fictional records were removed after verification.

The comparison engine refuses inferred consumption for gaps, duplicate versions, meter changes, estimated/unknown readings, missing fields/dates, unsupported arrangements, and resets. Recorded bill amount changes are descriptive; there is no tariff attribution, official billing-error conclusion, or live meter data. The optional AI review is explanatory and cannot override these checks.

The supervised production Docker build/startup and complete authenticated smoke journey passed for the investigation backend under the local ARM64 512 MiB / 0.1 CPU cap. Kernel peak was 251.5 MiB with no OOM kill. The final copy/dialog positioning changes also passed the production Next.js build. Actual Render/Supabase deployment remains unverified and requires the hosting setup described above.
