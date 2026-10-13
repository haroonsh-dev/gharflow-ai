import { readFile } from "node:fs/promises";
import path from "node:path";
import { rows } from "./db";
import { saveEvidence,removeHouseholdFiles } from "./storage";
import { extractSaved } from "./ocr";
import { saveBill } from "./bills";
import type { Identity } from "./auth";
export async function seedDemo(person:Identity,reset=false){
  if(reset){const demo=await rows<{is_demo:boolean}>("SELECT is_demo FROM households WHERE id=$1",[person.householdId]);if(!demo[0]?.is_demo)throw new Error("Only a synthetic workspace can be reset");await rows("DELETE FROM cases WHERE household_id=$1",[person.householdId]);await rows("DELETE FROM bills WHERE household_id=$1",[person.householdId]);await rows("DELETE FROM meter_readings WHERE household_id=$1",[person.householdId]);await rows("DELETE FROM evidence_files WHERE household_id=$1",[person.householdId]);await removeHouseholdFiles(person.householdId);}
  for(const item of [{name:"normal",month:"2026-08-01",date:"2026-08-10",previous:1000,current:1100,units:100,total:5000},{name:"discrepancy",month:"2026-09-01",date:"2026-09-10",previous:1100,current:1220,units:160,total:7000}]){
    const bytes=await readFile(path.join(process.cwd(),"demo",`${item.name}.pdf`));
    const saved=await saveEvidence(person.householdId,"bill",new File([Uint8Array.from(bytes)],`SYNTHETIC-${item.name}.pdf`,{type:"application/pdf"}));
    try{await extractSaved(person.householdId,saved,`${item.name}.pdf`);}catch(error){console.warn("Demo OCR unavailable; manual records remain usable",error);}
    await saveBill(person,{evidenceFileId:saved.id,referenceNumber:"12345678901234",billMonth:item.month,previousReading:item.previous,currentReading:item.current,multiplier:1,billedUnits:item.units,totalAmount:item.total,dueDate:null,meterIdentity:"DEMO-01",readingDate:item.date,readingStatus:"actual",meterType:"conventional",confirmed:true});
    await rows("INSERT INTO meter_readings(household_id,reference_number,meter_identity,reading_date,reading_value,multiplier,note,meter_type) VALUES($1,$2,$3,$4,$5,1,$6,'conventional')",[person.householdId,"12345678901234","DEMO-01",item.date,item.current,"SYNTHETIC DEMONSTRATION observation"]);
  }
}
