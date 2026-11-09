// Genuine model AND embedding inference. Synthetic JWT account; real runtime and receipts.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHarness} from '../tests/helpers/security-harness.mjs';
if(!process.env.TWIN_AGENT_ENDPOINT||!process.env.TWIN_AGENT_MODEL||!process.env.TWIN_EMBEDDING_ENDPOINT)process.exit(2);
const original=globalThis.fetch,h=await createHarness('live-semantic'),auth=globalThis.fetch;
for(const k of ['TWIN_AGENT_ENDPOINT','TWIN_AGENT_MODEL','TWIN_AGENT_API_KEY','TWIN_EMBEDDING_ENDPOINT','TWIN_EMBEDDING_MODEL','TWIN_EMBEDDING_MIN_SCORE','TWIN_EMBEDDING_API_KEY'])h.env[k]=process.env[k];
let modelCalls=0,embeddingCalls=0;globalThis.fetch=(url,opts)=>{if(String(url)===h.env.TWIN_AGENT_ENDPOINT){modelCalls++;return original(url,opts);}if(String(url)===h.env.TWIN_EMBEDDING_ENDPOINT){embeddingCalls++;return original(url,opts);}return auth(url,opts);};
const rows=[];
try{
 const owner='synthetic-semantic-live';await h.call(owner,{action:'initialize',name:'Synthetic'});const a=await h.call(owner);await h.call(owner,{action:'profile.update',name:'Synthetic',aiConsent:true,version:a.version});let s=await h.intelligenceCall(owner);
 const text='The backup drive is kept in cabinet seven.';
 assert.equal((await h.intelligenceCall(owner,{action:'propose',epoch:s.epoch,text,quote:text,label:'Synthetic storage note',content:{kind:'fact',factType:'context',text,key:'drive',subjectId:null,value:null,rationale:null}})).status,200);
 s=await h.intelligenceCall(owner);const fact=s.records.find(r=>r.kind==='fact');assert.equal((await h.intelligenceCall(owner,{action:'confirm',epoch:s.epoch,id:fact.id})).status,200);
 for(const [name,message,expected] of [['paraphrase','Search my personal memories: where is the spare disk?','cited'],['missing','Search my personal memories: what is my passport number?','no_evidence']]){
  const start=performance.now(),requestId=crypto.randomUUID(),r=await h.agentCall(owner,{mode:'model',requestId,message});
  const persisted=h.db.sql.prepare('SELECT status FROM agent_execution_receipts WHERE request_id=?').all(requestId);
  rows.push({name,httpStatus:r.httpStatus,grounding:r.execution?.grounding,errorCode:r.execution?.errorCode,latencyMs:performance.now()-start,usage:r.execution?.usage,receipts:r.execution?.receipts,persistedReceipts:persisted.length,sourceCount:r.sources?.length??0,pass:r.httpStatus===200&&r.execution?.grounding===expected&&persisted.some(r=>r.status==='succeeded')&&(expected!=='cited'||r.sources?.some(s=>s.sourceId===`intelligence:${fact.id}:v1`))});
 }
}finally{globalThis.fetch=original;}
const report={measuredAt:new Date().toISOString(),model:process.env.TWIN_AGENT_MODEL,embeddingModel:process.env.TWIN_EMBEDDING_MODEL,minimumScore:Number(process.env.TWIN_EMBEDDING_MIN_SCORE),category:'genuine model plus genuine embeddings via JWT/API/runtime/SQLite D1 adapter; not hosted staging',modelCalls,embeddingCalls,rows,providerCharge:0};
await fs.writeFile('../../docs/intelligence/continuation/live-semantic.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=rows.length===2&&rows.every(r=>r.pass)&&embeddingCalls>0?0:1;
