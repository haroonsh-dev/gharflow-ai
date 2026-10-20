import test from "node:test";
import assert from "node:assert/strict";
import { identifyDisco, parsePitcHtml } from "../src/lib/online-bill";

test("identifyDisco accurately maps Pakistani reference numbers to regional power distribution companies", () => {
  // LESCO (Lahore: prefix 01-08)
  assert.equal(identifyDisco("04112231234567").code, "LESCO");
  assert.equal(identifyDisco("01112231234567").name, "Lahore Electric Supply Company");

  // IESCO (Islamabad/Rawalpindi: prefix 16-19)
  assert.equal(identifyDisco("17112231234567").code, "IESCO");

  // MEPCO (Multan: prefix 20-24)
  assert.equal(identifyDisco("22112231234567").code, "MEPCO");

  // FESCO (Faisalabad: prefix 12-15)
  assert.equal(identifyDisco("14112231234567").code, "FESCO");

  // K-Electric (13 digits)
  assert.equal(identifyDisco("0400012345678").code, "KE");
  assert.equal(identifyDisco("0400012345678").name, "K-Electric");
});

test("parsePitcHtml extracts units and payable amount from PITC duplicate bill response", () => {
  const mockHtml = `
    <html>
      <body>
        <div>METER NO: ABC-123456</div>
        <div>READING DATE: 15-AUG-2026</div>
        <div>UNITS CONSUMED: 245</div>
        <div>AMOUNT PAYABLE WITHIN DUE DATE: 8,450</div>
      </body>
    </html>
  `;

  const parsed = parsePitcHtml(mockHtml, "04112231234567");
  assert.equal(parsed.disco, "LESCO");
  assert.equal(parsed.unitsConsumed, 245);
  assert.equal(parsed.totalAmount, 8450);
  assert.equal(parsed.meterNumber, "ABC-123456");
  assert.equal(parsed.isVerified, true);
});
