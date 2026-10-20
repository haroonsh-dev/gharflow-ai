"use client";

import { useState, type FormEvent } from "react";
import { Sparkles, ArrowUpRight, LoaderCircle } from "lucide-react";
import { t } from "@/lib/copy";
import { api, json } from "./ui";

type Source = {
  id: string;
  label: string;
  kind: "bill" | "reading" | "payment";
  recordId: string;
  billId: string;
};
type Result = {
  answer: {
    summary: string;
    evidence: { sourceId: string; explanation: string }[];
    alternatives: { explanation: string; sourceIds: string[] }[];
    nextChecks: string[];
    missingInformation: string[];
  };
  sources: Source[];
  model: string;
};

const SUGGESTIONS = [
  "Audit 30-day pro-rata slab jump",
  "Check PTCL 19.5% PRA sales tax & uncredited arrears",
  "Draft NEPRA Chapter 4 meter reading delay complaint",
];

export default function AIInvestigator({
  findingId,
  onOpenSource,
}: {
  findingId: string;
  onOpenSource: (source: Source) => void;
}) {
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setResult(
        await api<Result>(
          "/api/ai/investigate",
          json({ findingId, question, consent }),
        ),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("AI review failed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <details className="ai-investigator">
      <summary>
        <Sparkles size={17} aria-hidden="true" />
        <span>{t("Ask AI to investigate")}</span>
        <span className="ai-summary-note">{t("Evidence-grounded review")}</span>
      </summary>
      <form onSubmit={(event) => void submit(event)}>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", margin: "6px 0 10px" }}>
          {SUGGESTIONS.map((s) => (
            <button
              type="button"
              key={s}
              className="pill"
              style={{
                fontSize: "11px",
                cursor: "pointer",
                background: "rgba(139, 92, 246, 0.12)",
                borderColor: "rgba(139, 92, 246, 0.25)",
                color: "#d8b4fe",
              }}
              onClick={() => {
                setQuestion(s);
                setConsent(true);
              }}
            >
              + {s}
            </button>
          ))}
        </div>
        <label className="field">
          <span>{t("What would you like to understand?")}</span>
          <textarea
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            minLength={8}
            maxLength={600}
            required
            placeholder={t(
              "For example: What could explain this difference, and which source should I check first?",
            )}
          />
        </label>
        <label className="ai-consent">
          <input
            type="checkbox"
            checked={consent}
            onChange={(event) => setConsent(event.target.checked)}
            required
          />
          <span>
            {t(
              "For this answer, send my question, the selected finding, and this connection's structured bill, reading and receipt values to OpenAI.",
            )}
          </span>
        </label>
        <p className="ai-privacy-note">
          {t(
            "Original files, connection number, meter serial, name and email are excluded. Keep personal details out of your question. GharFlow does not save the answer; OpenAI processes this request under the configured account terms. The answer cannot change your records.",
          )}
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-primary"
          type="submit"
          disabled={busy || !consent || question.trim().length < 8}
        >
          {busy ? (
            <LoaderCircle className="spin" size={17} />
          ) : (
            <Sparkles size={17} />
          )}
          {busy
            ? t("Reviewing this evidence…")
            : t("Generate AI investigation")}
        </button>
      </form>
      {result && (
        <div className="ai-answer" aria-live="polite">
          <span className="eyebrow">{t("AI REVIEW")}</span>
          <p className="ai-summary">{result.answer.summary}</p>
          {result.answer.evidence.length > 0 && (
            <div>
              <strong>{t("Grounded in:")}</strong>
              {result.answer.evidence.map((item, index) => {
                const source = result.sources.find(
                  (entry) => entry.id === item.sourceId,
                );
                return (
                  <div key={index} className="ai-evidence-item">
                    {source && (
                      <button
                        type="button"
                        className="ai-citation"
                        onClick={() => onOpenSource(source)}
                      >
                        {source.label}
                        <ArrowUpRight size={13} aria-hidden="true" />
                      </button>
                    )}
                    <span>{item.explanation}</span>
                  </div>
                );
              })}
            </div>
          )}
          {result.answer.nextChecks.length > 0 && (
            <div>
              <strong>{t("Check next:")}</strong>
              <ul>
                {result.answer.nextChecks.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          {result.answer.missingInformation.length > 0 && (
            <div>
              <strong>{t("Information missing:")}</strong>
              <ul>
                {result.answer.missingInformation.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </div>
          )}
          <small className="ai-model-note">
            {t("Model:")} {result.model} · {t("Confidence signal only")}
          </small>
        </div>
      )}
    </details>
  );
}
