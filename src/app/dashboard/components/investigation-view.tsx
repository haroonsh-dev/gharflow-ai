"use client";
import { useState } from "react";
import { ArrowRight, FileText, CircleAlert } from "lucide-react";
import { t } from "@/lib/copy";
import { connectionTimeline, compareBills } from "@/lib/investigation";
import type { Bill, Overview } from "@/lib/types";
import type { Finding } from "@/lib/findings";
import { PageHead, Field, Empty, money, month, FindingRow } from "./ui";
export default function InvestigationView({
  data,
  reference,
  onInspect,
  onAdd,
  onCase,
}: {
  data: Overview;
  reference: string;
  onInspect: (bill: Bill) => void;
  onAdd: (month?: string) => void;
  onCase: (finding: Finding) => Promise<void>;
}) {
  const active = data.bills.filter(
    (bill) => bill.referenceNumber === reference && !bill.supersededById,
  );
  const [first, setFirst] = useState(""),
    [second, setSecond] = useState("");
  const earlierId = active.some((bill) => bill.id === first)
    ? first
    : (active[1]?.id ?? "");
  const laterId = active.some((bill) => bill.id === second)
    ? second
    : (active[0]?.id ?? "");
  const comparison = compareBills(data.bills, earlierId, laterId),
    timeline = connectionTimeline(data.bills, reference);
  const format = (value: number | null) =>
    value === null
      ? t("Unavailable")
      : new Intl.NumberFormat("en-PK", { maximumFractionDigits: 3 }).format(
          value,
        );
  const relevant = comparison
    ? data.findings.filter((finding) =>
        [comparison.earlier.id, comparison.later.id].includes(finding.billId),
      )
    : [];
  return (
    <>
      <PageHead
        eyebrow={t("BILL INVESTIGATION")}
        title={t("Follow the evidence across months.")}
        description={t(
          "Locate gaps, compare source values, and see exactly why a meter comparison can or cannot run.",
        )}
        action={
          <button className="button button-primary" onClick={() => onAdd()}>
            {t("Add a bill")}
            <ArrowRight size={17} />
          </button>
        }
      />
      <section className="card investigation-timeline">
        <div className="section-heading">
          <h2>{t("Connection timeline")}</h2>
          <span className="pill">{t("Up to 24 months")}</span>
        </div>
        <p className="muted">
          {t(
            "Missing periods refer only to gaps between your saved bills. They do not prove the utility failed to issue a bill.",
          )}
        </p>
        {timeline.length ? (
          <div className="month-ledger">
            {timeline.map((entry) => (
              <div className={`ledger-month ${entry.state}`} key={entry.month}>
                <span>{month(entry.month)}</span>
                <strong>
                  {t(
                    entry.state === "missing"
                      ? "No bill saved"
                      : entry.state === "duplicate"
                        ? "Multiple active versions"
                        : "Bill saved",
                  )}
                </strong>
                <small>
                  {entry.bills.length
                    ? `${entry.bills.length} ${t("active records")}`
                    : t("Comparison gap")}
                </small>
                <button
                  className="text-button"
                  onClick={() =>
                    entry.bills[0]
                      ? onInspect(entry.bills[0])
                      : onAdd(entry.month)
                  }
                >
                  {t(
                    entry.state === "missing"
                      ? "Add this month"
                      : "Inspect record",
                  )}
                  <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <Empty
            title={t("Start a connection timeline")}
            text={t("Save a confirmed bill to anchor your monthly evidence.")}
          />
        )}
      </section>
      {active.length >= 2 ? (
        <>
          <section className="card comparison-card">
            <h2>{t("Compare two active bills")}</h2>
            <div className="form-grid">
              <Field label={t("First bill")}>
                <select
                  value={earlierId}
                  onChange={(e) => setFirst(e.target.value)}
                >
                  {active.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {month(bill.billMonth)} · {money(bill.totalAmount)} ·{" "}
                      {bill.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label={t("Second bill")}>
                <select
                  value={laterId}
                  onChange={(e) => setSecond(e.target.value)}
                >
                  {active.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {month(bill.billMonth)} · {money(bill.totalAmount)} ·{" "}
                      {bill.id.slice(0, 6)}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
            {comparison ? (
              <>
                <div className="comparison-table-wrap">
                  <table className="comparison-table">
                    <thead>
                      <tr>
                        <th scope="col">{t("Confirmed field")}</th>
                        <th scope="col">
                          {month(comparison.earlier.billMonth)}
                          <button
                            className="text-button"
                            onClick={() => onInspect(comparison.earlier)}
                          >
                            {t("Inspect source")}
                          </button>
                        </th>
                        <th scope="col">
                          {month(comparison.later.billMonth)}
                          <button
                            className="text-button"
                            onClick={() => onInspect(comparison.later)}
                          >
                            {t("Inspect source")}
                          </button>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(
                        [
                          [
                            "Meter identity / serial",
                            comparison.earlier.meterIdentity,
                            comparison.later.meterIdentity,
                          ],
                          [
                            "Reading basis",
                            comparison.earlier.readingStatus,
                            comparison.later.readingStatus,
                          ],
                          [
                            "Bill reading date",
                            comparison.earlier.readingDate,
                            comparison.later.readingDate,
                          ],
                          [
                            "Previous reading",
                            comparison.earlier.previousReading,
                            comparison.later.previousReading,
                          ],
                          [
                            "Current reading",
                            comparison.earlier.currentReading,
                            comparison.later.currentReading,
                          ],
                          [
                            "Multiplier",
                            comparison.earlier.multiplier,
                            comparison.later.multiplier,
                          ],
                          [
                            "Billed units (kWh)",
                            comparison.earlier.billedUnits,
                            comparison.later.billedUnits,
                          ],
                          [
                            "Total amount (PKR)",
                            money(comparison.earlier.totalAmount),
                            money(comparison.later.totalAmount),
                          ],
                        ] as const
                      ).map(([label, a, b]) => (
                        <tr key={label}>
                          <th scope="row">{t(label)}</th>
                          <td>{a ?? t("Not recorded")}</td>
                          <td>{b ?? t("Not recorded")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="comparison-deltas">
                  <div>
                    <small>{t("Recorded bill amount change")}</small>
                    <strong>{money(comparison.amountChange)}</strong>
                    <span>
                      {t(
                        "May include taxes and tariff changes; no cause is inferred.",
                      )}
                    </span>
                  </div>
                  <div>
                    <small>{t("Billed kWh change")}</small>
                    <strong>{format(comparison.billedUnitsChange)}</strong>
                    <span>
                      {t(
                        "Difference between entered bill units, not measured appliance use.",
                      )}
                    </span>
                  </div>
                </div>
                <div
                  className={`comparison-eligibility ${comparison.reasons.length ? "unavailable" : "available"}`}
                  role="status"
                >
                  <h3>
                    {t(
                      comparison.reasons.length
                        ? "Meter comparison unavailable"
                        : "Compatible dated bill readings",
                    )}
                  </h3>
                  {comparison.reasons.length ? (
                    <ul>
                      {comparison.reasons.map((reason) => (
                        <li key={reason}>{t(reason)}</li>
                      ))}
                    </ul>
                  ) : (
                    <>
                      <p>
                        {t("Meter difference:")} (
                        {comparison.later.currentReading} −{" "}
                        {comparison.earlier.currentReading}) ×{" "}
                        {comparison.later.multiplier} ={" "}
                        {format(comparison.meterKwh)} kWh
                      </p>
                      <strong>
                        {format(comparison.dailyKwh)} {t("kWh/day over")}{" "}
                        {comparison.days} {t("days")}
                      </strong>
                      <p>
                        {t(
                          "Calculated from confirmed bill readings. This is a historical average, not live consumption or a future prediction.",
                        )}
                      </p>
                    </>
                  )}
                </div>
              </>
            ) : (
              <p className="info-strip">
                {t("Choose two different bills to compare.")}
              </p>
            )}
          </section>
          {relevant.length > 0 && (
            <section className="card">
              <h2>{t("Findings for these records")}</h2>
              {relevant.map((finding) => (
                <FindingRow
                  key={finding.id}
                  finding={finding}
                  action={
                    <div className="investigation-actions">
                      <button
                        className="text-button"
                        onClick={() => {
                          const bill = data.bills.find(
                            (item) => item.id === finding.billId,
                          );
                          if (bill) onInspect(bill);
                        }}
                      >
                        <FileText size={15} />
                        {t("Inspect this bill")}
                      </button>
                      {finding.kind === "review" && (
                        <button
                          className="button button-secondary"
                          onClick={() => void onCase(finding)}
                        >
                          <CircleAlert size={15} />
                          {t("Open / view case")}
                        </button>
                      )}
                    </div>
                  }
                />
              ))}
            </section>
          )}
        </>
      ) : (
        <section className="card">
          <Empty
            title={t("Two active bills are needed")}
            text={t(
              "You can already inspect the timeline. Add a second bill to compare periods.",
            )}
          />
        </section>
      )}
    </>
  );
}
