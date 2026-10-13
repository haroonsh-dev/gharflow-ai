# Synthetic test fixtures

These files support repeatable engineering tests. They are not real LESCO bills or proof of extraction accuracy. The hosted application does not seed them or expose a demo entry point.

- `demo/normal.pdf`: fictional readings and billed units agree.
- `demo/discrepancy.pdf`: fictional readings imply 120 kWh while billed units are 160 kWh.
- `demo/unreadable.pdf`: explicitly fictional input without supported bill fields, for manual recovery.

The authenticated smoke test uploads these files to disposable invited accounts, verifies persistence and access boundaries, and removes those accounts afterward. The legacy `/api/demo` route requires explicit local `DEMO_ENABLED=true` and is disabled unconditionally by `PILOT_MODE=true`.

For real extraction evaluation, create a private manifest with `split: "held_out"`, `synthetic: false`, document paths, expected fields, and optionally **measured** human `correction_seconds`. Run `PYTHONPATH=ocr .venv/bin/python ocr/evaluate.py /private/path/manifest.json --output /private/path/report.json`. Do not commit private documents or results containing household information. Report metrics only for that declared dataset.
