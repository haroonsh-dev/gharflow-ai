"use client";
import { t } from "@/lib/copy";
import {
  useCallback,
  useEffect,
  useState,
  useRef,
  useSyncExternalStore,
  type FormEvent,
} from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  ScanLine,
  CircleAlert,
  Layers,
  GitCompareArrows,
  ArrowRight,
  Zap as Bolt,
  Sun,
  Globe,
  ChevronRight,
  FileText,
  Gauge,
  House,
  LogOut,
  Menu,
  Plus,
  ShieldCheck,
  Wallet,
  X,
  FolderOpen,
} from "lucide-react";
import { guidance, type InvestigationAction } from "@/lib/guidance";
import { consumptionPlan, type Finding } from "@/lib/findings";
import { identifyDisco } from "@/lib/online-bill";
import { isPtclAccountId } from "@/lib/ptcl";
import type { Extraction } from "@/lib/schemas";
import type { Bill, Overview } from "@/lib/types";
import {
  api,
  json,
  money,
  month,
  PageHead,
  Field,
  Empty,
  FindingRow,
  Confirmation,
} from "./components/ui";
import BillEntry from "./components/bill-entry";
import CasesView from "./components/cases-view";
import EvidenceGuide from "./components/evidence-guide";
import InvestigationView from "./components/investigation-view";
import RecordHistory from "./components/record-history";
import RecordEditor, { type EditableRecord } from "./components/record-editor";
import AIInvestigator from "./components/ai-investigator";
import ApplianceSimulator from "./components/appliance-simulator";
import SolarAuditor from "./components/solar-auditor";
import OnlineFetcher from "./components/online-fetcher";
import WhatsAppDispatcher from "./components/whatsapp-dispatcher";
type View =
  | "investigation"
  | "overview"
  | "bills"
  | "appliances"
  | "solar"
  | "add"
  | "cases"
  | "readings"
  | "payments"
  | "documents"
  | "settings";
const navigation = [
  { key: "overview", label: t("Overview"), icon: House },
  { key: "bills", label: t("Bills & findings"), icon: FileText },
  {
    key: "investigation",
    label: t("Investigate bills"),
    icon: GitCompareArrows,
  },
  { key: "appliances", label: t("Appliance load simulator"), icon: Bolt },
  { key: "solar", label: t("Solar & green meter"), icon: Sun },
  { key: "cases", label: t("Tracked cases"), icon: FolderOpen },
  { key: "readings", label: t("Meter readings"), icon: Gauge },
  { key: "payments", label: t("Payment records"), icon: Wallet },
  { key: "documents", label: t("Documents"), icon: FileText },
  { key: "settings", label: t("Settings"), icon: ShieldCheck },
] as const;
const subscribeNarrow = (callback: () => void) => {
  const query = window.matchMedia("(max-width:760px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const narrowSnapshot = () => window.matchMedia("(max-width:760px)").matches;
export default function Dashboard() {
  const narrow = useSyncExternalStore(
    subscribeNarrow,
    narrowSnapshot,
    () => false,
  );
  const closeMenu = useRef<HTMLButtonElement>(null);
  const openMenu = useRef<HTMLButtonElement>(null);
  const menuWasOpen = useRef(false);
  const router = useRouter();
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [mobile, setMobile] = useState(false);
  const [connection, setConnection] = useState("");
  const [editing, setEditing] = useState<Bill | null>(null);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [targetBill, setTargetBill] = useState<Bill | null>(null);
  const [source, setSource] = useState<{
    id?: string;
    extraction?: Extraction | null;
    draft?: Partial<Record<string, string>>;
  }>();
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [pendingView, setPendingView] = useState<View | null>(null);
  const [processing, setProcessing] = useState(false);
  function applyOnlineData(fetched: {
    referenceNumber: string;
    billedUnits?: number;
    totalAmount?: number;
    readingDate?: string;
    dueDate?: string;
    meterIdentity?: string;
  }) {
    setEditing(null);
    setSource({
      draft: {
        referenceNumber: fetched.referenceNumber,
        billedUnits:
          fetched.billedUnits != null ? String(fetched.billedUnits) : "",
        totalAmount:
          fetched.totalAmount != null ? String(fetched.totalAmount) : "",
        readingDate: fetched.readingDate ?? "",
        dueDate: fetched.dueDate ?? "",
        meterIdentity: fetched.meterIdentity ?? "",
      },
    });
    go("add");
  }
  useEffect(() => {
    if (mobile) {
      menuWasOpen.current = true;
      closeMenu.current?.focus();
      const onKey = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          setMobile(false);
        }
      };
      window.addEventListener("keydown", onKey);
      return () => window.removeEventListener("keydown", onKey);
    }
    if (menuWasOpen.current) {
      menuWasOpen.current = false;
      openMenu.current?.focus();
    }
  }, [mobile]);
  const load = useCallback(async () => {
    setData(await api<Overview>("/api/overview"));
  }, []);
  useEffect(() => {
    void api<Overview>("/api/overview")
      .then(setData)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : t("Could not load workspace"),
        ),
      );
  }, []);
  function go(next: View) {
    if (pendingUpload && next !== view) {
      setPendingView(next);
      return;
    }
    setView(next);
    setMobile(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  async function logout() {
    try {
      await api("/api/auth/logout", { method: "POST" });
      router.push("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Sign out failed"));
    }
  }
  async function openCase(finding: Finding) {
    try {
      const opened = await api<{ id: string }>(
        "/api/cases",
        json({ findingId: finding.id }),
      );
      setSelectedCase(opened.id);
      await load();
      go("cases");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not open case"),
      );
    }
  }
  const connections = [
    ...new Set(
      data?.bills
        .map((bill) => bill.referenceNumber)
        .concat(
          data?.readings
            .map((reading) => reading.referenceNumber)
            .filter((value): value is string => !!value) ?? [],
        ) ?? [],
    ),
  ];
  const reference = connections.includes(connection)
    ? connection
    : (connections[0] ?? "");
  const active =
    data?.bills.filter(
      (bill) => !bill.supersededById && bill.referenceNumber === reference,
    ) ?? [];
  function add() {
    setEditing(null);
    setSource(undefined);
    go("add");
  }
  function act(finding: Finding, action: InvestigationAction) {
    const bill = data?.bills.find(
      (item) => item.id === (action.billId ?? finding.billId),
    );
    if (!bill) return;
    setConnection(bill.referenceNumber);
    setTargetBill(bill);
    if (action.kind === "bill") {
      setEditing(bill);
      setSource(undefined);
      go("add");
    } else if (action.kind === "reading") go("readings");
    else if (action.kind === "payment") go("payments");
    else if (action.kind === "previousBill") {
      const date = new Date(`${bill.billMonth}T00:00:00Z`);
      date.setUTCMonth(date.getUTCMonth() - 1);
      setEditing(null);
      setSource({
        draft: {
          referenceNumber: bill.referenceNumber,
          billMonth: date.toISOString().slice(0, 7),
          meterIdentity: bill.meterIdentity ?? "",
        },
      });
      go("add");
    } else void openCase(finding);
  }
  async function discardAndGo() {
    try {
      if (pendingUpload)
        await api(`/api/files/${pendingUpload}`, { method: "DELETE" });
      setPendingUpload(null);
      const next = pendingView;
      setPendingView(null);
      if (next) {
        setView(next);
        setMobile(false);
      }
      await load();
    } catch {
      setError(
        t("Could not remove the unused upload. Stay on this form and retry."),
      );
      setPendingView(null);
    }
  }
  return (
    <div className="app-shell">
      <aside
        inert={narrow && !mobile}
        aria-hidden={narrow && !mobile ? true : undefined}
        className={`sidebar ${mobile ? "sidebar-open" : ""}`}
      >
        <div className="sidebar-top">
          <div className="brand">
            <span className="brand-mark">
              <Bolt size={21} />
            </span>
            <span>
              {t("GharFlow")}
              <b>{t("AI")}</b>
            </span>
          </div>
          <button
            ref={closeMenu}
            className="icon-button mobile-close"
            aria-label={t("Close menu")}
            onClick={() => setMobile(false)}
          >
            <X size={20} />
          </button>
        </div>
        <div className="workspace-chip">
          <span className="workspace-avatar">{data?.isDemo ? "D" : "H"}</span>
          <span>
            <strong>
              {data?.isDemo ? t("Synthetic demo") : t("My household")}
            </strong>
            <small>{t("Utility & Telecom Intelligence")}</small>
          </span>
        </div>
        <span className="sidebar-caption">{t("WORKSPACE")}</span>
        <nav aria-label={t("Main navigation")}>
          {navigation.map((item) => (
            <button
              disabled={view === "add" || processing}
              key={item.key}
              aria-current={view === item.key ? "page" : undefined}
              className={`nav-item ${view === item.key ? "active" : ""}`}
              onClick={() => go(item.key)}
            >
              <item.icon size={19} />
              {item.label}
              {view === item.key && (
                <ChevronRight size={16} className="nav-chevron" />
              )}
            </button>
          ))}
        </nav>
        <button
          className="sidebar-upload"
          disabled={view === "add" || processing}
          onClick={add}
        >
          <Plus size={18} />
          {t("Upload a bill")}
        </button>
        <div className="sidebar-bottom">
          <div className="sidebar-tip">
            <ShieldCheck size={20} />
            <strong>{t("Evidence before conclusions")}</strong>
            <p>
              {t(
                "Source values, clear calculations, and uncertainty you can inspect.",
              )}
            </p>
          </div>
          <button
            className="nav-item"
            disabled={view === "add" || processing}
            onClick={() => void logout()}
          >
            <LogOut size={18} />
            {t("Sign out")}
          </button>
        </div>
      </aside>
      {mobile && (
        <button
          className="sidebar-backdrop"
          aria-label={t("Close menu")}
          onClick={() => setMobile(false)}
        />
      )}
      <div className="main-wrap" inert={narrow && mobile}>
        <header className="topbar">
          <button
            ref={openMenu}
            className="icon-button mobile-menu"
            aria-label={t("Open menu")}
            onClick={() => setMobile(true)}
          >
            <Menu size={22} />
          </button>
          <span className="breadcrumb">
            {t("Household")}
            <ChevronRight size={15} />
            <strong>
              {view === "add"
                ? t("Evidence review")
                : navigation.find((item) => item.key === view)?.label}
            </strong>
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              className="pill"
              style={{
                background: "rgba(16, 185, 129, 0.08)",
                borderColor: "rgba(16, 185, 129, 0.25)",
                color: "#34d399",
                fontSize: "11px",
              }}
            >
              <span className="coverage-dot" />
              {t("NEPRA & PTA Engines Active")}
            </span>
            <span className="topbar-right">
              <ShieldCheck size={15} style={{ color: "#38bdf8" }} />
              {t("Private workspace")}
            </span>
          </div>
        </header>
        <main className="content">
          {data?.isDemo && (
            <div className="demo-banner">
              <strong>{t("SYNTHETIC DEMO")}</strong>{" "}
              {t(
                "· These documents and readings are fictional, separate from real household records.",
              )}
            </div>
          )}
          {error && (
            <div className="alert-error" role="alert">
              {error}
              <button
                onClick={() => {
                  void load()
                    .then(() => setError(""))
                    .catch((cause: unknown) =>
                      setError(
                        cause instanceof Error
                          ? cause.message
                          : t("Loading failed"),
                      ),
                    );
                }}
              >
                {t("Retry")}
              </button>
            </div>
          )}
          {!data ? (
            <div className="loading-card" role="status">
              {t("Loading your evidence workspace…")}
            </div>
          ) : (
            <>
              {view !== "add" && connections.length > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap", marginBottom: "20px" }}>
                  <label className="connection-switch" style={{ margin: 0 }}>
                    {t("Active connection")}
                    <select
                      value={reference}
                      onChange={(event) => {
                        setConnection(event.target.value);
                        setTargetBill(null);
                      }}
                    >
                      {connections.map((value) => {
                        const disco = identifyDisco(value);
                        const isPtcl = isPtclAccountId(value);
                        const label = isPtcl
                          ? `PTCL · Account ending ${value.slice(-4)}`
                          : disco
                            ? `${disco.name} · Ending ${value.slice(-4)}`
                            : `Connection ending ${value.slice(-4)}`;
                        return (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        );
                      })}
                    </select>
                  </label>
                  <span
                    className="pill"
                    style={{
                      background: isPtclAccountId(reference)
                        ? "rgba(139, 92, 246, 0.12)"
                        : "rgba(6, 182, 212, 0.12)",
                      borderColor: isPtclAccountId(reference)
                        ? "rgba(139, 92, 246, 0.3)"
                        : "rgba(6, 182, 212, 0.3)",
                      color: isPtclAccountId(reference) ? "#c084fc" : "#22d3ee",
                    }}
                  >
                    {isPtclAccountId(reference)
                      ? t("☎️ PTCL Telecom Account")
                      : t("⚡ Electricity Tariff Connection")}
                  </span>
                </div>
              )}
              {view === "overview" && (
                <OverviewView
                  data={data}
                  bills={active}
                  reference={reference}
                  onAdd={add}
                  go={go}
                  act={act}
                  openCase={openCase}
                  onApplyOnline={applyOnlineData}
                />
              )}
              {view === "appliances" && (
                <>
                  <PageHead
                    eyebrow={t("APPLIANCE FORENSICS")}
                    title={t("Slab Killer Simulator & Load Modeling")}
                    description={t(
                      "Interactive load simulator for Pakistani domestic appliances. Test runtime hours, calculate progressive tariff slabs, and see exactly which appliance pushes you into unprotected rates.",
                    )}
                  />
                  <ApplianceSimulator />
                </>
              )}
              {view === "solar" && (
                <>
                  <PageHead
                    eyebrow={t("SOLAR INTELLIGENCE")}
                    title={t("Green Meter Net-Metering Auditor")}
                    description={t(
                      "Audit bi-directional import and export units under NEPRA Net Metering Regulations (2015). Detect uncredited buyback generation and calculate peak off-peak net financial balances.",
                    )}
                  />
                  <SolarAuditor />
                </>
              )}
              {view === "investigation" && (
                <InvestigationView
                  key={reference}
                  data={data}
                  reference={reference}
                  onInspect={(bill) => {
                    setEditing(bill);
                    setSource(undefined);
                    go("add");
                  }}
                  onAdd={(billMonth) => {
                    setEditing(null);
                    setSource(
                      billMonth
                        ? {
                            draft: {
                              referenceNumber: reference,
                              billMonth: billMonth.slice(0, 7),
                            },
                          }
                        : undefined,
                    );
                    go("add");
                  }}
                  onCase={openCase}
                />
              )}
              {view === "bills" && (
                <BillsView
                  data={data}
                  reference={reference}
                  onAdd={add}
                  onEdit={(bill) => {
                    setEditing(bill);
                    go("add");
                  }}
                  openCase={openCase}
                  reload={load}
                  act={act}
                  onApplyOnline={applyOnlineData}
                />
              )}
              {view === "add" && (
                <BillEntry
                  key={editing?.id ?? "new"}
                  bill={editing}
                  source={source}
                  bills={data.bills}
                  reload={load}
                  onDone={() => go("bills")}
                />
              )}{" "}
              {view === "cases" && (
                <CasesView
                  data={data}
                  selectedId={selectedCase}
                  reload={load}
                />
              )}{" "}
              {view === "readings" && (
                <ReadingsView
                  key={targetBill?.id ?? reference}
                  data={data}
                  reference={reference}
                  targetBill={targetBill}
                  reload={load}
                  onEvidence={setPendingUpload}
                  onBusy={setProcessing}
                  afterSave={() => {
                    if (targetBill) {
                      setView("bills");
                      window.scrollTo({ top: 0 });
                    }
                  }}
                />
              )}{" "}
              {view === "payments" && (
                <PaymentsView
                  key={targetBill?.id ?? reference}
                  data={data}
                  bills={active}
                  reference={reference}
                  targetBill={targetBill}
                  reload={load}
                  onEvidence={setPendingUpload}
                  onBusy={setProcessing}
                  afterSave={() => {
                    if (targetBill) {
                      setView("bills");
                      window.scrollTo({ top: 0 });
                    }
                  }}
                />
              )}{" "}
              {view === "documents" && (
                <DocumentsView
                  data={data}
                  reload={load}
                  onReview={(id) => {
                    setEditing(null);
                    setSource({
                      id,
                      extraction: data.evidence.find((file) => file.id === id)
                        ?.extraction,
                    });
                    go("add");
                  }}
                />
              )}{" "}
              {view === "settings" && (
                <SettingsView data={data} reload={load} />
              )}
            </>
          )}
        </main>
        {pendingView && (
          <Confirmation
            title={t("Discard the unused upload?")}
            description={t(
              "The uploaded document has not been attached to a saved record. It will be removed before changing sections.",
            )}
            busy={processing}
            onCancel={() => setPendingView(null)}
            onConfirm={() => void discardAndGo()}
          />
        )}
      </div>
    </div>
  );
}
function OverviewView({
  data,
  bills,
  reference,
  onAdd,
  go,
  act,
  openCase,
  onApplyOnline,
}: {
  data: Overview;
  bills: Bill[];
  reference: string;
  onAdd: () => void;
  go: (view: View) => void;
  act: (finding: Finding, action: InvestigationAction) => void;
  openCase: (finding: Finding) => Promise<void>;
  onApplyOnline?: (fetched: {
    referenceNumber: string;
    billedUnits?: number;
    totalAmount?: number;
    readingDate?: string;
    dueDate?: string;
    meterIdentity?: string;
  }) => void;
}) {
  const latest = bills[0];
  const connectionCases = data.cases.filter(
    (item) =>
      !reference ||
      item.snapshot.bills.some((bill) => bill.referenceNumber === reference),
  );
  const findings = data.findings.filter((finding) =>
    bills.some((bill) => bill.id === finding.billId),
  );
  const review = findings.filter((finding) => finding.kind === "review");
  const missing = findings.filter((finding) => finding.kind === "info");
  const [reduction, setReduction] = useState(10);
  const [meter, setMeter] = useState("");
  const meters = [
    ...new Set(
      data.readings
        .filter(
          (reading) =>
            reading.referenceNumber === reference && reading.meterIdentity,
        )
        .map((reading) => reading.meterIdentity as string),
    ),
  ];
  const selected = meters.includes(meter) ? meter : (meters[0] ?? "");
  const plan = consumptionPlan(data.readings, reference, selected, reduction);
  const next = !latest
    ? {
        title: t("Add your first source document"),
        detail: t("Start with a bill, then confirm its fields."),
        action: onAdd,
        label: t("Add a bill"),
      }
    : review.length
      ? {
          title: `${review.length} finding${review.length === 1 ? "" : "s"} to investigate`,
          detail: t(
            "Inspect the compared values, then open a case to preserve the evidence.",
          ),
          action: () => go("investigation"),
          label: t("Investigate bills"),
        }
      : {
          title: t("Strengthen the evidence"),
          detail: missing.length
            ? "Some comparisons need dates, meter identity, or confirmed reading status."
            : "Add dated observations and consecutive bills to keep the record useful.",
          action: () => go("readings"),
          label: t("Add meter evidence"),
        };
  return (
    <>
      <PageHead
        eyebrow={t("HOUSEHOLD EVIDENCE")}
        title={t("Your energy, in focus.")}
        description={t(
          "From a bill to a clear next step. All your evidence, together.",
        )}
        action={
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={18} />
            {t("Add a bill")}
          </button>
        }
      />
      <section className="focus-banner">
        <div>
          <span className="hero-kicker">
            <Activity size={16} />
            {t("NEXT USEFUL ACTION")}
          </span>
          <h2>{next.title}</h2>
          <p>{next.detail}</p>
          <button className="button" onClick={next.action}>
            {next.label}
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="focus-evidence">
          <ScanLine size={28} />
          <span>{t("LOCAL OCR + GROUNDED AI REVIEW")}</span>
          <strong>{t("You stay in control.")}</strong>
          <p>
            {t(
              "Inspect the source. Confirm the values. Decide what happens next.",
            )}
          </p>
        </div>
      </section>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", marginTop: "20px", marginBottom: "20px" }}>
        <div
          style={{
            padding: "20px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(37,99,235,0.06) 0%, rgba(2,132,199,0.02) 100%)",
            border: "1px solid rgba(37,99,235,0.2)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "#2563eb", marginBottom: "4px", display: "inline-block" }}>
              ⚡ {t("APPLIANCE FORENSICS")}
            </span>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700 }}>
              {t("Slab Killer & Load Simulator")}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-secondary)" }}>
              {t("Model Inverter ACs, geysers, motors & UPS charging. Find out which appliance pushes you into unprotected slabs.")}
            </p>
          </div>
          <button className="button button-outline" onClick={() => go("appliances")} style={{ alignSelf: "flex-start" }}>
            {t("Launch Simulator")}
            <ArrowRight size={15} />
          </button>
        </div>

        <div
          style={{
            padding: "20px",
            borderRadius: "14px",
            background: "linear-gradient(135deg, rgba(217,119,6,0.06) 0%, rgba(245,158,11,0.02) 100%)",
            border: "1px solid rgba(217,119,6,0.2)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            gap: "14px",
          }}
        >
          <div>
            <span className="eyebrow" style={{ color: "#d97706", marginBottom: "4px", display: "inline-block" }}>
              ☀️ {t("GREEN METER")}
            </span>
            <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700 }}>
              {t("Solar Net-Metering Auditor")}
            </h3>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--ink-secondary)" }}>
              {t("Verify bi-directional import/export credits and detect uncredited buyback generation under NEPRA 2015 rules.")}
            </p>
          </div>
          <button className="button button-outline" onClick={() => go("solar")} style={{ alignSelf: "flex-start" }}>
            {t("Audit Solar Credits")}
            <ArrowRight size={15} />
          </button>
        </div>
      </div>

      <OnlineFetcher initialReference={reference} onApplyData={onApplyOnline} />
      <div className="metric-grid">
        <Metric
          icon="bill"
          label={t("Latest bill")}
          value={latest ? money(latest.totalAmount) : "—"}
          note={latest ? month(latest.billMonth) : t("No bill saved")}
        />
        <Metric
          icon="usage"
          label={t("Billed consumption")}
          value={
            latest?.billedUnits != null ? `${latest.billedUnits} kWh` : "—"
          }
          note={t("From the latest confirmed bill")}
        />
        <Metric
          icon="review"
          label={t("Needs a closer look")}
          value={String(review.length)}
          note={`${missing.length} ${t("checks need more evidence")}`}
        />
        <Metric
          icon="case"
          label={t("Open investigations")}
          value={String(
            connectionCases.filter(
              (item) =>
                item.status === "open" || item.status === "awaiting_response",
            ).length,
          )}
          note={t("Outcomes remain user reported")}
        />
      </div>
      <section className="journey-card" aria-label={t("Your evidence journey")}>
        {[
          {
            label: "Collect",
            detail: `${bills.length} ${t("active bills")}`,
            done: bills.length > 0,
            action: onAdd,
          },
          {
            label: "Confirm",
            detail: "Inspect source values",
            done: bills.some((bill) => !!bill.confirmedAt),
            action: () => go("bills"),
          },
          {
            label: "Investigate",
            detail: `${review.length} ${t("review findings")}`,
            done: review.length > 0,
            action: () => go("bills"),
          },
          {
            label: "Keep a record",
            detail: "Cases & PDF reports",
            done: connectionCases.length > 0,
            action: () => go("cases"),
          },
        ].map((step, index) => (
          <button key={step.label} onClick={step.action}>
            <span className={`journey-marker ${step.done ? "recorded" : ""}`}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>
              <strong>{t(step.label)}</strong>
              <small>{t(step.detail)}</small>
            </span>
            <ChevronRight size={16} />
          </button>
        ))}
      </section>
      {data.evidence.some((file) => file.unattached) && (
        <button className="resume-evidence" onClick={() => go("documents")}>
          <FileText size={20} />
          <span>
            <strong>{t("You have unfinished document reviews")}</strong>
            <small>
              {t("Continue with the original file you already uploaded.")}
            </small>
          </span>
          <ArrowRight size={19} />
        </button>
      )}
      <EvidenceGuide
        findings={findings}
        hasBills={bills.length > 0}
        onAction={act}
        onAdd={onAdd}
      />
      <div className="dashboard-grid">
        <section className="card">
          <div className="section-heading">
            <div>
              <span className="eyebrow">{t("THIS CONNECTION")}</span>
              <h2>{t("Billed usage history")}</h2>
            </div>
            <span className="pill">{t("kWh")}</span>
          </div>
          <Trend bills={bills} />
        </section>
        <section className="card savings-card">
          <span className="eyebrow">{t("CONSUMPTION TARGET")}</span>
          <h2>{t("Plan in kWh, using observations.")}</h2>
          <p>
            {t(
              "Estimate daily use from two compatible dated readings. No tariff or money estimate.",
            )}
          </p>
          {meters.length > 0 && (
            <Field label={t("Meter identity")}>
              <select
                value={selected}
                onChange={(event) => setMeter(event.target.value)}
              >
                {meters.map((value) => (
                  <option key={value}>{value}</option>
                ))}
              </select>
            </Field>
          )}
          <label className="range-label" htmlFor="reduction">
            {t("Reduction target")}
            <strong>{reduction}%</strong>
          </label>
          <input
            id="reduction"
            type="range"
            min={0}
            max={50}
            step={5}
            value={reduction}
            onChange={(event) => setReduction(Number(event.target.value))}
          />
          {plan ? (
            <div className="savings-result">
              <small>{t("Observed daily average")}</small>
              <strong>
                {plan.dailyKwh.toFixed(2)} {t("kWh/day")}
              </strong>
              <small>
                {t("Target")}
                {plan.targetDailyKwh.toFixed(2)} {t("kWh/day ·")}
                {plan.target30DayKwh.toFixed(1)} {t("kWh over 30 days")}
              </small>
              <p className="fine-print">
                {t("Based on")}
                {plan.from} {t("to")}
                {plan.to} ({plan.days}{" "}
                {t(
                  "days). A planning scenario, not predicted or guaranteed consumption.",
                )}
              </p>
            </div>
          ) : (
            <p className="info-strip">
              {t(
                "Daily use is unavailable. Add two readings on different dates for the same meter and multiplier, without a reset or rollover.",
              )}
            </p>
          )}
        </section>
      </div>
      <section className="card">
        <span className="eyebrow">{t("EVIDENCE CHECKS")}</span>
        <h2>{t("Review and complete")}</h2>
        {findings.length ? (
          [...review, ...missing]
            .slice(0, 4)
            .map((finding) => (
              <Investigation
                key={finding.id}
                bill={bills.find((b) => b.id === finding.billId)}
                finding={finding}
                act={act}
                openCase={openCase}
              />
            ))
        ) : (
          <Empty
            title={t("No checks yet")}
            text="Add a confirmed bill to see which comparisons can run."
          />
        )}
      </section>
    </>
  );
}
function Metric({
  label,
  value,
  note,
  icon,
}: {
  label: string;
  value: string;
  note: string;
  icon: "bill" | "usage" | "review" | "case";
}) {
  const Icon = {
    bill: FileText,
    usage: Bolt,
    review: CircleAlert,
    case: Layers,
  }[icon];
  return (
    <div className={`metric-card metric-${icon}`}>
      <span className="metric-icon">
        <Icon size={19} />
      </span>
      <span className="metric-label">{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </div>
  );
}
function Trend({ bills }: { bills: Bill[] }) {
  const points = [...bills]
    .filter((bill) => bill.billedUnits !== null)
    .sort((a, b) => a.billMonth.localeCompare(b.billMonth))
    .slice(-6);
  if (!points.length)
    return (
      <Empty
        title={t("Your history starts here")}
        text="Add confirmed units to view this connection's history."
      />
    );
  const max = Math.max(...points.map((bill) => bill.billedUnits ?? 0), 1);
  return (
    <>
      <div className="bar-chart" aria-hidden="true">
        {points.map((bill) => (
          <div className="bar-column" key={bill.id}>
            <span className="bar-value">{bill.billedUnits}</span>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  height: `${((bill.billedUnits ?? 0) / max) * 100}%`,
                }}
              />
            </div>
            <span className="bar-label">
              {month(bill.billMonth).split(" ")[0]}
            </span>
          </div>
        ))}
      </div>
      <details className="trend-table">
        <summary>{t("View usage as a table")}</summary>
        <table>
          <thead>
            <tr>
              <th>{t("Month")}</th>
              <th>{t("Billed kWh")}</th>
              <th>{t("Reading basis")}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((bill) => (
              <tr key={bill.id}>
                <td>{month(bill.billMonth)}</td>
                <td>{bill.billedUnits}</td>
                <td>{bill.readingStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </>
  );
}
function BillsView({
  data,
  reference,
  onAdd,
  onEdit,
  openCase,
  reload,
  act,
  onApplyOnline,
}: {
  data: Overview;
  reference: string;
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
  openCase: (finding: Finding) => Promise<void>;
  reload: () => Promise<void>;
  act: (finding: Finding, action: InvestigationAction) => void;
  onApplyOnline?: (fetched: {
    referenceNumber: string;
    billedUnits?: number;
    totalAmount?: number;
    readingDate?: string;
    dueDate?: string;
    meterIdentity?: string;
  }) => void;
}) {
  const [deleting, setDeleting] = useState<Bill | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const bills = data.bills.filter((bill) => bill.referenceNumber === reference);
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    try {
      await api(`/api/bills/${deleting.id}`, { method: "DELETE" });
      await reload();
      setDeleting(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Deletion failed"));
      setDeleting(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow={t("BILLS & FINDINGS")}
        title={t("Inspect before you conclude.")}
        description={t(
          "Compare confirmed records, revise fields, and preserve a finding as a case.",
        )}
        action={
          <button className="button button-primary" onClick={onAdd}>
            <Plus size={18} />
            {t("Add a bill")}
          </button>
        }
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <div className="info-strip">
        <ShieldCheck size={19} />
        {t(
          "A source difference is a reason to investigate. Utility errors and payment posting are not verified.",
        )}
      </div>
      <OnlineFetcher initialReference={reference} onApplyData={onApplyOnline} />
      {bills.length ? (
        <div className="bill-list">
          {bills.map((bill) => (
            <article
              className={`card bill-card ${bill.supersededById ? "superseded" : ""}`}
              key={bill.id}
            >
              <div className="bill-card-head">
                <div>
                  <span className="bill-icon">
                    <FileText size={22} />
                  </span>
                  <span>
                    <small>
                      {month(bill.billMonth)} ·{" "}
                      {bill.supersededById ? "SUPERSEDED" : "ACTIVE"}
                    </small>
                    <h2>{money(bill.totalAmount)}</h2>
                  </span>
                </div>
                <span className="pill">
                  {bill.billedUnits ?? "—"} {t("kWh")}
                </span>
              </div>
              <div className="bill-meta">
                <span>
                  {bill.evidenceFileId
                    ? t("Original document attached")
                    : t("Manual record · original document missing")}
                </span>
                <span>
                  {t("Meter")}
                  {bill.meterIdentity ?? "unknown"}
                </span>
                <span>
                  {t("Reading")}
                  {bill.readingDate ?? t("date missing")} · {bill.readingStatus}
                </span>
                <span>
                  {bill.meterType} {t("arrangement")}
                </span>
              </div>
              {data.findings
                .filter((finding) => finding.billId === bill.id)
                .map((finding) => (
                  <Investigation
                    key={finding.id}
                    bill={bill}
                    finding={finding}
                    act={act}
                    openCase={openCase}
                  />
                ))}
              <div className="bill-actions">
                <button className="text-button" onClick={() => onEdit(bill)}>
                  {t("Inspect source / edit")}
                </button>
                {bill.evidenceFileId && (
                  <a
                    className="text-button"
                    href={`/api/files/${bill.evidenceFileId}`}
                  >
                    {t("Download original")}
                  </a>
                )}
                <button
                  className="text-button danger"
                  onClick={() => setDeleting(bill)}
                >
                  {t("Delete bill")}
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <section className="card">
          <Empty
            title={t("No bills for this connection")}
            text="Upload a bill to begin reviewing evidence."
            action={
              <button className="button button-primary" onClick={onAdd}>
                {t("Add a bill")}
              </button>
            }
          />
        </section>
      )}
      {deleting && (
        <Confirmation
          title={t("Delete this bill?")}
          description={t(
            "Payment entries are deleted too. Evidence captured by a case is retained with its immutable snapshot.",
          )}
          busy={busy}
          onCancel={() => setDeleting(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}
function ReadingsView({
  data,
  reference,
  reload,
  targetBill,
  onEvidence,
  onBusy,
  afterSave,
}: {
  data: Overview;
  reference: string;
  reload: () => Promise<void>;
  targetBill: Bill | null;
  onEvidence: (id: string | null) => void;
  onBusy: (busy: boolean) => void;
  afterSave: () => void;
}) {
  const [editing, setEditing] = useState<EditableRecord | null>(null);
  const [deleting, setDeleting] = useState<EditableRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [evidenceId, setEvidence] = useState<string | null>(null);
  const latest =
    targetBill?.referenceNumber === reference
      ? targetBill
      : data.bills.find(
          (bill) => bill.referenceNumber === reference && !bill.supersededById,
        );
  async function upload(file: File) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("kind", "reading");
      body.set("file", file);
      const result = await api<{ evidenceFileId: string }>("/api/upload", {
        method: "POST",
        body,
      });
      const old = evidenceId;
      setEvidence(result.evidenceFileId);
      onEvidence(result.evidenceFileId);
      if (old) await api(`/api/files/${old}`, { method: "DELETE" });
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not upload reading evidence"),
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api(
        "/api/readings",
        json({
          referenceNumber: values.get("referenceNumber"),
          meterIdentity: values.get("meterIdentity"),
          readingDate: values.get("readingDate"),
          readingValue: Number(values.get("readingValue")),
          multiplier: Number(values.get("multiplier")),
          meterType: values.get("meterType"),
          note: values.get("note"),
          evidenceFileId: evidenceId,
        }),
      );
      setEvidence(null);
      onEvidence(null);
      form.reset();
      setNotice(
        t(
          "Dated observation saved. Matching bill comparisons have been updated.",
        ),
      );
      await reload();
      afterSave();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not save observation"),
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow={t("METER EVIDENCE")}
        title={t("Record what you observed.")}
        description={t(
          "Dates and meter identity determine which comparisons are valid.",
        )}
      />
      <div className="split-grid">
        <section className="card">
          <h2>{t("Add a dated observation")}</h2>
          <form key={reference} className="stack-form" onSubmit={save}>
            <Field label={t("Connection reference number")}>
              <input
                name="referenceNumber"
                defaultValue={reference}
                pattern="[0-9]{14}"
                maxLength={14}
                required
              />
            </Field>
            <Field label={t("Meter identity / serial")}>
              <input
                name="meterIdentity"
                defaultValue={latest?.meterIdentity ?? ""}
                maxLength={80}
                required
              />
            </Field>
            <div className="form-grid">
              <Field label={t("Observation date")}>
                <input
                  type="date"
                  name="readingDate"
                  defaultValue={latest?.readingDate ?? ""}
                  required
                />
              </Field>
              <Field label={t("Observed meter reading")}>
                <input
                  type="number"
                  min={0}
                  step="0.001"
                  name="readingValue"
                  required
                />
              </Field>
              <Field label={t("Multiplier")}>
                <input
                  type="number"
                  min="0.001"
                  step="0.001"
                  name="multiplier"
                  defaultValue={latest?.multiplier ?? 1}
                  required
                />
              </Field>
              <Field label={t("Meter arrangement")}>
                <select
                  name="meterType"
                  defaultValue={latest?.meterType ?? "unknown"}
                >
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
            <Field label={t("Note (optional)")}>
              <input name="note" maxLength={300} />
            </Field>
            <Field label={t("Photo or document (optional)")}>
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void upload(file);
                }}
              />
            </Field>
            {evidenceId && (
              <>
                <small>{t("Evidence uploaded privately.")}</small>
                <button
                  type="button"
                  className="text-button"
                  disabled={busy}
                  onClick={() => {
                    void api(`/api/files/${evidenceId}`, { method: "DELETE" })
                      .then(() => {
                        setEvidence(null);
                        onEvidence(null);
                      })
                      .catch(() =>
                        setError(t("Could not remove unused evidence.")),
                      );
                  }}
                >
                  {t("Remove unused upload")}
                </button>
              </>
            )}
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            {notice && <p role="status">{notice}</p>}
            <button disabled={busy} className="button button-primary">
              {t("Save observation")}
            </button>
          </form>
        </section>
        <section className="card">
          <h2>{t("This connection's observations")}</h2>
          <div className="simple-list">
            {data.readings
              .filter((reading) => reading.referenceNumber === reference)
              .map((reading) => (
                <div key={reading.id}>
                  <span className="round-icon">
                    <Gauge size={18} />
                  </span>
                  <span>
                    <strong>
                      {reading.readingValue} ·{" "}
                      {reading.meterIdentity ?? t("meter unknown")}
                    </strong>
                    <small>
                      {reading.readingDate} {t("· multiplier")}
                      {reading.multiplier} · {reading.meterType}
                    </small>
                    <small>{reading.note}</small>
                    {reading.evidenceFileId && (
                      <a href={`/api/files/${reading.evidenceFileId}`}>
                        {t("Download evidence")}
                      </a>
                    )}
                  </span>
                  <div className="record-actions">
                    <button
                      className="text-button"
                      disabled={busy || !!evidenceId}
                      onClick={() =>
                        setEditing({ kind: "reading", record: reading })
                      }
                    >
                      {t("Correct / history")}
                    </button>
                    <button
                      className="text-button danger"
                      disabled={busy || !!evidenceId}
                      onClick={() =>
                        setDeleting({ kind: "reading", record: reading })
                      }
                    >
                      {t("Delete")}
                    </button>
                  </div>
                </div>
              ))}
          </div>
          {!data.readings.some(
            (reading) => reading.referenceNumber === reference,
          ) && (
            <Empty
              title={t("No dated observations")}
              text="Add two compatible observations to estimate daily use."
            />
          )}
          <RecordHistory kind="reading" refresh={data} />
        </section>
      </div>
      {editing && (
        <RecordEditor
          item={editing}
          data={data}
          reload={reload}
          onBusy={onBusy}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <RecordDeletion
          item={deleting}
          reload={reload}
          onBusy={onBusy}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
function PaymentsView({
  data,
  bills,
  reference,
  reload,
  targetBill,
  onEvidence,
  onBusy,
  afterSave,
}: {
  data: Overview;
  bills: Bill[];
  reference: string;
  reload: () => Promise<void>;
  targetBill: Bill | null;
  onEvidence: (id: string | null) => void;
  onBusy: (busy: boolean) => void;
  afterSave: () => void;
}) {
  const [editing, setEditing] = useState<EditableRecord | null>(null);
  const [deleting, setDeleting] = useState<EditableRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  async function upload(file: File) {
    setBusy(true);
    onBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("kind", "receipt");
      body.set("file", file);
      const result = await api<{ evidenceFileId: string }>("/api/upload", {
        method: "POST",
        body,
      });
      const old = receipt;
      setReceipt(result.evidenceFileId);
      onEvidence(result.evidenceFileId);
      if (old) await api(`/api/files/${old}`, { method: "DELETE" });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Upload failed"));
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    onBusy(true);
    setError("");
    const form = event.currentTarget;
    const values = new FormData(form);
    try {
      await api(
        "/api/payments",
        json({
          billId: values.get("billId"),
          evidenceFileId: receipt,
          amount: Number(values.get("amount")),
          paidAt: values.get("paidAt"),
          channel: values.get("channel"),
          reference: values.get("reference"),
        }),
      );
      form.reset();
      setReceipt(null);
      onEvidence(null);
      setNotice(t("Payment record saved. Utility posting remains unverified."));
      await reload();
      afterSave();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not save payment"),
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  const payments = data.payments.filter((payment) =>
    data.bills.some(
      (bill) =>
        bill.id === payment.billId && bill.referenceNumber === reference,
    ),
  );
  return (
    <>
      <PageHead
        eyebrow={t("PAYMENT RECORDS")}
        title={t("Keep receipts with their bill.")}
        description={t(
          "These records compare entered amounts; they do not verify utility posting.",
        )}
      />
      <div className="split-grid">
        <section className="card">
          <h2>{t("Add payment evidence")}</h2>
          {bills.length ? (
            <form className="stack-form" onSubmit={save}>
              <Field label={t("Bill")}>
                <select name="billId" defaultValue={targetBill?.id}>
                  {bills.map((bill) => (
                    <option key={bill.id} value={bill.id}>
                      {month(bill.billMonth)} · {money(bill.totalAmount)}
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
                  required
                />
              </Field>
              <Field label={t("Payment date")}>
                <input name="paidAt" type="date" required />
              </Field>
              <Field label={t("Channel")}>
                <input
                  name="channel"
                  maxLength={80}
                  required
                  placeholder={t("Bank, wallet, counter…")}
                />
              </Field>
              <Field label={t("Transaction reference (optional)")}>
                <input name="reference" maxLength={120} />
              </Field>
              <Field label={t("Receipt (optional)")}>
                <input
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void upload(file);
                  }}
                />
              </Field>
              {receipt && (
                <>
                  <small>{t("Receipt uploaded privately.")}</small>
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy}
                    onClick={() => {
                      void api(`/api/files/${receipt}`, { method: "DELETE" })
                        .then(() => {
                          setReceipt(null);
                          onEvidence(null);
                        })
                        .catch(() =>
                          setError(t("Could not remove unused evidence.")),
                        );
                    }}
                  >
                    {t("Remove unused upload")}
                  </button>
                </>
              )}
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
              {notice && <p role="status">{notice}</p>}
              <button className="button button-primary" disabled={busy}>
                {t("Save payment record")}
              </button>
            </form>
          ) : (
            <Empty
              title={t("Add an active bill first")}
              text="Payment records must be attached to a saved bill."
            />
          )}
        </section>
        <section className="card">
          <h2>{t("Receipt history")}</h2>
          {payments.length ? (
            <div className="simple-list">
              {payments.map((payment) => (
                <div key={payment.id}>
                  <span className="round-icon">
                    <Wallet size={18} />
                  </span>
                  <span>
                    <strong>{money(payment.amount)}</strong>
                    <small>
                      {payment.paidAt} · {payment.channel}
                    </small>
                    {payment.evidenceFileId && (
                      <a href={`/api/files/${payment.evidenceFileId}`}>
                        {t("Download receipt")}
                      </a>
                    )}
                  </span>
                  <div className="record-actions">
                    <button
                      className="text-button"
                      disabled={busy || !!receipt}
                      onClick={() =>
                        setEditing({ kind: "payment", record: payment })
                      }
                    >
                      {t("Correct / history")}
                    </button>
                    <button
                      className="text-button danger"
                      disabled={busy || !!receipt}
                      onClick={() =>
                        setDeleting({ kind: "payment", record: payment })
                      }
                    >
                      {t("Delete")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty
              title={t("No receipts yet")}
              text="Save an amount and date with optional receipt evidence."
            />
          )}
          <RecordHistory kind="payment" refresh={data} />
        </section>
      </div>
      {editing && (
        <RecordEditor
          item={editing}
          data={data}
          reload={reload}
          onBusy={onBusy}
          onClose={() => setEditing(null)}
        />
      )}
      {deleting && (
        <RecordDeletion
          item={deleting}
          reload={reload}
          onBusy={onBusy}
          onClose={() => setDeleting(null)}
        />
      )}
    </>
  );
}
function SettingsView({
  data,
  reload,
}: {
  data: Overview;
  reload: () => Promise<void>;
}) {
  const router = useRouter();
  const [action, setAction] = useState<"delete" | "reset" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function execute() {
    setBusy(true);
    setError("");
    try {
      if (action === "reset") {
        await api("/api/demo", json({ reset: true }));
        await reload();
      } else {
        await api("/api/household", { method: "DELETE" });
        router.push("/login");
        router.refresh();
      }
      setAction(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t("Action failed"));
      setAction(null);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow={t("WORKSPACE SETTINGS")}
        title={t("Control your household evidence.")}
        description={t(
          "Originals, previews, cases, and observations remain private to this workspace.",
        )}
      />
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <RecoverySettings />
      <div className="split-grid">
        <section className="card">
          <h2>
            {data.isDemo
              ? t("Synthetic demo workspace")
              : t("Private household workspace")}
          </h2>
          <p className="account-email">{data.email}</p>
          <p>
            {t(
              "Local OCR provides candidate fields and source regions. LESCO extraction coverage is unverified until redacted real documents are evaluated.",
            )}
          </p>
          {data.isDemo && (
            <>
              <p>
                {t(
                  "Reset recreates the two fictional bills and dated observations in this demo workspace.",
                )}
              </p>
              <button
                className="button button-outline"
                onClick={() => setAction("reset")}
              >
                {t("Reset synthetic demo")}
              </button>
            </>
          )}
        </section>
        <section className="card danger-card">
          <h2>{t("Delete this account and its data")}</h2>
          <p>
            {t(
              "This removes household records, case snapshots, source documents, and generated previews.",
            )}
          </p>
          <button
            className="button button-danger"
            onClick={() => setAction("delete")}
          >
            {t("Delete account and data")}
          </button>
        </section>
      </div>
      {action && (
        <Confirmation
          title={
            action === "reset"
              ? t("Reset the synthetic demo?")
              : t("Delete this account?")
          }
          description={
            action === "reset"
              ? t(
                  "Only this fictional demo workspace is reset. Its current cases and records will be removed.",
                )
              : t(
                  "This permanently deletes this account and all of its household data.",
                )
          }
          busy={busy}
          onCancel={() => setAction(null)}
          onConfirm={() => void execute()}
        />
      )}
    </>
  );
}

function Investigation({
  bill,
  finding,
  act,
  openCase,
}: {
  bill?: Bill;
  finding: Finding;
  act: (finding: Finding, action: InvestigationAction) => void;
  openCase: (finding: Finding) => Promise<void>;
}) {
  function openSource(source: {
    kind: "bill" | "reading" | "payment";
    billId: string;
  }) {
    act(finding, {
      kind: source.kind,
      billId: source.billId,
      label: "Inspect cited source",
      description: "Open the source record referenced by the AI answer.",
    });
  }
  const disco = bill?.referenceNumber ? identifyDisco(bill.referenceNumber) : null;
  const isPtcl = bill?.referenceNumber ? isPtclAccountId(bill.referenceNumber) : false;
  const providerName = isPtcl ? "PTCL" : (disco?.name ?? "DISCO / Utility");
  return (
    <section className="investigation-card">
      <FindingRow finding={finding} />
      <div className="next-actions">
        <strong>{t("Next action")}</strong>
        {guidance(finding).map((action) => (
          <div key={action.billId ?? action.kind}>
            <p>{t(action.description)}</p>
            <button
              className="button button-outline"
              onClick={() => act(finding, action)}
            >
              {t(action.label)}
            </button>
          </div>
        ))}
        {finding.kind === "review" && (
          <button
            className="button button-primary"
            onClick={() => void openCase(finding)}
          >
            {t("Open / view case")}
          </button>
        )}
      </div>
      <WhatsAppDispatcher
        referenceNumber={bill?.referenceNumber ?? ""}
        discoName={providerName}
        billMonth={bill?.billMonth ?? ""}
        findingTitle={finding.title}
        findingDetail={finding.detail}
        evidenceText={finding.evidence.join(" · ")}
      />
      <AIInvestigator findingId={finding.id} onOpenSource={openSource} />
    </section>
  );
}
function DocumentsView({
  data,
  reload,
  onReview,
}: {
  data: Overview;
  reload: () => Promise<void>;
  onReview: (id: string) => void;
}) {
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (!removing) return;
    setBusy(true);
    try {
      await api(`/api/files/${removing}`, { method: "DELETE" });
      await reload();
      setRemoving(null);
    } catch {
      setError(t("Could not delete unused document. Retry."));
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow={t("PRIVATE DOCUMENTS")}
        title={t("Keep every upload accounted for.")}
        description={t(
          "Documents awaiting review remain private and can be resumed or removed.",
        )}
      />
      <p>
        {(data.storageBytes / 1048576).toFixed(1)} /{" "}
        {(data.storageLimit / 1048576).toFixed(0)}{" "}
        {t("MB used, including previews")}
      </p>
      {error && <p role="alert">{error}</p>}
      <section className="card simple-list">
        {data.evidence.map((file) => (
          <div key={file.id}>
            <span>
              <strong>{file.name}</strong>
              <small>
                {file.kind} · {file.ocrState} ·{" "}
                {file.unattached
                  ? t("Not attached to a record")
                  : t("Attached to a record")}
              </small>
              <a href={`/api/files/${file.id}`}>{t("Download original")}</a>
            </span>
            {file.unattached && (
              <span>
                {file.kind === "bill" && (
                  <button
                    className="button button-outline"
                    onClick={() => onReview(file.id)}
                  >
                    {t("Resume bill review")}
                  </button>
                )}
                <button
                  className="text-button"
                  onClick={() => setRemoving(file.id)}
                >
                  {t("Remove unused document")}
                </button>
              </span>
            )}
          </div>
        ))}
      </section>
      {removing && (
        <Confirmation
          title={t("Remove unused document?")}
          description={t(
            "This removes the original and its generated previews. Attached case evidence cannot be removed here.",
          )}
          busy={busy}
          onCancel={() => setRemoving(null)}
          onConfirm={() => void remove()}
        />
      )}
    </>
  );
}

function RecoverySettings() {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function renew(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const result = await api<{ recoveryCode: string }>(
        "/api/auth/recovery-code",
        json({ password: values.get("password") }),
      );
      setCode(result.recoveryCode);
      form.reset();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : t("Could not renew recovery code"),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="card recovery-settings">
      <h2>{t("Account recovery")}</h2>
      <p>
        {t(
          "Confirm your password to replace a lost recovery code. The previous code stops working. Save the new code securely; it is not emailed.",
        )}
      </p>
      <form className="stack-form" onSubmit={renew}>
        <label>
          {t("Current password")}
          <input
            type="password"
            name="password"
            minLength={12}
            maxLength={128}
            autoComplete="current-password"
            required
          />
        </label>
        <button disabled={busy} className="button button-outline">
          {t("Renew recovery code")}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {code && (
        <>
          <label>
            {t("New recovery code")}
            <input readOnly className="recovery-code" value={code} />
          </label>
          <button className="text-button" onClick={() => setCode("")}>
            {t("I saved this code securely")}
          </button>
        </>
      )}
    </section>
  );
}

function RecordDeletion({
  item,
  reload,
  onClose,
  onBusy,
}: {
  item: EditableRecord;
  reload: () => Promise<void>;
  onClose: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [deleted, setDeleted] = useState(false);
  async function remove() {
    setBusy(true);
    onBusy(true);
    try {
      if (!deleted)
        await api(
          `/api/${item.kind === "reading" ? "readings" : "payments"}/${item.record.id}`,
          json({ revision: item.record.revision }, "DELETE"),
        );
      setDeleted(true);
      try {
        await reload();
        onClose();
      } catch {
        setError(
          t(
            "The record was deleted, but the list could not refresh. Close and reload the workspace.",
          ),
        );
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t("Could not delete record"),
      );
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <>
      <Confirmation
        title={t("Delete this evidence record?")}
        description={t(
          "This removes the observation or payment from current checks. Private revision history and existing case snapshots are retained. Attached files remain private and can be removed from Documents when unused.",
        )}
        busy={busy}
        error={error}
        onCancel={onClose}
        onConfirm={() => void remove()}
      />
    </>
  );
}
