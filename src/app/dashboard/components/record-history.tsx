"use client";
import { useEffect, useState } from "react";
import { t } from "@/lib/copy";
import type { Overview } from "@/lib/types";
import { api } from "./ui";
type Entry = {
  id: string;
  recordId: string;
  action: string;
  changedAt: string;
  changes: { label: string; before: string; after: string | null }[];
};
export default function RecordHistory({
  kind,
  refresh,
}: {
  kind: "reading" | "payment";
  refresh: Overview;
}) {
  const [entries, setEntries] = useState<Entry[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    void api<{ entries: Entry[] }>(`/api/record-history?kind=${kind}`)
      .then((result) => {
        if (alive) {
          setEntries(result.entries);
          setError("");
        }
      })
      .catch(() => {
        if (alive) setError(t("Revision history is temporarily unavailable."));
      });
    return () => {
      alive = false;
    };
  }, [kind, refresh]);
  return (
    <details className="revision-history">
      <summary>{t("Household corrections and deletions")}</summary>
      <p>
        {t(
          "Most recent 20 changes. Historical case snapshots are not rewritten.",
        )}
      </p>
      {error && <p role="alert">{error}</p>}
      {!entries.length && !error && <p>{t("No changes recorded yet.")}</p>}
      {entries.map((entry) => (
        <article key={entry.id}>
          <strong>
            {t(
              entry.action === "deleted" ? "Record deleted" : "Record updated",
            )}
          </strong>
          <small>
            {new Date(entry.changedAt).toLocaleString()} · {t("record")}{" "}
            {entry.recordId.slice(0, 8)}
          </small>
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
  );
}
