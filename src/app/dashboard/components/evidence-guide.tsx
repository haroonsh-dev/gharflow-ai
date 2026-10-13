"use client";
import { useState } from "react";
import { ArrowRight, ScanLine, ShieldCheck } from "lucide-react";
import { t } from "@/lib/copy";
import type { Finding } from "@/lib/findings";
import { guidance, type InvestigationAction } from "@/lib/guidance";

export default function EvidenceGuide({
  findings,
  hasBills,
  onAction,
  onAdd,
}: {
  findings: Finding[];
  hasBills: boolean;
  onAction: (finding: Finding, action: InvestigationAction) => void;
  onAdd: () => void;
}) {
  const [topic, setTopic] = useState<"next" | "missing" | "privacy">("next");
  const review = findings.find((item) => item.kind === "review");
  const incomplete = findings.filter((item) => item.kind === "info");
  const finding = topic === "missing" ? incomplete[0] : review;
  const action = finding ? guidance(finding)[0] : undefined;
  return (
    <section className="card evidence-guide" aria-labelledby="guide-title">
      <div className="section-heading">
        <div className="guide-heading">
          <span className="guide-icon">
            <ScanLine size={22} />
          </span>
          <div>
            <span className="eyebrow">{t("YOUR EVIDENCE GUIDE")}</span>
            <h2 id="guide-title">{t("Make your next move clear.")}</h2>
          </div>
        </div>
        <span className="pill">{t("From saved records")}</span>
      </div>
      <div
        className="guide-questions"
        aria-label={t("Choose an evidence question")}
      >
        {(
          [
            ["next", "What should I check?"],
            ["missing", "What evidence is missing?"],
            ["privacy", "How is my data used?"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            aria-pressed={topic === key}
            onClick={() => setTopic(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="guide-answer" aria-live="polite" aria-atomic="true">
        {topic === "privacy" ? (
          <>
            <ShieldCheck size={24} />
            <div>
              <h3>{t("Your documents stay private.")}</h3>
              <p>
                {t(
                  "OCR runs locally. If you opt in for an AI investigation, only your question and redacted structured values from one connection are sent to OpenAI. Source documents and account identifiers are excluded.",
                )}
              </p>
              <small>
                {t(
                  "OCR confidence is a signal, not proof of accuracy. Real LESCO extraction coverage is still unverified.",
                )}
              </small>
            </div>
          </>
        ) : finding ? (
          <>
            <span className={`guide-indicator ${finding.kind}`} />
            <div>
              <h3>{finding.title}</h3>
              <p>{finding.detail}</p>
              {finding.evidence.length > 0 && (
                <div className="guide-calculation">
                  {finding.evidence.map((value, index) => (
                    <span key={index}>{value}</span>
                  ))}
                </div>
              )}
              {finding.missing.length > 0 && (
                <p className="guide-missing">
                  <strong>{t("Needed:")} </strong>
                  {finding.missing.join(" · ")}
                </p>
              )}
              {action && (
                <button
                  className="text-button"
                  onClick={() => onAction(finding, action)}
                >
                  {t(action.label)}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <span className="guide-indicator" />
            <div>
              <h3>
                {t(
                  topic === "missing" && hasBills
                    ? "No unavailable checks in this record."
                    : hasBills
                      ? "No review differences flagged."
                      : "Start with a bill you can inspect.",
                )}
              </h3>
              <p>
                {t(
                  hasBills
                    ? "No review differences are flagged in these confirmed records. This does not verify the utility account or prove the bill is correct."
                    : "Upload a bill or enter it manually. Confirm its values to see which comparisons are possible.",
                )}
              </p>
              {!hasBills && (
                <button className="text-button" onClick={onAdd}>
                  {t("Add your first bill")}
                  <ArrowRight size={16} />
                </button>
              )}
            </div>
          </>
        )}
      </div>
      <p className="guide-footnote">
        {t("Rule checks find numeric issues · AI helps investigate evidence")}
      </p>
    </section>
  );
}
