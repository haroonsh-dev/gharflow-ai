"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, ArrowUpRight, Bolt, CalendarDays, Check, ChevronRight, CircleAlert, FilePlus2, FileText, Gauge, House, LogOut, Menu, Plus, ReceiptText, ShieldCheck, Trash2, TrendingDown, UploadCloud, Wallet, X } from "lucide-react";
import { savingsScenario, type BillRecord, type Finding } from "@/lib/findings";

type Bill = BillRecord & { evidenceFileId: string | null; fieldSources: Record<string, "ocr" | "user">; ocrStatus: string };
type Payment = { id: string; billId: string; evidenceFileId: string | null; amount: number; paidAt: string; channel: string; reference: string };
type Reading = { id: string; readingDate: string; readingValue: number; note: string };
type Overview = { email: string; bills: Bill[]; payments: Payment[]; readings: Reading[]; findings: Finding[] };
type View = "overview" | "bills" | "add" | "readings" | "payments" | "settings";
type BillDraft = { referenceNumber: string; billMonth: string; previousReading: string; currentReading: string; multiplier: string; billedUnits: string; totalAmount: string; dueDate: string };

const blank: BillDraft = { referenceNumber: "", billMonth: "", previousReading: "", currentReading: "", multiplier: "1", billedUnits: "", totalAmount: "", dueDate: "" };
const money = (amount: number) => `PKR ${new Intl.NumberFormat("en-PK", { maximumFractionDigits: 0 }).format(amount)}`;
const month = (value: string) => new Intl.DateTimeFormat("en-PK", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${value.slice(0,7)}-01T00:00:00Z`));

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, options);
  const result: unknown = await response.json();
  if (!response.ok) throw new Error(typeof result === "object" && result !== null && "error" in result ? String(result.error) : "Request failed");
  return result as T;
}

function Logo() { return <div className="brand"><span className="brand-mark"><Bolt size={20} strokeWidth={2.7}/></span><span>GharFlow <b>AI</b></span></div>; }

export default function Dashboard() {
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const load = useCallback(async () => { try { setData(await requestJson<Overview>("/api/overview")); setError(""); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load your records"); } }, []);
  useEffect(() => { void requestJson<Overview>("/api/overview").then(setData).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : "Could not load your records")); }, []);

  function go(next: View) { setView(next); setMobileOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }
  async function logout() { await requestJson("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }
  const nav: { key: View; label: string; icon: typeof House }[] = [
    { key: "overview", label: "Overview", icon: House }, { key: "bills", label: "Bills & findings", icon: FileText },
    { key: "readings", label: "Meter readings", icon: Gauge }, { key: "payments", label: "Payment records", icon: Wallet },
    { key: "settings", label: "Settings", icon: ShieldCheck },
  ];
  return <div className="app-shell">
    <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
      <div className="sidebar-top"><Logo/><button className="icon-button mobile-close" aria-label="Close menu" onClick={() => setMobileOpen(false)}><X size={20}/></button></div>
      <div className="workspace-chip"><span className="workspace-avatar">H</span><span><strong>My household</strong><small>LESCO workspace</small></span></div>
      <span className="sidebar-caption">WORKSPACE</span>
      <nav aria-label="Main navigation">{nav.map((item) => <button key={item.key} className={`nav-item ${view === item.key ? "active" : ""}`} onClick={() => go(item.key)}><item.icon size={19}/>{item.label}{view === item.key && <ChevronRight size={16} className="nav-chevron"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-tip"><span className="tip-icon"><ShieldCheck size={18}/></span><strong>Your data stays yours</strong><p>Evidence is private to your household. OCR runs locally.</p></div><button className="nav-item signout" onClick={logout}><LogOut size={18}/> Sign out</button></div>
    </aside>
    {mobileOpen && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setMobileOpen(false)}/>}
    <div className="main-wrap">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu size={22}/></button><span className="breadcrumb">Household <ChevronRight size={15}/> <strong>{view === "add" ? "Add bill" : nav.find((item) => item.key === view)?.label}</strong></span><span className="topbar-right"><span className="coverage-dot"/> LESCO · Local analysis</span></header>
      <main className="content">
        {error && <div className="alert-error" role="alert"><CircleAlert size={19}/>{error}<button onClick={() => void load()}>Retry</button></div>}
        {!data ? <div className="loading-card">Loading your household workspace…</div> : <>
          {view === "overview" && <OverviewView data={data} go={go}/>}
          {view === "bills" && <BillsView data={data} go={go} reload={load}/>}
          {view === "add" && <BillEntry go={go} reload={load}/>}
          {view === "readings" && <ReadingsView data={data} reload={load}/>}
          {view === "payments" && <PaymentsView data={data} reload={load}/>}
          {view === "settings" && <SettingsView email={data.email}/>}
        </>}
      </main>
    </div>
  </div>;
}

function PageHead({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return <div className="page-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
}

function OverviewView({ data, go }: { data: Overview; go: (view: View) => void }) {
  const latest = data.bills[0];
  const review = data.findings.filter((finding) => finding.kind === "review");
  const [reduction, setReduction] = useState(10);
  const scenario = savingsScenario(data.bills, reduction);
  return <>
    <PageHead eyebrow="GOOD TO HAVE YOU HERE" title="Your energy, in focus." description="A clear view of your bills, readings, and items worth checking." action={<button className="button button-primary" onClick={() => go("add")}><Plus size={18}/> Add a bill</button>}/>
    <div className="hero-banner"><div><span className="hero-kicker"><Activity size={15}/> HOUSEHOLD INSIGHT</span><h2>Better decisions start with clear evidence.</h2><p>Upload a LESCO bill, confirm its details, and see what the numbers actually support.</p><button onClick={() => go(data.bills.length ? "bills" : "add")}>{data.bills.length ? "Review your findings" : "Add your first bill"}<ArrowRight size={17}/></button></div><div className="hero-art" aria-hidden="true"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><span className="hero-bolt"><Bolt size={47}/></span></div></div>
    <div className="metric-grid"><Metric icon={ReceiptText} label="Latest bill" value={latest ? money(latest.totalAmount) : "—"} note={latest ? month(latest.billMonth) : "Add a bill to begin"}/><Metric icon={Gauge} label="Latest billed units" value={latest?.billedUnits == null ? "—" : `${latest.billedUnits} kWh`} note="From confirmed bill details"/><Metric icon={CircleAlert} label="Items to review" value={String(review.length)} note={review.length ? "Evidence-backed checks" : "No active flags"}/></div>
    <div className="dashboard-grid"><section className="card trend-card"><div className="section-heading"><div><span className="eyebrow">YOUR HISTORY</span><h2>Monthly usage</h2></div><span className="pill">Billed units</span></div><Trend bills={data.bills}/></section><section className="card savings-card"><span className="eyebrow">SCENARIO CALCULATOR</span><div className="savings-icon"><TrendingDown size={22}/></div><h2>What could using less mean?</h2><p>Explore an approximate bill difference using your recent totals.</p><label htmlFor="reduction" className="range-label">Usage reduction <strong>{reduction}%</strong></label><input id="reduction" type="range" min="5" max="30" step="5" value={reduction} onChange={(event) => setReduction(Number(event.target.value))}/><div className="savings-result"><small>Approximate monthly difference</small><strong>{scenario ? money(scenario.monthlyPkr) : "Add a bill"}</strong></div><p className="fine-print">{scenario?.basis ?? "A bill with units is needed for this estimate."}</p></section></div>
    <section className="card findings-card"><div className="section-heading"><div><span className="eyebrow">EVIDENCE CHECKS</span><h2>Worth your attention</h2></div><button className="text-button" onClick={() => go("bills")}>All bills <ArrowUpRight size={16}/></button></div>{review.length ? <div className="finding-list">{review.slice(0,3).map((finding) => <FindingRow key={finding.id} finding={finding}/>)}</div> : <Empty icon={Check} title="No flagged differences yet" text={data.bills.length ? "Your saved bills have no current review flags. Add consecutive bills for more checks." : "Add a bill to run the first evidence checks."} action={<button className="button button-outline" onClick={() => go("add")}>Add a bill</button>}/>}</section>
  </>;
}

function Metric({ icon: Icon, label, value, note }: { icon: typeof House; label: string; value: string; note: string }) { return <div className="metric-card"><span className="metric-icon"><Icon size={20}/></span><span className="metric-label">{label}</span><strong>{value}</strong><small>{note}</small></div>; }
function Trend({ bills }: { bills: Bill[] }) {
  const points = [...bills].filter((bill) => bill.billedUnits !== null).sort((a,b) => a.billMonth.localeCompare(b.billMonth)).slice(-6);
  if (!points.length) return <Empty icon={Activity} title="Your trend starts here" text="Add a bill with confirmed units to see monthly usage."/>;
  const max = Math.max(...points.map((bill) => bill.billedUnits ?? 0), 1);
  return <><div className="bar-chart" role="img" aria-label="Billed units by month">{points.map((bill) => <div className="bar-column" key={bill.id}><span className="bar-value">{bill.billedUnits}</span><div className="bar-track"><div className="bar-fill" style={{ height: `${Math.max(7, ((bill.billedUnits ?? 0)/max)*100)}%` }}/></div><span className="bar-label">{month(bill.billMonth).split(" ")[0]}</span></div>)}</div><table className="sr-only"><caption>Monthly billed units</caption><thead><tr><th>Month</th><th>Units</th></tr></thead><tbody>{points.map((bill) => <tr key={bill.id}><td>{month(bill.billMonth)}</td><td>{bill.billedUnits}</td></tr>)}</tbody></table></>;
}
function Empty({ icon: Icon, title, text, action }: { icon: typeof House; title: string; text: string; action?: React.ReactNode }) { return <div className="empty"><span className="empty-icon"><Icon size={24}/></span><strong>{title}</strong><p>{text}</p>{action}</div>; }
function FindingRow({ finding }: { finding: Finding }) { return <div className={`finding-row ${finding.kind}`}><span className="finding-icon">{finding.kind === "review" ? <CircleAlert size={19}/> : <FileText size={19}/>}</span><div><strong>{finding.title}</strong><p>{finding.detail}</p>{finding.evidence.length > 0 && <small>Compared: {finding.evidence.join(" · ")}</small>}</div><span className="finding-tag">{finding.kind === "review" ? "Review" : "More data"}</span></div>; }

function BillsView({ data, go, reload }: { data: Overview; go: (view: View) => void; reload: () => Promise<void> }) {
  const [working, setWorking] = useState<string | null>(null);
  async function remove(id: string) { if (!confirm("Delete this bill, its payment entries and attached evidence?")) return; setWorking(id); try { await requestJson(`/api/bills/${id}`, { method: "DELETE" }); await reload(); } catch (cause) { alert(cause instanceof Error ? cause.message : "Could not delete bill"); } finally { setWorking(null); } }
  return <><PageHead eyebrow="BILLS & FINDINGS" title="A record you can trust." description="Confirmed bill values and the checks they support, in one place." action={<button className="button button-primary" onClick={() => go("add")}><Plus size={18}/> Add a bill</button>}/><div className="info-strip"><ShieldCheck size={19}/><span>These checks flag differences for your review. They cannot confirm a utility error or payment posting.</span></div>{!data.bills.length ? <div className="card"><Empty icon={FilePlus2} title="No bills added yet" text="Upload a LESCO bill and confirm its fields to start your household record." action={<button className="button button-primary" onClick={() => go("add")}>Add a bill <ArrowRight size={17}/></button>}/></div> : <div className="bill-list">{data.bills.map((bill) => <article className="card bill-card" key={bill.id}><div className="bill-card-head"><div><span className="bill-icon"><FileText size={22}/></span><span><small>LESCO · {month(bill.billMonth)}</small><h2>{money(bill.totalAmount)}</h2></span></div><span className="pill">{bill.billedUnits ?? "—"} kWh</span></div><div className="bill-meta"><span>Reference ending {bill.referenceNumber.slice(-4)}</span><span>Due {bill.dueDate ?? "not entered"}</span><span>{bill.ocrStatus === "manual" ? "Entered manually" : bill.ocrStatus === "failed" ? "OCR unavailable · user reviewed" : "OCR hints · user reviewed"}</span></div><div className="bill-checks">{data.findings.filter((finding) => finding.billId === bill.id).map((finding) => <FindingRow key={finding.id} finding={finding}/>)}</div><div className="bill-actions">{bill.evidenceFileId && <a href={`/api/files/${bill.evidenceFileId}`} className="text-button">Download original <ArrowUpRight size={15}/></a>}<button className="text-button danger" disabled={working === bill.id} onClick={() => void remove(bill.id)}><Trash2 size={15}/> Delete bill</button></div></article>)}</div>}</>;
}

function BillEntry({ go, reload }: { go: (view: View) => void; reload: () => Promise<void> }) {
  const [draft, setDraft] = useState<BillDraft>(blank);
  const [sources, setSources] = useState<Record<string, "ocr" | "user">>({});
  const [evidenceFileId, setEvidenceFileId] = useState<string | null>(null);
  const [ocrStatus, setOcrStatus] = useState<"manual" | "extracted" | "failed">("manual");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  function change(key: keyof BillDraft, value: string) { setDraft((old) => ({ ...old, [key]: value })); setSources((old) => ({ ...old, [key]: "user" })); }
  async function upload(file: File) {
    setBusy(true); setError(""); setNotice("");
    try {
      const body = new FormData(); body.set("kind", "bill"); body.set("file", file);
      const result = await requestJson<{ evidenceFileId: string; fields: Record<string,string>; ocrStatus: "extracted" | "failed" }>("/api/upload", { method: "POST", body });
      if (evidenceFileId) await requestJson(`/api/files/${evidenceFileId}`, { method: "DELETE" });
      setEvidenceFileId(result.evidenceFileId); setOcrStatus(result.ocrStatus);
      const map: Record<string, keyof BillDraft> = { reference_number: "referenceNumber", previous_reading: "previousReading", current_reading: "currentReading", billed_units: "billedUnits", total_amount: "totalAmount" };
      const next: Partial<BillDraft> = {}; const extracted: Record<string, "ocr"> = {};
      for (const [raw, target] of Object.entries(map)) if (result.fields[raw]) { next[target] = result.fields[raw]; extracted[target] = "ocr"; }
      setDraft((old) => ({ ...old, ...next })); setSources((old) => ({ ...old, ...extracted }));
      setNotice(result.ocrStatus === "failed" ? "Local OCR could not read this file. The original is saved; enter the bill fields below." : Object.keys(next).length ? "Possible values were filled from local OCR. Check every field against your bill before saving." : "The document was read, but no supported fields were found. Enter the bill fields manually.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed"); } finally { setBusy(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      await requestJson("/api/bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidenceFileId, referenceNumber: draft.referenceNumber, billMonth: `${draft.billMonth}-01`, previousReading: draft.previousReading === "" ? null : Number(draft.previousReading), currentReading: draft.currentReading === "" ? null : Number(draft.currentReading), multiplier: Number(draft.multiplier), billedUnits: draft.billedUnits === "" ? null : Number(draft.billedUnits), totalAmount: Number(draft.totalAmount), dueDate: draft.dueDate || null, fieldSources: sources, ocrStatus }) });
      await reload(); go("bills");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save bill"); setBusy(false); }
  }
  async function cancel() { if (evidenceFileId) { try { await requestJson(`/api/files/${evidenceFileId}`, { method: "DELETE" }); } catch { /* Keep the private file if cleanup fails. */ } } go("bills"); }
  return <><PageHead eyebrow="ADD A BILL" title="Let's read this together." description="Upload your LESCO bill, then confirm the figures before any checks run."/><div className="entry-grid"><section className="card upload-card"><span className="eyebrow">STEP 01 · DOCUMENT</span><h2>Upload your bill</h2><p>PDF, PNG or JPEG, up to 8 MB. Local OCR gives hints; you make the final call.</p><label className="dropzone"><UploadCloud size={31}/><strong>{evidenceFileId ? "Bill uploaded" : "Choose a bill file"}</strong><span>{evidenceFileId ? "You can select another file if needed." : "Select a PDF or image from your device"}</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" disabled={busy} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/></label><div className="upload-note"><ShieldCheck size={17}/> Files stay private to your household. No external AI call.</div></section><section className="card review-card"><span className="eyebrow">STEP 02 · REVIEW</span><h2>Confirm the details</h2><p>All checks use these saved values. Fields marked “OCR hint” still need your review.</p>{notice && <div className="info-strip compact"><CircleAlert size={18}/>{notice}</div>}{error && <p className="form-error" role="alert">{error}</p>}<form onSubmit={save} className="bill-form"><div className="form-grid"><Field label="Reference number" hint={sources.referenceNumber} required><input value={draft.referenceNumber} onChange={(e) => change("referenceNumber", e.target.value)} inputMode="numeric" pattern="[0-9]{14}" maxLength={14} required placeholder="14 digits"/></Field><Field label="Bill month" required><input type="month" value={draft.billMonth} onChange={(e) => change("billMonth", e.target.value)} required/></Field><Field label="Previous reading" hint={sources.previousReading}><input type="number" min="0" step="0.01" value={draft.previousReading} onChange={(e) => change("previousReading", e.target.value)} placeholder="Optional"/></Field><Field label="Current reading" hint={sources.currentReading}><input type="number" min="0" step="0.01" value={draft.currentReading} onChange={(e) => change("currentReading", e.target.value)} placeholder="Optional"/></Field><Field label="Meter multiplier" required><input type="number" min="0.001" step="0.001" value={draft.multiplier} onChange={(e) => change("multiplier", e.target.value)} required/></Field><Field label="Billed units (kWh)" hint={sources.billedUnits}><input type="number" min="0" step="0.01" value={draft.billedUnits} onChange={(e) => change("billedUnits", e.target.value)} placeholder="Optional"/></Field><Field label="Total amount (PKR)" hint={sources.totalAmount} required><input type="number" min="0" step="0.01" value={draft.totalAmount} onChange={(e) => change("totalAmount", e.target.value)} required/></Field><Field label="Due date"><input type="date" value={draft.dueDate} onChange={(e) => change("dueDate", e.target.value)}/></Field></div><div className="form-actions"><button type="button" className="button button-outline" onClick={() => void cancel()}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? "Working…" : "Save & check bill"}<ArrowRight size={18}/></button></div></form></section></div></>;
}

function Field({ label, hint, required, children }: { label: string; hint?: "ocr" | "user"; required?: boolean; children: React.ReactNode }) { return <label className="field"><span>{label}{required && <b> *</b>}{hint && <small>{hint === "ocr" ? "OCR hint" : "Edited"}</small>}</span>{children}</label>; }

function ReadingsView({ data, reload }: { data: Overview; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = event.currentTarget; const values = new FormData(form); try { await requestJson("/api/readings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ readingDate: values.get("readingDate"), readingValue: Number(values.get("readingValue")), note: values.get("note") }) }); form.reset(); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save reading"); } finally { setBusy(false); } }
  return <><PageHead eyebrow="METER READINGS" title="Keep your own record." description="A dated meter log helps you compare what you observed with future bills."/><div className="split-grid"><section className="card"><span className="eyebrow">NEW READING</span><h2>Add meter reading</h2><p className="muted">Enter the number shown on your meter. This is your own record, not live meter data.</p><form className="stack-form" onSubmit={save}><label>Date<input type="date" name="readingDate" required/></label><label>Meter reading<input type="number" min="0" step="0.01" name="readingValue" required placeholder="e.g. 12845"/></label><label>Note (optional)<input name="note" maxLength={300} placeholder="e.g. photo taken in the evening"/></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}><Plus size={17}/> Save reading</button></form></section><section className="card"><span className="eyebrow">YOUR LOG</span><h2>Reading history</h2>{data.readings.length ? <div className="simple-list">{data.readings.map((reading) => <div key={reading.id}><span className="round-icon"><Gauge size={18}/></span><span><strong>{reading.readingValue}</strong><small>{reading.readingDate}{reading.note ? ` · ${reading.note}` : ""}</small></span></div>)}</div> : <Empty icon={Gauge} title="No readings yet" text="Add a dated reading to start your own meter log."/>}</section></div></>;
}

function PaymentsView({ data, reload }: { data: Overview; reload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [receiptId, setReceiptId] = useState<string | null>(null);
  async function upload(file: File) { setBusy(true); setError(""); try { const body = new FormData(); body.set("kind", "receipt"); body.set("file", file); const result = await requestJson<{ evidenceFileId: string }>("/api/upload", { method: "POST", body }); setReceiptId(result.evidenceFileId); } catch (cause) { setError(cause instanceof Error ? cause.message : "Upload failed"); } finally { setBusy(false); } }
  async function save(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setBusy(true); setError(""); const form = event.currentTarget; const values = new FormData(form); try { await requestJson("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId: values.get("billId"), evidenceFileId: receiptId, amount: Number(values.get("amount")), paidAt: values.get("paidAt"), channel: values.get("channel"), reference: values.get("reference") }) }); form.reset(); setReceiptId(null); await reload(); } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save payment record"); } finally { setBusy(false); } }
  return <><PageHead eyebrow="PAYMENT RECORDS" title="Keep receipts close." description="Compare what you recorded paying with the bill amount. Posting with LESCO is not verified."/><div className="split-grid"><section className="card"><span className="eyebrow">NEW RECORD</span><h2>Add payment receipt</h2>{data.bills.length ? <form className="stack-form" onSubmit={save}><label>Bill<select name="billId" required>{data.bills.map((bill) => <option key={bill.id} value={bill.id}>{month(bill.billMonth)} · ending {bill.referenceNumber.slice(-4)} · {money(bill.totalAmount)}</option>)}</select></label><label>Amount paid (PKR)<input type="number" min="0.01" step="0.01" name="amount" required/></label><label>Payment date<input type="date" name="paidAt" required/></label><label>Channel<input name="channel" maxLength={80} required placeholder="Bank, wallet, counter…"/></label><label>Transaction reference (optional)<input name="reference" maxLength={120}/></label><label className="file-input">Receipt image or PDF (optional)<input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" disabled={busy} onChange={(e) => { const file = e.target.files?.[0]; if (file) void upload(file); }}/>{receiptId && <small>Receipt uploaded</small>}</label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button button-primary" disabled={busy}><Plus size={17}/> Save record</button></form> : <Empty icon={ReceiptText} title="Add a bill first" text="A payment record must be connected to one of your saved bills."/>}</section><section className="card"><span className="eyebrow">YOUR RECORDS</span><h2>Receipt history</h2>{data.payments.length ? <div className="simple-list">{data.payments.map((payment) => <div key={payment.id}><span className="round-icon"><Wallet size={18}/></span><span><strong>{money(payment.amount)}</strong><small>{payment.paidAt} · {payment.channel}</small>{payment.evidenceFileId && <a href={`/api/files/${payment.evidenceFileId}`}>Download receipt</a>}</span></div>)}</div> : <Empty icon={Wallet} title="No receipts added" text="Keep an amount, date, and optional receipt next to each bill."/>}</section></div></>;
}

function SettingsView({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function destroy() { if (!confirm("Permanently delete your account, household data and uploaded files? This cannot be undone.")) return; setBusy(true); try { await requestJson("/api/household", { method: "DELETE" }); router.push("/login"); router.refresh(); } catch (error) { alert(error instanceof Error ? error.message : "Could not delete account"); setBusy(false); } }
  return <><PageHead eyebrow="SETTINGS" title="Your household data." description="Control your private workspace and understand the limits of its analysis."/><div className="split-grid"><section className="card"><span className="eyebrow">ACCOUNT</span><h2>Signed in as</h2><p className="account-email">{email}</p><div className="settings-row"><CalendarDays size={20}/><span><strong>Initial utility</strong><small>LESCO domestic bills · format extraction unverified until redacted samples are tested</small></span></div><div className="settings-row"><ShieldCheck size={20}/><span><strong>Local OCR</strong><small>Documents are processed by the internal OCR service, not an external model.</small></span></div></section><section className="card danger-card"><span className="eyebrow">DATA CONTROL</span><h2>Delete household</h2><p>Remove your account, bill records, readings, payment records and uploaded documents.</p><button className="button button-danger" onClick={() => void destroy()} disabled={busy}><Trash2 size={17}/>{busy ? "Deleting…" : "Delete account and data"}</button></section></div></>;
}
