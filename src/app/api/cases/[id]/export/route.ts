import { z } from "zod";
import { NextResponse } from "next/server";
import { identity } from "@/lib/auth";
import { overview } from "@/lib/overview";
import { errorResponse, failure } from "@/lib/http";
import { evidencePdf } from "@/lib/report-pdf";
import { generateNepraDisputePdf } from "@/lib/dispute-dossier";
import { generatePtaDisputePdf } from "@/lib/pta-dossier";
export const runtime = "nodejs";
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const person = await identity();
    if (!person || person.deleting) return failure("Sign in required", 401);
    const id = z.uuid().parse((await context.params).id);
    const data = await overview(person);
    const record = data.cases.find((item) => item.id === id);
    if (!record) return failure("Case not found", 404);

    const url = new URL(request.url);
    const format = url.searchParams.get("format");
    let pdfBytes: Uint8Array;
    let filename: string;

    if (format === "pta") {
      pdfBytes = await generatePtaDisputePdf(record, data.evidence);
      filename = `gharflow-pta-dispute-${id}.pdf`;
    } else if (format === "nepra") {
      pdfBytes = await generateNepraDisputePdf(record, data.evidence);
      filename = `gharflow-nepra-dispute-${id}.pdf`;
    } else {
      pdfBytes = await evidencePdf(record, data.evidence);
      filename = `gharflow-case-${id}.pdf`;
    }

    return new NextResponse(
      new Uint8Array(pdfBytes),
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
