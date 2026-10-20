import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import EvidenceGuide from "../src/app/dashboard/components/evidence-guide";
import type { Finding } from "../src/lib/findings";

const render = (hasBills: boolean, findings: Finding[] = []) =>
  renderToStaticMarkup(
    createElement(EvidenceGuide, {
      hasBills,
      findings,
      onAdd: () => {},
      onAction: () => {},
    }),
  );
test("evidence guide distinguishes an empty household from records without review flags", () => {
  assert.match(render(false), /Start with a bill you can inspect/);
  assert.match(render(false), /Add your first bill/);
  const confirmed = render(true);
  assert.match(confirmed, /No review differences flagged/);
  assert.match(confirmed, /does not verify the utility account/);
  assert.doesNotMatch(confirmed, /Add your first bill/);
});
test("evidence guide retains the actual finding and its calculation rather than generating a conclusion", () => {
  const finding: Finding = {
    id: "bill:units",
    code: "units",
    billId: "bill",
    kind: "review",
    title: "Reading arithmetic differs",
    detail: "Review the source before contacting the utility.",
    evidence: ["(200 − 100) × 1 = 100 kWh", "Billed 120 kWh"],
    missing: ["Original bill document"],
    relatedBillIds: [],
    readingIds: [],
    ruleVersion: "2.1.0",
  };
  const output = render(true, [finding]);
  assert.match(output, /Reading arithmetic differs/);
  assert.match(output, /100 kWh/);
  assert.match(output, /Original bill document/);
  assert.match(output, /Inspect this bill/);
  assert.match(
    output,
    /Rule checks find numeric issues · AI helps investigate evidence/,
  );
});
