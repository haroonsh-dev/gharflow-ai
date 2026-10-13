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
          <span className="eyebrow">
            {t("AI analysis · verify against original records")}
          </span>
          <p className="ai-summary">{result.answer.summary}</p>
          {result.answer.evidence.length > 0 && (
            <section>
              <h4>{t("What the records show")}</h4>
              {result.answer.evidence.map((item, index) => {
                const source = result.sources.find(
                  (candidate) => candidate.id === item.sourceId,
                );
                return (
                  <div
                    className="ai-citation"
                    key={`${item.sourceId}:${index}`}
                  >
                    <p>{item.explanation}</p>
                    {source && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() => onOpenSource(source)}
                      >
                        {source.id} · {source.label}
                        <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                );
              })}
            </section>
          )}
          {result.answer.alternatives.length > 0 && (
            <section>
              <h4>{t("Other possibilities to verify")}</h4>
              <ul>
                {result.answer.alternatives.map((item, index) => (
                  <li key={index}>{item.explanation}</li>
                ))}
              </ul>
            </section>
          )}
          {result.answer.nextChecks.length > 0 && (
            <section>
              <h4>{t("Suggested checks")}</h4>
              <ol>
                {result.answer.nextChecks.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ol>
            </section>
          )}
          {result.answer.missingInformation.length > 0 && (
            <section>
              <h4>{t("Information still missing")}</h4>
              <ul>
                {result.answer.missingInformation.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            </section>
          )}
          <small className="ai-model-note">
            {t("Generated by")}: {result.model}.{" "}
            {t(
              "Model output can be wrong; verify every value in its linked source.",
            )}
          </small>
        </div>
      )}
    </details>
  );
}
