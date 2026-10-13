"use client";
import { t } from "@/lib/copy";
export default function PrintButton(){return <button className="button button-primary no-print" onClick={()=>window.print()}>{t("Print / save PDF")}</button>;}
