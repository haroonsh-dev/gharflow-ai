"use client";
import { t } from "@/lib/copy";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Zap as Bolt, CircleCheck, FileSearch, LockKeyhole, TrendingDown } from "lucide-react";

export default function AuthForm() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not continue");
      router.push("/dashboard"); router.refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not continue"); setBusy(false); }
  }

  async function demo(){setBusy(true);setError("");try{const response=await fetch("/api/demo",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({reset:false})});const result=await response.json();if(!response.ok)throw new Error(result.error??"Demo unavailable");router.push("/dashboard");router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:"Demo unavailable");setBusy(false);}}
  return <main className="auth-page">
    <section className="auth-story">
      <div className="brand brand-light"><span className="brand-mark"><Bolt size={23} strokeWidth={2.6} /></span><span>{t("GharFlow")}<b>{t("AI")}</b></span></div>
      <div className="auth-story-content">
        <span className="eyebrow-light">{t("HOUSEHOLD ENERGY, MADE CLEAR")}</span>
        <h1>{t("Know what your electricity bill is really saying.")}</h1>
        <p>{t("Keep your LESCO bills and readings together. Spot figures worth checking and make decisions with the evidence in front of you.")}</p>
        <div className="story-steps"><div><FileSearch size={20}/><span>{t("Upload a bill")}</span></div><div><CircleCheck size={20}/><span>{t("Confirm the details")}</span></div><div><TrendingDown size={20}/><span>{t("Review trends and findings")}</span></div></div>
      </div>
      <p className="auth-footnote">{t("Local document reading · No external AI provider")}</p>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <span className="eyebrow">{t("YOUR PRIVATE WORKSPACE")}</span>
        <h2>{mode === "signup" ? t("Start with clarity.") : t("Welcome back.")}</h2>
        <p className="muted">{mode === "signup" ? t("Create an account to keep your household records together.") : t("Sign in to continue reviewing your household records.")}</p>
        <form onSubmit={submit} className="stack-form">
          <label>{t("Email address")}<input name="email" type="email" autoComplete="email" required placeholder={t("you@example.com")} /></label>
          <label>{t("Password")}<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={12} required placeholder={t("At least 12 characters")} /></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-primary full" disabled={busy}>{busy ? t("Please wait…") : mode === "signup" ? t("Create account") : t("Sign in")}<ArrowRight size={18}/></button>
        </form>
        <div className="demo-action"><button type="button" className="button button-outline full" disabled={busy} onClick={()=>void demo()}>{t("Explore the synthetic demo")}</button><small>{t("Fictional documents · separate demo workspace · local processing")}</small></div>
        <p className="switch-mode">{mode === "signup" ? t("Already have an account?") : t("New to GharFlow?")} <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>{mode === "signup" ? t("Sign in") : t("Create account")}</button></p>
        <p className="privacy-note"><LockKeyhole size={15}/> {t("Your documents stay in your private household workspace.")}</p>
      </div>
    </section>
  </main>;
}
