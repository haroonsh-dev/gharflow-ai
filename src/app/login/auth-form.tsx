"use client";
import { t } from "@/lib/copy";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap, LockKeyhole } from "lucide-react";
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
            <Zap size={23} />
          </span>
          <span>
            {t("GharFlow")}
            <b>AI</b>
          </span>
        </div>
        <div className="auth-story-content">
          <span className="eyebrow-light">
            {t("HOUSEHOLD ENERGY, MADE CLEAR")}
          </span>
          <h1>{t("Know what your electricity bill is really saying.")}</h1>
          <p>
            {t(
              "Keep your LESCO bills and readings together. Spot figures worth checking and make decisions with the evidence in front of you.",
            )}
          </p>
        </div>
        <p className="auth-footnote">
          {t("Private document processing · No external AI provider")}
        </p>
      </section>
      <section className="auth-panel">
        <div className="auth-card">
          <span className="eyebrow">{t("YOUR PRIVATE WORKSPACE")}</span>
          <h2>
            {code
              ? t("Save your recovery code")
              : mode === "login"
                ? t("Welcome back.")
                : mode === "signup"
                  ? t("Join your household workspace")
                  : t("Recover your account")}
          </h2>
          {code ? (
            <>
              <p>
                {t(
                  "Keep this code in a password manager or another safe place. It is shown only now. Anyone with this code and your email can reset your password. Email delivery and ownership verification are not provided.",
                )}
              </p>
              <label>
                {t("New recovery code")}
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
                      "Invited households only. Enter the email and single-use invitation supplied by the operator.",
                    )
                  : mode === "recover"
                    ? t(
                        "Enter your recovery code and a new password. Existing sessions will be signed out, and the recovery code will rotate.",
                      )
                    : t(
                        "Sign in to continue reviewing your household records.",
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
                  />
                </label>
                {error && (
                  <p role="alert" className="form-error">
                    {error}
                  </p>
                )}
                <button className="button button-primary full" disabled={busy}>
                  {busy
                    ? t("Please wait…")
                    : mode === "login"
                      ? t("Sign in")
                      : mode === "signup"
                        ? t("Create account")
                        : t("Reset password")}
                  <ArrowRight size={18} />
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
                          ? t("Use an invitation")
                          : t("Forgot password?")}
                    </button>
                  ))}
              </div>
              {showDemo && (
                <button
                  className="button button-outline full"
                  disabled={busy}
                  onClick={() => void demo()}
                >
                  {t("Explore the synthetic demo")}
                </button>
              )}
            </>
          )}
          <p className="privacy-note">
            <LockKeyhole size={15} />
            {t("Your documents stay in your private household workspace.")}
          </p>
        </div>
      </section>
    </main>
  );
}
