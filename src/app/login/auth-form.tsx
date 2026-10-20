"use client";

import { t } from "@/lib/copy";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Zap,
  LockKeyhole,
  FileText,
  ScanLine,
  FolderCheck,
  ShieldCheck,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

export default function AuthForm({ showDemo = false }: { showDemo?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup" | "recover">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const values = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.get("email"),
          password: values.get("password"),
          invitation: values.get("invitation"),
          recoveryCode: values.get("recoveryCode"),
        }),
      });
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? t("Could not continue"));
      if (result.recoveryCode) {
        setCode(result.recoveryCode);
        setSaved(false);
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not continue"),
      );
    } finally {
      setBusy(false);
    }
  }

  async function demo() {
    setBusy(true);
    try {
      const response = await fetch("/api/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: false }),
      });
      if (!response.ok) throw new Error(t("Demo unavailable"));
      router.push("/dashboard");
      router.refresh();
    } catch {
      setError(t("Demo unavailable"));
      setBusy(false);
    }
  }

  function continueAfterCode() {
    setCode("");
    if (mode === "recover") {
      setMode("login");
    } else {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="brand brand-light">
          <span className="brand-mark">
            <Zap size={21} />
          </span>
          <span>
            {t("GharFlow")}
            <b>AI</b>
          </span>
        </div>

        <div className="auth-story-content">
          <span className="eyebrow-light">
            <Sparkles size={13} />
            {t("PAKISTAN UTILITY & TELECOM FORENSICS")}
          </span>
          <h1>
            {t("Utility bills.")}
            <br />
            <span>{t("Audited down to the rupee.")}</span>
          </h1>
          <p>
            {t(
              "Autonomous billing intelligence for Pakistani households. Audit LESCO, K-Electric, MEPCO & PTCL records, detect 30-day pro-rata slab breaches, verify statutory taxes, and generate legal dispute dossiers.",
            )}
          </p>

          <div
            style={{
              marginTop: "28px",
              padding: "18px",
              background: "rgba(15, 23, 42, 0.65)",
              border: "1px solid rgba(56, 189, 248, 0.25)",
              borderRadius: "14px",
              backdropFilter: "blur(12px)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "12px",
                fontSize: "11px",
                color: "#7dd3fc",
                fontWeight: 700,
                letterSpacing: "0.06em",
              }}
            >
              <span>{t("FORENSIC SIMULATION ENGINE")}</span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  color: "#34d399",
                }}
              >
                <span
                  style={{
                    width: "6px",
                    height: "6px",
                    background: "#34d399",
                    borderRadius: "50%",
                  }}
                />
                {t("RULES v2026.4 ACTIVE")}
              </span>
            </div>

            <div
              style={{
                display: "grid",
                gap: "8px",
                fontSize: "12.5px",
                fontFamily: "ui-monospace, monospace",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#e2e8f0",
                }}
              >
                <span>{t("DISCO Grid")}</span>
                <span style={{ color: "#38bdf8" }}>
                  LESCO · KE · IESCO · MEPCO
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#e2e8f0",
                }}
              >
                <span>{t("Telecom Engine")}</span>
                <span style={{ color: "#a78bfa" }}>
                  PTCL · PRA 19.5% · WHT 15%
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  color: "#e2e8f0",
                }}
              >
                <span>{t("Consumer Protection")}</span>
                <span style={{ color: "#34d399" }}>
                  NEPRA CSM Ch 4 & PTA Compliant
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="auth-journey" aria-label={t("How GharFlow works")}>
          <div>
            <FileText size={18} />
            <strong>{t("01 / Upload bill")}</strong>
            <span>{t("Private local OCR")}</span>
          </div>
          <ArrowRight size={15} aria-hidden="true" />
          <div>
            <ScanLine size={18} />
            <strong>{t("02 / Audit tariffs")}</strong>
            <span>{t("30-day pro-rata check")}</span>
          </div>
          <ArrowRight size={15} aria-hidden="true" />
          <div>
            <FolderCheck size={18} />
            <strong>{t("03 / Export dossier")}</strong>
            <span>{t("NEPRA & PTA PDF")}</span>
          </div>
        </div>

        <p className="auth-footnote">
          <ShieldCheck size={15} />
          {t("Zero cloud document persistence · Evidence-first verification")}
        </p>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">{t("HOUSEHOLD WORKSPACE")}</span>
          <h2>
            {code
              ? t("Save your recovery code")
              : mode === "login"
                ? t("Sign in to your household")
                : mode === "signup"
                  ? t("Join household workspace")
                  : t("Recover your account")}
          </h2>

          {code ? (
            <>
              <p className="muted">
                {t(
                  "Keep this code in a password manager or another safe place. It is shown only now. Anyone with this code and your email can reset your password.",
                )}
              </p>
              <label className="field" style={{ marginTop: "16px" }}>
                <span>{t("New recovery code")}</span>
                <input readOnly value={code} className="recovery-code" />
              </label>
              <label className="confirmation-check">
                <input
                  type="checkbox"
                  checked={saved}
                  onChange={(event) => setSaved(event.target.checked)}
                />
                {t("I saved my recovery code securely.")}
              </label>
              <button
                disabled={!saved}
                className="button button-primary full"
                onClick={continueAfterCode}
              >
                {mode === "recover"
                  ? t("Return to sign in")
                  : t("Continue to household")}
              </button>
            </>
          ) : (
            <>
              <p className="muted">
                {mode === "signup"
                  ? t(
                      "Invited households only. Enter your email and operator invitation code.",
                    )
                  : mode === "recover"
                    ? t(
                        "Enter your recovery code and a new password to restore access.",
                      )
                    : t(
                        "Enter your credentials to review your utility records and dispute dossiers.",
                      )}
              </p>

              <form className="stack-form" onSubmit={submit}>
                <label>
                  {t("Email address")}
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    placeholder="household@example.com"
                  />
                </label>

                {mode === "signup" && (
                  <label>
                    {t("Invitation code")}
                    <input
                      name="invitation"
                      autoComplete="off"
                      required
                      minLength={43}
                      maxLength={43}
                      placeholder="Paste 43-character invitation token"
                    />
                  </label>
                )}

                {mode === "recover" && (
                  <label>
                    {t("Recovery code")}
                    <input
                      name="recoveryCode"
                      autoComplete="off"
                      required
                      minLength={43}
                      maxLength={43}
                      placeholder="Paste your emergency recovery code"
                    />
                  </label>
                )}

                <label>
                  {mode === "recover" ? t("New password") : t("Password")}
                  <input
                    name="password"
                    type="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={12}
                    maxLength={128}
                    required
                    placeholder="••••••••••••"
                  />
                </label>

                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}

                <button className="button button-primary full" disabled={busy}>
                  {busy
                    ? t("Verifying…")
                    : mode === "login"
                      ? t("Sign in")
                      : mode === "signup"
                        ? t("Create account")
                        : t("Reset password")}
                  <ArrowRight size={16} />
                </button>
              </form>

              <div className="auth-mode-actions">
                {(["login", "signup", "recover"] as const)
                  .filter((value) => value !== mode)
                  .map((value) => (
                    <button
                      className="text-button"
                      key={value}
                      disabled={busy}
                      onClick={() => {
                        setMode(value);
                        setError("");
                      }}
                    >
                      {value === "login"
                        ? t("Sign in")
                        : value === "signup"
                          ? t("Have an invitation?")
                          : t("Forgot password?")}
                    </button>
                  ))}
              </div>

              {showDemo && (
                <div style={{ marginTop: "24px" }}>
                  <button
                    className="button button-outline full"
                    disabled={busy}
                    onClick={() => void demo()}
                    style={{
                      border: "1px solid rgba(56, 189, 248, 0.25)",
                      background: "rgba(56, 189, 248, 0.05)",
                    }}
                  >
                    <Sparkles size={16} style={{ color: "#38bdf8" }} />
                    {t("Explore synthetic demo household")}
                  </button>
                </div>
              )}
            </>
          )}

          <p className="privacy-note">
            <LockKeyhole size={14} />
            {t("Your documents stay in your private household workspace.")}
          </p>
        </div>
      </section>
    </main>
  );
}
