# Three-minute GharFlow walkthrough

The shipped walkthrough uses fictional documents. The visible synthetic banner must remain present. It demonstrates a functioning workflow, not utility integration or a real refund.

## 0:00–0:25 — Household problem

“A family sees a bill that does not match its recorded meter values. GharFlow helps inspect the evidence, calculate the difference, and keep a clear record of what happened.” Open **Explore the synthetic demo** from the login screen. This creates a separate disposable household.

## 0:25–1:15 — Inspect and compare

Open **Bills & findings**. August has matching readings and units. September's readings imply 120 kWh while its fictional bill states 160 kWh. Open **Inspect source / edit**, click **Show OCR source**, and point to the highlighted document value. Explain that the OCR signal is not an accuracy guarantee and that the saved values require user confirmation. Cancel the edit to return to findings.

## 1:15–2:10 — Act on the finding

Open a case from September's billed-units finding. Inspect the preserved calculation, source documents, and corrections. Add a note and set the status to **Awaiting response**. Open **Print / export** and save the evidence report as PDF. Explain that this is a household case record; no complaint has been automatically submitted.

## 2:10–2:40 — Show uncertainty and recovery

Upload `demo/unreadable.pdf`. It is explicitly synthetic and contains no supported bill fields. The source remains available; manually enter the required values and confirm them. Explain that missing dates, unknown reading basis, meter changes, or gaps between months produce unavailable comparisons rather than invented conclusions.

## 2:40–3:00 — Close with evidence

Show the consumption target based on two dated observations, then mention what was verified: private previews, edits and replacements, immutable case snapshots, case export, access isolation, and resettable demo data. State that real LESCO OCR accuracy remains unverified until a redacted held-out corpus is evaluated.

Reset the synthetic workspace from Settings before the next presentation. Never reset a real account to prepare a demo.

# Real document evaluation

Create a separate, private JSON manifest with `name`, `split: "held_out"`, `synthetic: false`, and a `documents` array. Each entry supplies a relative file path and expected extracted fields. Use redacted documents that were not used to tune extraction. Optional `correction_seconds` must come from a timed human review; omit it when unmeasured.

Run `PYTHONPATH=ocr .venv/bin/python ocr/evaluate.py /path/to/manifest.json --output /path/to/report.json`. Keep document paths and private data out of commits. Report metrics only for the declared dataset. The generated synthetic fixtures are pipeline examples, not evidence of general LESCO accuracy.
