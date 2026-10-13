import { NextResponse } from "next/server";
import { guard,errorResponse,failure } from "@/lib/http";
import { billSchema } from "@/lib/schemas";
import { saveBill,InputError } from "@/lib/bills";
export const runtime="nodejs";
export async function POST(request:Request){try{const person=await guard(request);if(person instanceof NextResponse)return person;const id=await saveBill(person,billSchema.parse(await request.json()));return NextResponse.json({id},{status:201});}catch(error){return error instanceof InputError?failure(error.message,error.status):errorResponse(error);}}
