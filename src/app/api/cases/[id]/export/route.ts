import { z } from "zod";
import { NextResponse } from "next/server";
import { identity } from "@/lib/auth";
import { overview } from "@/lib/overview";
import { errorResponse, failure } from "@/lib/http";
import { evidencePdf } from "@/lib/report-pdf";
export const runtime = "nodejs";
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const person = await identity();
    if (!person || person.deleting) return failure("Sign in required", 401);
    const id = z.uuid().parse((await context.params).id);
    const data = await overview(person);
    const record = data.cases.find((item) => item.id === id);
    if (!record) return failure("Case not found", 404);
    return new NextResponse(
      new Uint8Array(await evidencePdf(record, data.evidence)),
      {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="gharflow-case-${id}.pdf"`,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  } catch (error) {
    return errorResponse(error);
  }
}
