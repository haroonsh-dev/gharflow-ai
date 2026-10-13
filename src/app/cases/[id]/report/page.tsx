import { t } from "@/lib/copy";
import { notFound,redirect } from "next/navigation";
import { identity } from "@/lib/auth";
import { overview } from "@/lib/overview";
import PrintButton from "./print-button";
export default async function Report({params}:{params:Promise<{id:string}>}){
  const person=await identity();if(!person)redirect("/login");
  const data=await overview(person);
  const {id}=await params;const record=data.cases.find((record)=>record.id===id);if(!record)notFound();
  const snapshot=record.snapshot;
  return <main className="report-page"><div className="report-toolbar no-print"><a href="/dashboard">{t("← Household workspace")}</a><PrintButton/></div>
    <span className="eyebrow">{t("GHARFLOW · EVIDENCE RECORD")}</span><h1>{snapshot.finding.title}</h1>
    {snapshot.isDemo&&<div className="demo-banner">{t("SYNTHETIC DEMONSTRATION — not a real household or utility case")}</div>}
    <p>{snapshot.finding.detail}</p><p className="muted">{t("Case")}{record.id} {t("· Snapshot")}{snapshot.capturedAt} {t("· Rule")}{snapshot.ruleVersion}</p>
    <h2>{t("Comparison captured when the case opened")}</h2><ul>{snapshot.finding.evidence.map((value,index)=><li key={index}>{value}</li>)}</ul>
    <h2>{t("Bill records")}</h2>{snapshot.bills.map((bill)=><section key={bill.id}><h3>{bill.billMonth.slice(0,7)} {t("· connection ending")}{bill.referenceNumber.slice(-4)}</h3><table><tbody>{Object.entries({"Meter":bill.meterIdentity??"Unknown",[t("Reading date")]:bill.readingDate??"Unknown",[t("Reading basis")]:bill.readingStatus,[t("Previous reading")]:bill.previousReading??"Missing",[t("Current reading")]:bill.currentReading??"Missing","Multiplier":bill.multiplier,[t("Billed kWh")]:bill.billedUnits??"Missing",[t("Bill amount PKR")]:bill.totalAmount,[t("Confirmed at")]:bill.confirmedAt??t("Legacy record")}).map(([label,value])=><tr key={label}><th>{label}</th><td>{String(value)}</td></tr>)}</tbody></table><h4>{t("Corrections to OCR hints")}</h4>{Object.keys(bill.corrections).length?<ul>{Object.entries(bill.corrections).map(([key,value])=><li key={key}>{key}{t(": extracted “")}{value.extracted}{t("”, confirmed “")}{value.confirmed}”</li>)}</ul>:<p>{t("No OCR corrections recorded.")}</p>}</section>)}
    <h2>{t("Household observations")}</h2>{snapshot.readings.length?snapshot.readings.map((reading)=><p key={reading.id}>{reading.readingDate} {t("· meter")}{reading.meterIdentity} {t("· observed")}{reading.readingValue} {t("· multiplier")}{reading.multiplier}</p>):<p>{t("No household observation was used in this finding.")}</p>}
    <h2>{t("Payment records")}</h2>{snapshot.payments.length?snapshot.payments.map((payment)=><p key={payment.id}>{payment.paidAt} {t("· PKR")}{payment.amount} · {payment.channel} {t("· user entered, posting not verified")}</p>):<p>{t("No payment records captured.")}</p>}
    <h2>{t("Missing information")}</h2>{snapshot.finding.missing.length?<ul>{snapshot.finding.missing.map((value)=><li key={value}>{value}</li>)}</ul>:<p>{t("No additional fields were required for this specific calculation. Verify the original source values and any meter changes.")}</p>}
    <h2>{t("Documents")}</h2><ul>{data.evidence.filter((evidence)=>record.evidenceIds.includes(evidence.id)).map((evidence)=><li key={evidence.id}><a href={`/api/files/${evidence.id}`}>{evidence.name}</a> · {evidence.kind} {t("· ID")}{evidence.id}</li>)}</ul>
    <h2>{t("Current user-reported status")}</h2><p>{record.status.replaceAll("_"," ")} {t("· updated")}{record.updatedAt}</p><h3>{t("Notes")}</h3><p className="preserve-lines">{record.notes||t("No notes entered.")}</p><h3>{t("Outcome")}</h3><p className="preserve-lines">{record.outcome||t("No outcome entered.")}</p>
    <p className="report-disclaimer">{t("This report records source comparisons and user-reported information. It does not establish a utility error, verified payment posting, refund, or official complaint submission. The calculation snapshot remains unchanged when bills are edited.")}</p>
  </main>;
}
