// Genuine provider inference. The two negative cases lower the REQUEST token cap
// to provoke real truncation; no provider response or tool result is fabricated.
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHarness} from '../tests/helpers/security-harness.mjs';
if(!process.env.TWIN_AGENT_ENDPOINT||!process.env.TWIN_AGENT_MODEL||!process.env.TWIN_LIVE_REPORT)process.exit(2);
const realFetch=globalThis.fetch,h=await createHarness('live-provider-completion'),authFetch=globalThis.fetch;
Object.assign(h.env,{TWIN_AGENT_ENDPOINT:process.env.TWIN_AGENT_ENDPOINT,TWIN_AGENT_MODEL:process.env.TWIN_AGENT_MODEL,TWIN_AGENT_API_KEY:process.env.TWIN_AGENT_API_KEY});
let active,observations=[];
globalThis.fetch=async(url,options)=>{
 if(String(url)!==h.env.TWIN_AGENT_ENDPOINT)return authFetch(url,options);
 const body=JSON.parse(options.body),call=observations.length+1;
 const reduced=active==='selection-cap'||(active==='answer-cap'&&call>=2);
 if(reduced)body.max_tokens=1;
 const response=await realFetch(url,{...options,body:JSON.stringify(body)});
 // Inspect only terminal metadata for the report. Return the original response.
 const metadata=await response.clone().json();
 observations.push({call,requestedMaxTokens:body.max_tokens,finishReason:metadata.choices?.[0]?.finish_reason??null,httpStatus:response.status,usage:metadata.usage??null});
 return response;
};
const rows=[];
try {
 for(const id of ['selection-cap','answer-cap','complete-control']) {
  const owner=`provider-completion-${id}`;
  assert.equal((await h.call(owner,{action:'initialize',name:'Synthetic'})).status,200);
  let account=await h.call(owner);
  assert.equal((await h.call(owner,{action:'profile.update',name:'Synthetic',aiConsent:true,version:account.version,expectedGeneration:account.generation})).status,200);
  account=await h.call(owner);
  assert.equal((await h.call(owner,{action:'memory.add',text:'I prefer concise answers.',category:'Preference',version:account.version,expectedGeneration:account.generation})).status,200);
  active=id;observations=[];
  const requestId=crypto.randomUUID(),start=performance.now();
  const r=await h.agentCall(owner,{mode:'model',requestId,message:'Search personal memory for concise answers.'});
  const receipts=h.db.sql.prepare('SELECT status FROM agent_execution_receipts WHERE request_id=?').all(requestId);
  const run=h.db.sql.prepare('SELECT status,error_code,output_tokens FROM agent_runs WHERE request_id=?').get(requestId);
  const truncated=observations.some(x=>x.finishReason==='length'),read=receipts.some(x=>x.status==='succeeded');
  const pass=id==='complete-control'?
   r.httpStatus===200&&read&&(r.sources?.length??0)>0&&!truncated:
   truncated&&r.httpStatus===503&&r.text===null&&(r.sources?.length??0)===0&&r.execution?.errorCode==='MODEL_INCOMPLETE_RESPONSE'&&run?.status==='failed'&&(id==='selection-cap'?receipts.length===0:read);
  rows.push({id,pass,httpStatus:r.httpStatus,grounding:r.execution?.grounding,errorCode:r.execution?.errorCode,sourceCount:r.sources?.length??0,answerReleased:r.text!==null,receiptStatuses:receipts.map(x=>x.status),run,modelCalls:observations,latencyMs:performance.now()-start});
 }
} finally {globalThis.fetch=realFetch;}
const report={measuredAt:new Date().toISOString(),category:'Genuine local model inference through signed synthetic JWT, API and SQLite D1 adapter',model:process.env.TWIN_AGENT_MODEL,providerCharge:0,
 scope:'Two request-cap truncation probes and one complete-response control; production token/deadline limits unchanged; no response substitution; not hosted or general answer-quality evaluation',rows};
await fs.writeFile(process.env.TWIN_LIVE_REPORT,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));process.exitCode=rows.length===3&&rows.every(x=>x.pass)?0:1;
