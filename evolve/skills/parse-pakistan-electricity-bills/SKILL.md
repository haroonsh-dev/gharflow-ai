---
name: parse-pakistan-electricity-bills
description: Guidance and regex procedures for extracting structured data from Pakistani electricity bills (LESCO, K-Electric, IESCO, MEPCO, FESCO).
version: 1.0.0
author: GharFlow AI
---

# Parsing Pakistani Electricity Bills

## Target Formats
1. **State DISCOs (LESCO, IESCO, MEPCO, FESCO, GEPCO, PESCO, HESCO, SEPCO, QESCO)**
   - 14-digit reference numbers (2-digit sub-division, 5-digit feeder/account, 7-digit consumer).
   - Date formats: `DD-MMM-YY` (e.g., `10-AUG-26`) or `DD/MM/YYYY`.
   - Tariff codes: `A-1a(01)` (domestic), `A-2` (commercial).
2. **K-Electric (Karachi)**
   - 13-digit account / consumer numbers.
   - Separate Peak and Off-Peak readings for TOU meters.

## Extraction Procedure
1. Scan for Reference Number / Consumer ID using whitespace-insensitive digit matchers.
2. Extract previous and current readings; calculate `(current - previous) * multiplier`.
3. Compare calculated units against stated billed units.
4. Verify whether billing days exceeded 31 days and caused a pro-rata slab escalation under NEPRA CSM Section 4.1.
