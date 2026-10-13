"use client";
import { t } from "@/lib/copy";
export default function WorkspaceError({ retry }: { retry: () => void }) {
  return (
    <main className="report-page">
      <section className="card">
        <h1>{t("Workspace temporarily unavailable")}</h1>
        <p>
          {t(
            "We could not load your private records. Try again when the service is available. No findings or account changes are confirmed by this screen.",
          )}
        </p>
        <button className="button button-primary" onClick={() => retry()}>
          {t("Try again")}
        </button>
        <a className="text-button" href="/login">
          {t("Return to sign in")}
        </a>
      </section>
    </main>
  );
}
