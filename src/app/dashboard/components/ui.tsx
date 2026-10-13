"use client";
import { t } from "@/lib/copy";
import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert, FileText, X } from "lucide-react";
import type { Finding } from "@/lib/findings";
export async function api<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  if (!response.headers.get("content-type")?.includes("application/json"))
    throw new Error(
      t(
        "Service temporarily unavailable. Your entered values have been preserved. Try again shortly.",
      ),
    );
  const result: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof result === "object" && result !== null && "error" in result
        ? String(result.error)
        : t("Request failed"),
    );
  return result as T;
}
export const json = (body: unknown, method = "POST"): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});
export const money = (amount: number) =>
  `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 2 }).format(amount)}`;
export const month = (value: string) =>
  new Intl.DateTimeFormat("en-PK", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 7)}-01T00:00:00Z`));
export function PageHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <FileText size={24} />
      </span>
      <strong>{title}</strong>
      <p>{text}</p>
      {action}
    </div>
  );
}
export function FindingRow({
  finding,
  action,
}: {
  finding: Finding;
  action?: ReactNode;
}) {
  return (
    <div className={`finding-row ${finding.kind}`}>
      <span className="finding-icon">
        <CircleAlert size={19} />
      </span>
      <div>
        <strong>{finding.title}</strong>
        <p>{finding.detail}</p>
        {finding.evidence.length > 0 && (
          <small>
            {t("Compared:")}
            {finding.evidence.join(" · ")}
          </small>
        )}
        {finding.missing.length > 0 && (
          <small className="block">
            {t("Needed:")}
            {finding.missing.join(" · ")}
          </small>
        )}
        {action}
      </div>
      <span className="finding-tag">
        {finding.kind === "review" ? "Review" : t("More data")}
      </span>
    </div>
  );
}
export function Confirmation({
  title,
  description,
  onConfirm,
  onCancel,
  busy = false,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="confirm-dialog"
      aria-labelledby="confirm-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onCancel();
      }}
    >
      <div className="section-heading">
        <h2 id="confirm-title">{title}</h2>
        <button
          className="icon-button"
          aria-label={t("Close confirmation")}
          disabled={busy}
          onClick={onCancel}
        >
          <X size={20} />
        </button>
      </div>
      <p>{description}</p>
      <div className="form-actions">
        <button
          className="button button-outline"
          autoFocus
          disabled={busy}
          onClick={onCancel}
        >
          {t("Cancel")}
        </button>
        <button
          className="button button-danger"
          disabled={busy}
          onClick={onConfirm}
        >
          {busy ? "Working…" : "Confirm"}
        </button>
      </div>
    </dialog>
  );
}
