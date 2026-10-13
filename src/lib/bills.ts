import { db, rows } from "./db";
import { extractionSchema, type BillInput } from "./schemas";
import type { Identity } from "./auth";
import { removeUnusedEvidence } from "./storage";
export class InputError extends Error { constructor(message:string,public status=400){super(message);} }
export const fieldMap: Record<string,string> = { reference_number:"referenceNumber",previous_reading:"previousReading",current_reading:"currentReading",billed_units:"billedUnits",total_amount:"totalAmount",meter_identity:"meterIdentity",reading_date:"readingDate" };
export async function saveBill(person:Identity,input:BillInput,id?:string) {
  const client=await db.connect(); let oldEvidence:string|null=null;
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1))",[person.householdId]);
    if(id){ const existing=await client.query<{evidence_file_id:string|null}>("SELECT evidence_file_id FROM bills WHERE id=$1 AND household_id=$2 FOR UPDATE",[id,person.householdId]); if(!existing.rows[0])throw new InputError("Bill not found",404); oldEvidence=existing.rows[0].evidence_file_id; }
    let candidates: Record<string,{value:string}>={};
    if(input.evidenceFileId){ const evidence=await client.query<{ocr_result:unknown}>("SELECT ocr_result FROM evidence_files WHERE id=$1 AND household_id=$2 AND kind='bill'",[input.evidenceFileId,person.householdId]); if(!evidence.rows[0])throw new InputError("Bill evidence not found",404); const parsed=extractionSchema.safeParse(evidence.rows[0].ocr_result); if(parsed.success)candidates=parsed.data.candidates; }
    const fieldSources:Record<string,"ocr"|"user">={}; const corrections:Record<string,{extracted:string;confirmed:string}>={};
    for(const key of ["referenceNumber","previousReading","currentReading","billedUnits","totalAmount","meterIdentity","readingDate","billMonth","multiplier","dueDate","readingStatus","meterType"]){
      const value=input[key as keyof BillInput]; const raw=Object.entries(fieldMap).find(([,target])=>target===key)?.[0]; const candidate=raw?candidates[raw]:undefined;
      const same=candidate && value!==null && value!==undefined && (typeof value==="number"?Number(candidate.value)===value:candidate.value===String(value));
      fieldSources[key]=same?"ocr":"user";
      if(candidate&&!same)corrections[key]={extracted:candidate.value,confirmed:value==null?"":String(value)};
    }
    const values=[person.householdId,input.evidenceFileId??null,input.referenceNumber,input.billMonth,input.previousReading,input.currentReading,input.multiplier,input.billedUnits,input.totalAmount,input.dueDate,JSON.stringify(fieldSources),input.evidenceFileId?(Object.keys(candidates).length?"extracted":"failed"):"manual",input.meterIdentity,input.readingDate,input.readingStatus,input.meterType,JSON.stringify(corrections)];
    let savedId=id;
    if(id)await client.query(`UPDATE bills SET evidence_file_id=$2,reference_number=$3,bill_month=$4,previous_reading=$5,current_reading=$6,multiplier=$7,billed_units=$8,total_amount=$9,due_date=$10,field_sources=$11,ocr_status=$12,meter_identity=$13,reading_date=$14,reading_status=$15,meter_type=$16,corrections=$17,confirmed_at=now() WHERE household_id=$1 AND id=$18`,[...values,id]);
    else {const created=await client.query<{id:string}>(`INSERT INTO bills(household_id,evidence_file_id,reference_number,bill_month,previous_reading,current_reading,multiplier,billed_units,total_amount,due_date,field_sources,ocr_status,meter_identity,reading_date,reading_status,meter_type,corrections,confirmed_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now()) RETURNING id`,values); savedId=created.rows[0].id;}
    if(input.replacesBillId){
      if(input.replacesBillId===savedId)throw new InputError("A bill cannot replace itself");
      const previous=await client.query<{id:string}>(`SELECT id FROM bills WHERE id=$1 AND household_id=$2 AND reference_number=$3 AND bill_month=$4 AND superseded_by_id IS NULL FOR UPDATE`,[input.replacesBillId,person.householdId,input.referenceNumber,input.billMonth]);
      if(!previous.rows[0])throw new InputError("Replacement must be an active bill for the same connection and month");
      const newBill=await client.query<{superseded_by_id:string|null}>("SELECT superseded_by_id FROM bills WHERE id=$1",[savedId]); if(newBill.rows[0].superseded_by_id)throw new InputError("A superseded bill cannot become a replacement");
      await client.query("UPDATE bills SET superseded_by_id=$1 WHERE id=$2",[savedId,input.replacesBillId]);
    }
    await client.query("COMMIT");
    if(oldEvidence&&oldEvidence!==input.evidenceFileId)await removeUnusedEvidence(person.householdId,oldEvidence);
    return savedId;
  }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
}
export async function deleteBill(person:Identity,id:string){
  const files=await rows<{id:string}>(`SELECT evidence_file_id AS id FROM bills WHERE id=$1 AND household_id=$2 AND evidence_file_id IS NOT NULL UNION SELECT evidence_file_id AS id FROM payments WHERE bill_id=$1 AND household_id=$2 AND evidence_file_id IS NOT NULL`,[id,person.householdId]);
  const deleted=await rows<{id:string}>("DELETE FROM bills WHERE id=$1 AND household_id=$2 RETURNING id",[id,person.householdId]);
  if(!deleted[0])throw new InputError("Bill not found",404);
  for(const file of files)await removeUnusedEvidence(person.householdId,file.id);
}
