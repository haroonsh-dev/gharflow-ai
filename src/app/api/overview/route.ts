import { NextResponse } from "next/server";
import { identity } from "@/lib/auth";
import { overview } from "@/lib/overview";
import { errorResponse, failure } from "@/lib/http";
export const runtime = "nodejs";
export async function GET() {
  try { const person=await identity(); if(!person)return failure("Sign in required",401); return NextResponse.json(await overview(person),{headers:{"Cache-Control":"private, no-store"}}); }
  catch(error){return errorResponse(error);}
}
