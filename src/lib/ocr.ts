import { ocrResponseSchema } from "./schemas";
import { storeExtraction } from "./storage";
export async function extractSaved(householdId:string,saved:{id:string;bytes:Buffer;mime:string},name:string){
  const body=new FormData();body.set("file",new Blob([Uint8Array.from(saved.bytes)],{type:saved.mime}),name);
  const response=await fetch(`${process.env.OCR_URL??"http://ocr:8000"}/extract`,{method:"POST",headers:{"x-internal-token":process.env.OCR_INTERNAL_TOKEN??""},body,signal:AbortSignal.timeout(65000)});
  if(!response.ok)throw new Error(`OCR returned ${response.status}`);
  const result=ocrResponseSchema.parse(await response.json());
  return {fields:result.fields,extraction:await storeExtraction(householdId,saved.id,result)};
}
