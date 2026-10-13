"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { t } from "@/lib/copy";
import type { Overview, Payment, Reading } from "@/lib/types";
import { api, json, Field, month, money } from "./ui";
export type EditableRecord =
  | { kind: "reading"; record: Reading }
  | { kind: "payment"; record: Payment };
type HistoryEntry = {
  action: string;
  changedAt: string;
  changes: { label: string; before: string; after: string | null }[];
};
export default function RecordEditor({
  item,
  data,
  onClose,
  reload,
  onBusy,
}: {
  item: EditableRecord;
  data: Overview;
  onClose: () => void;
  reload: () => Promise<void>;
  onBusy: (busy: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<HistoryEntry[]>([]),
    [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => {
      element?.close();
      previous?.focus();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    void api<{ entries: HistoryEntry[] }>(
      `/api/record-history?kind=${item.kind}&id=${item.record.id}`,
    )
      .then((result) => {
        if (alive) setHistory(result.entries);
      })
      .catch(() => {
        if (alive)
          setHistoryError(t("Revision history is temporarily unavailable."));
      });
    return () => {
      alive = false;
    };
  }, [item.kind, item.record.id]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    const body =
      item.kind === "reading"
        ? {
            referenceNumber: values.get("referenceNumber"),
            meterIdentity: values.get("meterIdentity"),
            readingDate: values.get("readingDate"),
            readingValue: Number(values.get("readingValue")),
            multiplier: Number(values.get("multiplier")),
            meterType: values.get("meterType"),
            note: values.get("note"),
          }
        : {
            billId: values.get("billId"),
            amount: Number(values.get("amount")),
            paidAt: values.get("paidAt"),
            channel: values.get("channel"),
            reference: values.get("reference"),
          };
    try {
      await api(
        `/api/${item.kind === "reading" ? "readings" : "payments"}/${item.record.id}`,
        json(
          {
            ...body,
            evidenceFileId: item.record.evidenceFileId,
            revision: item.record.revision,
          },
          "PATCH",
        ),
      );
      setSaved(true);
      try {
        await reload();
        onClose();
      } catch {
        setError(
          t(
            "The record was saved, but the list could not refresh. Close and reload before editing again.",
          ),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not update record"),
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="record-editor"
      aria-labelledby="record-editor-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <h2 id="record-editor-title">
        {t(
          item.kind === "reading"
            ? "Correct meter evidence"
            : "Correct payment evidence",
        )}
      </h2>
      <p className="muted">
        {t(
          "Current checks will use the corrected values. Existing case snapshots remain unchanged. The previous values are kept in private revision history.",
        )}
      </p>
      <form className="stack-form" onSubmit={save}>
        {item.kind === "reading" ? (
          <>
            <Field label={t("Connection reference number")}>
              <input
                name="referenceNumber"
                defaultValue={item.record.referenceNumber ?? ""}
                pattern="[0-9]{14}"
                maxLength={14}
                required
              />
            </Field>
            <Field label={t("Meter identity / serial")}>
              <input
                name="meterIdentity"
                defaultValue={item.record.meterIdentity ?? ""}
                maxLength={80}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label={t("Observation date")}>
                <input
                  name="readingDate"
                  type="date"
                  defaultValue={item.record.readingDate}
                  required
                />
              </Field>
              <Field label={t("Observed meter reading")}>
                <input
                  name="readingValue"
                  type="number"
                  min={0}
                  step="0.001"
                  defaultValue={item.record.readingValue}
                  required
                />
              </Field>
              <Field label={t("Multiplier")}>
                <input
                  name="multiplier"
                  type="number"
                  min="0.001"
                  step="0.001"
                  defaultValue={item.record.multiplier}
                  required
                />
              </Field>
              <Field label={t("Meter arrangement")}>
                <select name="meterType" defaultValue={item.record.meterType}>
                  <option value="unknown">{t("Unknown")}</option>
                  <option value="conventional">
                    {t("Conventional domestic meter")}
                  </option>
                  <option value="unsupported">
                    {t("Other / unsupported")}
                  </option>
                </select>
              </Field>
            </div>
            <Field label={t("Note")}>
              <input
                name="note"
                maxLength={300}
                defaultValue={item.record.note}
              />
            </Field>
          </>
        ) : (
          <>
            <Field label={t("Bill")}>
              <select name="billId" defaultValue={item.record.billId}>
                {data.bills.map((bill) => (
                  <option key={bill.id} value={bill.id}>
                    {month(bill.billMonth)} · {money(bill.totalAmount)} ·{" "}
                    {bill.referenceNumber.slice(-4)}
                    {bill.supersededById ? ` · ${t("Superseded")}` : ""}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("Amount paid (PKR)")}>
              <input
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                defaultValue={item.record.amount}
                required
              />
            </Field>
            <Field label={t("Payment date")}>
              <input
                name="paidAt"
                type="date"
                defaultValue={item.record.paidAt}
                required
              />
            </Field>
            <Field label={t("Channel")}>
              <input
                name="channel"
                maxLength={80}
                defaultValue={item.record.channel}
                required
              />
            </Field>
            <Field label={t("Transaction reference")}>
              <input
                name="reference"
                maxLength={120}
                defaultValue={item.record.reference}
              />
            </Field>
          </>
        )}
        {item.record.evidenceFileId && (
          <a
            className="text-button"
            href={`/api/files/${item.record.evidenceFileId}`}
            target="_blank"
            rel="noreferrer"
          >
            {t("Inspect attached evidence")}
          </a>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button button-secondary"
            type="button"
            disabled={busy}
            onClick={onClose}
          >
            {t("Cancel")}
          </button>
          <button className="button button-primary" disabled={busy || saved}>
            {t(busy ? "Saving…" : "Save corrections")}
          </button>
        </div>
      </form>
      <details className="revision-history">
        <summary>
          {t("Private revision history")} ({history.length})
        </summary>
        {historyError && <p role="alert">{historyError}</p>}
        {!historyError && !history.length && (
          <p>
            {t(
              "No prior edits recorded. Changes made before this feature are not reconstructed.",
            )}
          </p>
        )}
        {history.map((entry, index) => (
          <article key={index}>
            <strong>
              {t(
                entry.action === "deleted"
                  ? "Record deleted"
                  : "Record updated",
              )}
            </strong>
            <small>{entry.changedAt}</small>
            <ul>
              {entry.changes.map((change) => (
                <li key={change.label}>
                  <strong>{t(change.label)}: </strong>
                  {change.before || t("Not recorded")} →{" "}
                  {change.after ?? t("Deleted")}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </details>
    </dialog>
  );
}
