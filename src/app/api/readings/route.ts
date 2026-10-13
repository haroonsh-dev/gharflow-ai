import { NextResponse } from "next/server";
import { guard,errorResponse,failure } from "@/lib/http";
import { meterSchema } from "@/lib/schemas";
import { rows } from "@/lib/db";
export const runtime="nodejs";
export async function POST(request:Request){try{const person=await guard(request);if(person instanceof NextResponse)return person;const input=meterSchema.parse(await request.json());if(input.evidenceFileId){const evidence=await rows("SELECT id FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='reading'",[input.evidenceFileId,person.householdId]);if(!evidence[0])return failure("Reading evidence not found",404);}const saved=await rows<{id:string}>(`INSERT INTO meter_readings(household_id,reference_number,meter_identity,reading_date,reading_value,multiplier,note,evidence_file_id,meter_type) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,[person.householdId,input.referenceNumber,input.meterIdentity,input.readingDate,input.readingValue,input.multiplier,input.note,input.evidenceFileId??null,input.meterType]);return NextResponse.json({id:saved[0].id},{status:201});}catch(error){return errorResponse(error);}}
