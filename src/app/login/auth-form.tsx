"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Bolt, CircleCheck, FileSearch, LockKeyhole, TrendingDown } from "lucide-react";

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

  return <main className="auth-page">
    <section className="auth-story">
      <div className="brand brand-light"><span className="brand-mark"><Bolt size={23} strokeWidth={2.6} /></span><span>GharFlow <b>AI</b></span></div>
      <div className="auth-story-content">
        <span className="eyebrow-light">HOUSEHOLD ENERGY, MADE CLEAR</span>
        <h1>Know what your electricity bill is really saying.</h1>
        <p>Keep your LESCO bills and readings together. Spot figures worth checking and make decisions with the evidence in front of you.</p>
        <div className="story-steps"><div><FileSearch size={20}/><span>Upload a bill</span></div><div><CircleCheck size={20}/><span>Confirm the details</span></div><div><TrendingDown size={20}/><span>Review trends and findings</span></div></div>
      </div>
      <p className="auth-footnote">Local document reading · No external AI provider</p>
    </section>
    <section className="auth-panel">
      <div className="auth-card">
        <span className="eyebrow">YOUR PRIVATE WORKSPACE</span>
        <h2>{mode === "signup" ? "Start with clarity." : "Welcome back."}</h2>
        <p className="muted">{mode === "signup" ? "Create an account to keep your household records together." : "Sign in to continue reviewing your household records."}</p>
        <form onSubmit={submit} className="stack-form">
          <label>Email address<input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></label>
          <label>Password<input name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} minLength={12} required placeholder="At least 12 characters" /></label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="button button-primary full" disabled={busy}>{busy ? "Please wait…" : mode === "signup" ? "Create account" : "Sign in"}<ArrowRight size={18}/></button>
        </form>
        <p className="switch-mode">{mode === "signup" ? "Already have an account?" : "New to GharFlow?"} <button type="button" onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setError(""); }}>{mode === "signup" ? "Sign in" : "Create account"}</button></p>
        <p className="privacy-note"><LockKeyhole size={15}/> Your documents stay in your private household workspace.</p>
      </div>
    </section>
  </main>;
}
