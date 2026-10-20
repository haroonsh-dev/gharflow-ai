"use client";

import { t } from "@/lib/copy";
import { fieldName } from "@/lib/provenance";
import { checklistLabels } from "@/lib/guidance";
import { useState, type FormEvent } from "react";
import { Scale, FileText } from "lucide-react";
import type { CaseRecord, Overview } from "@/lib/types";
import { isPtclAccountId } from "@/lib/ptcl";
import { api, json, PageHead, Empty } from "./ui";
import EvidencePreview from "./evidence-preview";

export default function CasesView({
  data,
  reload,
  selectedId,
}: {
  data: Overview;
  reload: () => Promise<void>;
  selectedId?: string | null;
}) {
  const [selected, setSelected] = useState<string | null>(selectedId ?? null);
  const item = data.cases.find(
    (item) => item.id === (selected ?? data.cases[0]?.id),
  );

  return (
    <>
      <PageHead
        eyebrow={t("TRACKED CASES & REGULATORY DOSSIERS")}
        title={t("From finding to regulatory follow-through.")}
        description={t(
          "Preserve calculations, attach OCR evidence, and generate compliant legal dispute packages for NEPRA or PTA.",
        )}
      />
      {!item ? (
        <section className="card">
          <Empty
            title={t("No cases opened yet")}
            text="Open an investigation case from any flagged review finding on Bills & findings."
          />
        </section>
      ) : (
        <div className="case-grid">
          <aside className="card case-list">
            <h2>{t("Your cases")}</h2>
            {data.cases.map((record) => (
              <button
                key={record.id}
                className={`case-select ${record.id === item.id ? "active" : ""}`}
                onClick={() => setSelected(record.id)}
              >
                <strong>{record.snapshot.finding.title}</strong>
                <small>
                  {record.status.replaceAll("_", " ")} ·{" "}
                  {record.createdAt.slice(0, 10)}
                </small>
              </button>
            ))}
          </aside>
          <CaseEditor
            key={item.id + item.updatedAt}
            item={item}
            data={data}
            reload={reload}
          />
        </div>
      )}
    </>
  );
}

function CaseEditor({
  item,
  data,
  reload,
}: {
  item: CaseRecord;
  data: Overview;
  reload: () => Promise<void>;
}) {
  const [checklist, setChecklist] = useState(item.checklist);
  const [status, setStatus] = useState(item.status);
  const [notes, setNotes] = useState(item.notes);
  const [outcome, setOutcome] = useState(item.outcome);
  const [evidenceIds, setEvidence] = useState(item.evidenceIds);
  const [selectedField, setField] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const snapshot = item.snapshot;
  const bill =
    snapshot.bills.find((bill) => bill.id === snapshot.finding.billId) ??
    snapshot.bills[0];

  const isPtcl =
    isPtclAccountId(bill?.referenceNumber ?? "") ||
    Boolean(snapshot.finding?.code?.startsWith("ptcl"));

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api(
        `/api/cases/${item.id}`,
        json({ status, notes, outcome, evidenceIds, checklist }, "PATCH"),
      );
      setNotice(t("Case notes and user-reported status saved."));
      await reload();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not save case"),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="section-heading" style={{ flexWrap: "wrap", gap: "14px" }}>
        <div>
          <span className="eyebrow">{t("IMMUTABLE CALCULATION SNAPSHOT")}</span>
          <h2>{snapshot.finding.title}</h2>
        </div>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          {isPtcl ? (
            <a
              className="button button-primary"
              href={`/api/cases/${item.id}/export?format=pta`}
              download
            >
              <Scale size={15} />
              {t("Download PTA Complaint (PDF)")}
            </a>
          ) : (
            <a
              className="button button-primary"
              href={`/api/cases/${item.id}/export?format=nepra`}
              download
            >
              <Scale size={15} />
              {t("Download NEPRA Complaint (PDF)")}
            </a>
          )}
          <a
            className="button button-outline"
            href={`/api/cases/${item.id}/export`}
            download
          >
            <FileText size={15} />
            {t("Standard Audit PDF")}
          </a>
          <a
            className="button button-outline"
            href={`/cases/${item.id}/report`}
            target="_blank"
            rel="noreferrer"
          >
            {t("Print / View")}
          </a>
        </div>
      </div>
      <p>{snapshot.finding.detail}</p>
      <ul className="evidence-values">
        {snapshot.finding.evidence.map((value) => (
          <li key={value}>{value}</li>
        ))}
      </ul>
      <p className="fine-print">
        {t("Captured")}
        {snapshot.capturedAt.slice(0, 19).replace("T", " ")} {t("UTC · rule")}
        {snapshot.ruleVersion}
        {t(". Editing a bill does not change this snapshot.")}
      </p>
      {snapshot.finding.missing.length > 0 && (
        <p className="info-strip">
          {t("Missing:")}
          {snapshot.finding.missing.join(" · ")}
        </p>
      )}
      {bill && (
        <details className="snapshot-details">
          <summary>{t("Inspect captured source and corrections")}</summary>
          <div className="source-choices">
            {Object.entries(bill.extraction?.candidates ?? {}).map(
              ([key, candidate]) => (
                <button
                  type="button"
                  className="button button-outline"
                  key={key}
                  onClick={() => setField(key)}
                >
                  {key.replaceAll("_", " ")}: {candidate.value}
                </button>
              ),
            )}
          </div>
          <EvidencePreview
            id={bill.evidenceFileId}
            extraction={bill.extraction}
            selected={selectedField}
          />
          {Object.entries(bill.corrections).map(([key, value]) => (
            <p key={key}>
              {t(fieldName(key))}
              {t(": OCR “")}
              {value.extracted}
              {t("” → confirmed “")}
              {value.confirmed}”
            </p>
          ))}
        </details>
      )}
      <form onSubmit={save} className="stack-form">
        <fieldset className="attachments">
          <legend>{t("Investigation checklist · user reported")}</legend>
          {(Object.entries(checklistLabels) as [keyof typeof checklistLabels, string][]).map(
            ([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={checklist[key]}
                  onChange={(event) =>
                    setChecklist((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                {label}
              </label>
            ),
          )}
        </fieldset>
        <label>
          {t("Investigation status")}
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as CaseRecord["status"])
            }
          >
            <option value="open">{t("Open · Gathering evidence")}</option>
            <option value="awaiting_response">
              {t("Awaiting utility response")}
            </option>
            <option value="resolved">{t("Resolved")}</option>
            <option value="dismissed">{t("Dismissed")}</option>
          </select>
        </label>
        <fieldset className="attachments">
          <legend>{t("Attach household evidence")}</legend>
          {data.evidence.length ? (
            data.evidence.map((evidence) => {
              const required = snapshot.documents.some(
                (document) => document.id === evidence.id,
              );
              return (
                <label key={evidence.id}>
                  <input
                    type="checkbox"
                    checked={evidenceIds.includes(evidence.id)}
                    disabled={required}
                    onChange={(event) =>
                      setEvidence((ids) =>
                        event.target.checked
                          ? [...ids, evidence.id]
                          : ids.filter((id) => id !== evidence.id),
                      )
                    }
                  />
                  {evidence.name}
                  {required ? t(" · captured source") : ""}
                </label>
              );
            })
          ) : (
            <p>{t("No uploaded documents available.")}</p>
          )}
        </fieldset>
        <label>
          {t("Case notes")}
          <textarea
            maxLength={3000}
            rows={4}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t(
              "Record reference numbers from phone calls, visiting SDO officer names, or responses received.",
            )}
          />
        </label>
        <label>
          {t("Outcome / explanation")}
          <textarea
            maxLength={3000}
            rows={3}
            required={status === "resolved" || status === "dismissed"}
            value={outcome}
            onChange={(event) => setOutcome(event.target.value)}
            placeholder={t("For example: Adjusted in subsequent bill cycle")}
          />
        </label>
        {notice && <p className="pill">{notice}</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="button button-primary" disabled={busy}>
          {busy ? t("Saving…") : t("Save case record")}
        </button>
      </form>
    </section>
  );
}
