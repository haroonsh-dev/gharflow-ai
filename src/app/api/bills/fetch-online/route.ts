import { NextResponse } from "next/server";
import { identity } from "@/lib/auth";
import { identifyDisco, parsePitcHtml } from "@/lib/online-bill";
import { isPtclAccountId, ptclBillQueryUrl } from "@/lib/ptcl";
import { identifyGasProvider } from "@/lib/sui-gas";
import { jsonBody } from "@/lib/request-body";

export async function POST(request: Request) {
  const person = await identity();
  if (!person) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await jsonBody(request)) as {
      referenceNumber?: string;
      utilityType?: "electricity" | "ptcl" | "gas";
    };
    const rawRef = String(body?.referenceNumber ?? "").trim();
    const cleanRef = rawRef.replace(/\D/g, "");

    if (!cleanRef || cleanRef.length < 10 || cleanRef.length > 14) {
      return NextResponse.json(
        { error: "Reference number must be 10 digits (PTCL/SSGC), 11 digits (SNGPL), 13 digits (KE), or 14 digits (State DISCOs)." },
        { status: 400 },
      );
    }

    // Explicit gas query or 11-digit SNGPL consumer ID
    if (body?.utilityType === "gas" || cleanRef.length === 11) {
      const gasInfo = identifyGasProvider(cleanRef) ?? {
        provider: cleanRef.length === 11 ? "sngpl" : "ssgc",
        name: cleanRef.length === 11 ? "SNGPL (Sui Northern Gas)" : "SSGC (Sui Southern Gas)",
        portalUrl:
          cleanRef.length === 11
            ? `https://www.sngpl.com.pk/bill/view_bill.jsp?consumer_no=${cleanRef}`
            : `https://bill.ssgc.com.pk/`,
      };
      return NextResponse.json({
        success: true,
        type: "gas",
        referenceNumber: cleanRef,
        provider: gasInfo.name,
        queryUrl: gasInfo.portalUrl,
        notice: `${gasInfo.name} duplicate bill lookup ready. View official duplicate or audit slabs directly in Sui Gas Audit.`,
      });
    }

    // PTCL Account query
    if (isPtclAccountId(cleanRef)) {
      const url = ptclBillQueryUrl(cleanRef);
      return NextResponse.json({
        success: true,
        type: "ptcl",
        referenceNumber: cleanRef,
        provider: "PTCL Telecom",
        queryUrl: url,
        notice: "PTCL duplicate bill lookup ready. View official duplicate or enter bill values directly.",
      });
    }

    // Power DISCO query (LESCO, KE, etc.)
    const disco = identifyDisco(cleanRef);
    const queryUrl = disco.billQueryUrl(cleanRef);

    // Attempt live fetch if PITC server is reachable
    let parsed = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(queryUrl, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const html = await res.text();
        parsed = parsePitcHtml(html, cleanRef);
      }
    } catch {
      // In offline/intranet/docker mode, fall back gracefully to queryUrl and guide
    }

    return NextResponse.json({
      success: true,
      type: "electricity",
      referenceNumber: cleanRef,
      disco: disco.name,
      discoCode: disco.code,
      queryUrl,
      parsed,
      helpline: disco.helpline,
    });
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Online fetch failed" },
      { status: 500 },
    );
  }
}
