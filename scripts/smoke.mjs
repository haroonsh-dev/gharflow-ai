import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
const base=process.env.TEST_BASE_URL??'http://127.0.0.1:3000';
const origin=new URL(base).origin;const accounts=[];
async function call(path,{method='GET',cookie,body}={}){
  const headers={...(method==='GET'?{}:{Origin:origin}),...(cookie?{Cookie:cookie}:{})};
  if(body&&!(body instanceof FormData))headers['Content-Type']='application/json';
  const response=await fetch(base+path,{method,headers,body:body instanceof FormData?body:body?JSON.stringify(body):undefined,redirect:'manual'});
  const content=response.headers.get('content-type')??'';
  return {status:response.status,result:content.includes('json')?await response.json():await response.text(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
async function signup(){const result=await call('/api/auth/signup',{method:'POST',body:{email:`smoke-${randomUUID()}@example.test`,password:'smoke-test-password-123'}});assert.equal(result.status,201,JSON.stringify(result.result));accounts.push(result.cookie);return result.cookie;}
async function upload(cookie,kind,name='discrepancy.pdf'){const data=await readFile(new URL(`../demo/${name}`,import.meta.url));const body=new FormData();body.set('kind',kind);body.set('file',new Blob([data],{type:'application/pdf'}),name);const result=await call('/api/upload',{method:'POST',cookie,body});assert.equal(result.status,200,JSON.stringify(result.result));return result.result;}
const input={referenceNumber:'12345678901234',billMonth:'2026-09-01',previousReading:100,currentReading:200,multiplier:1,billedUnits:120,totalAmount:5000,dueDate:'2026-09-20',meterIdentity:'M1',readingDate:'2026-09-10',readingStatus:'actual',meterType:'conventional',confirmed:true};
try{
  const first=await signup(),second=await signup();
  const source=await upload(first,'bill');
  if(process.env.REQUIRE_OCR==='true'){assert.equal(source.ocrStatus,'extracted');assert.ok(source.extraction.candidates.current_reading);assert.equal((await call(`/api/files/${source.evidenceFileId}?preview=1`,{cookie:first})).status,200);}
  const saved=await call('/api/bills',{method:'POST',cookie:first,body:{...input,evidenceFileId:source.evidenceFileId}});assert.equal(saved.status,201,JSON.stringify(saved.result));const billId=saved.result.id;
  const reading={referenceNumber:input.referenceNumber,meterIdentity:'M1',meterType:'conventional',readingDate:'2026-09-10',readingValue:210,multiplier:1,note:'Synthetic test observation'};
  assert.equal((await call('/api/readings',{method:'POST',cookie:first,body:reading})).status,201);
  const receipt=await upload(first,'receipt');assert.equal((await call('/api/payments',{method:'POST',cookie:first,body:{billId,evidenceFileId:receipt.evidenceFileId,amount:4500,paidAt:'2026-09-18',channel:'bank'}})).status,201);
  const initialOverview=await call('/api/overview',{cookie:first});assert.equal(initialOverview.status,200,JSON.stringify(initialOverview.result));let data=initialOverview.result;
  for(const code of ['units','payment','observation'])assert.ok(data.findings.some(finding=>finding.id===`${billId}:${code}`));
  if(process.env.REQUIRE_OCR==='true')assert.equal(data.bills[0].corrections.currentReading.extracted,'1220');
  const opened=await call('/api/cases',{method:'POST',cookie:first,body:{findingId:`${billId}:units`,notes:'Synthetic investigation'}});assert.equal(opened.status,201,JSON.stringify(opened.result));const caseId=opened.result.id;
  const originalCase=(await call(`/api/cases/${caseId}`,{cookie:first})).result;
  assert.equal(originalCase.snapshot.bills[0].billedUnits,120);
  assert.equal((await call(`/api/cases/${caseId}`,{method:'PATCH',cookie:first,body:{status:'resolved',notes:'',outcome:'',evidenceIds:originalCase.evidenceIds}})).status,400);
  assert.equal((await call(`/api/cases/${caseId}`,{method:'PATCH',cookie:first,body:{status:'awaiting_response',notes:'Request prepared',outcome:'',evidenceIds:originalCase.evidenceIds}})).status,200);
  assert.equal((await call(`/cases/${caseId}/report`,{cookie:first})).status,200);
  assert.equal((await call(`/api/bills/${billId}`,{method:'PUT',cookie:first,body:{...input,evidenceFileId:source.evidenceFileId,billedUnits:100}})).status,200);
  data=(await call('/api/overview',{cookie:first})).result;assert.ok(!data.findings.some(finding=>finding.id===`${billId}:units`));assert.deepEqual(data.cases[0].snapshot,originalCase.snapshot);
  const replacement=await call('/api/bills',{method:'POST',cookie:first,body:{...input,billedUnits:100,replacesBillId:billId}});assert.equal(replacement.status,201);data=(await call('/api/overview',{cookie:first})).result;assert.equal(data.bills.find(bill=>bill.id===billId).supersededById,replacement.result.id);assert.ok(!data.findings.some(finding=>finding.billId===billId));
  assert.equal((await call('/api/overview',{cookie:second})).result.bills.length,0);
  for(const path of [`/api/files/${source.evidenceFileId}`,`/api/files/${source.evidenceFileId}?preview=1`,`/api/cases/${caseId}`,`/cases/${caseId}/report`])assert.equal((await call(path,{cookie:second})).status,404,path);
  assert.equal((await call(`/api/bills/${billId}`,{method:'PUT',cookie:second,body:input})).status,404);
  assert.equal((await call('/api/cases',{method:'POST',cookie:second,body:{findingId:`${billId}:units`}})).status,409);
  assert.equal((await call(`/api/cases/${caseId}`,{method:'PATCH',cookie:second,body:{status:'open',notes:'',outcome:'',evidenceIds:[]}})).status,404);
  assert.equal((await call('/api/bills',{method:'POST',cookie:second,body:{...input,replacesBillId:replacement.result.id}})).status,400);
  assert.equal((await call('/api/demo',{method:'POST',cookie:first,body:{reset:true}})).status,403);
  assert.equal((await call(`/api/bills/${billId}`,{method:'DELETE',cookie:first})).status,200);
  assert.equal((await call(`/api/files/${source.evidenceFileId}`,{cookie:first})).status,200,'case captured evidence is retained');
  const invalid=new FormData();invalid.set('kind','bill');invalid.set('file',new Blob(['not a PDF']), 'fake.pdf');assert.equal((await call('/api/upload',{method:'POST',cookie:first,body:invalid})).status,400);
  const unreadable=await upload(first,'bill','unreadable.pdf');assert.equal(Object.keys(unreadable.fields).length,0);assert.equal((await call('/api/bills',{method:'POST',cookie:first,body:{...input,billMonth:'2026-10-01',evidenceFileId:unreadable.evidenceFileId}})).status,201);
  const demo=await call('/api/demo',{method:'POST',body:{reset:false}});assert.equal(demo.status,201,JSON.stringify(demo.result));accounts.push(demo.cookie);
  const demonstration=(await call('/api/overview',{cookie:demo.cookie})).result;assert.equal(demonstration.isDemo,true);assert.equal(demonstration.bills.length,2);assert.ok(demonstration.findings.some(finding=>finding.id.endsWith(':units')));
  assert.equal((await call('/api/demo',{method:'POST',cookie:demo.cookie,body:{reset:true}})).status,200);
  assert.equal((await call('/api/overview',{cookie:demo.cookie})).result.bills.length,2);
  assert.equal((await call('/api/household',{method:'DELETE',cookie:first})).status,200);assert.equal((await call('/api/overview',{cookie:first})).status,401);
  console.log('Passed: OCR/preview, correction provenance, compatible observations, case snapshot/export, edits/replacements, tenant isolation, manual recovery, separate/resettable demo, deletion.');
}finally{for(const cookie of accounts)await call('/api/household',{method:'DELETE',cookie});}
