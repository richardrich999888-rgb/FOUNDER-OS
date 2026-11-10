// Real embeddings + controlled planner through the actual JWT/API/runtime/receipt path.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createHarness} from '../tests/helpers/security-harness.mjs';
if(!process.env.TWIN_EMBEDDING_ENDPOINT)process.exit(2);
const original=globalThis.fetch,h=await createHarness('semantic-evaluation'),authFetch=globalThis.fetch;
Object.assign(h.env,{TWIN_AGENT_ENDPOINT:'https://controlled.test/v1/chat/completions',TWIN_AGENT_MODEL:'controlled-planner',TWIN_EMBEDDING_ENDPOINT:process.env.TWIN_EMBEDDING_ENDPOINT,TWIN_EMBEDDING_MODEL:'all-MiniLM-L6-v2',TWIN_EMBEDDING_MIN_SCORE:'.31'});
let query='',plannerCalls=0,embeddingCalls=0;
globalThis.fetch=(url,opts)=>{
 if(String(url)===h.env.TWIN_EMBEDDING_ENDPOINT){embeddingCalls++;return original(url,opts);}
 if(String(url)===h.env.TWIN_AGENT_ENDPOINT){plannerCalls++;const b=JSON.parse(opts.body);const message=b.messages.some(m=>m.role==='tool')?{content:'Use the retrieved passages directly.'}:{content:null,tool_calls:[{id:'lookup',type:'function',function:{name:'search_personal_memory',arguments:JSON.stringify({query})}}]};return Promise.resolve(new Response(JSON.stringify({choices:[{message,finish_reason:message.tool_calls?'tool_calls':'stop'}]})));}
 return authFetch(url,opts);
};
const baseRaw=await fs.readFile('tests/fixtures/intelligence-challenge-v1.json'),holdRaw=await fs.readFile('tests/fixtures/semantic-holdout-v1.json');
for(const [raw,path] of [[baseRaw,'intelligence-challenge-v1'],[holdRaw,'semantic-holdout-v1']])assert.equal(createHash('sha256').update(raw).digest('hex'),(await fs.readFile(`tests/fixtures/${path}.sha256`,'utf8')).trim());
const base=JSON.parse(baseRaw),holdout=JSON.parse(holdRaw),rows=[];
try{
 for(const [index,c] of [...base.queries.map(q=>({...q,partition:'previous-challenge'})),...holdout.queries.map(q=>({...q,partition:'new-holdout'}))].entries()){
  const owner=`semantic-eval-${index}`;await h.call(owner,{action:'initialize',name:'Synthetic'});const a=await h.call(owner);await h.call(owner,{action:'profile.update',name:'Synthetic',aiConsent:true,version:a.version});const ids=new Map();
  for(const item of base.corpus){let s=await h.intelligenceCall(owner);const r=await h.intelligenceCall(owner,{action:'propose',epoch:s.epoch,text:item.text,quote:item.text,label:'Synthetic evaluation',content:{kind:'fact',factType:'context',text:item.text,key:item.id,subjectId:null,value:null,rationale:null}});assert.equal(r.status,200);s=await h.intelligenceCall(owner);const f=s.records.find(r=>r.kind==='fact'&&r.content.key===item.id);assert.ok(f);assert.equal((await h.intelligenceCall(owner,{action:'confirm',epoch:s.epoch,id:f.id})).status,200);ids.set(item.id,f.id);}
  query=c.query;const start=performance.now(),requestId=crypto.randomUUID(),r=await h.agentCall(owner,{mode:'model',message:query,requestId});
  const rank=c.target?(r.sources??[]).findIndex(s=>s.sourceId.startsWith(`intelligence:${ids.get(c.target)}:`))+1:null;
  const receipts=h.db.sql.prepare('SELECT status FROM agent_execution_receipts WHERE request_id=?').all(requestId);
  rows.push({partition:c.partition,query,target:c.target,rank,abstained:r.execution?.grounding==='no_evidence',httpStatus:r.httpStatus,errorCode:r.execution?.errorCode??null,sourceCount:r.sources?.length??0,receiptStatuses:receipts.map(r=>r.status),latencyMs:performance.now()-start});
 }
}finally{globalThis.fetch=original;}
const metrics={};for(const partition of ['previous-challenge','new-holdout']){const rr=rows.filter(r=>r.partition===partition&&r.target);const negatives=rows.filter(r=>r.partition===partition&&!r.target);metrics[partition]={positiveCount:rr.length,recallAt5:rr.filter(r=>r.rank>0).length/rr.length,mrr:rr.reduce((n,r)=>n+(r.rank?1/r.rank:0),0)/rr.length,negativeCount:negatives.length,abstentions:negatives.filter(r=>r.abstained).length};}
const result={measuredAt:new Date().toISOString(),category:'actual local embeddings; controlled planner; actual verified JWT, API, authorization, D1 adapter and receipts; not real generative model',model:'all-MiniLM-L6-v2',minimumScore:.31,telemetry:'ONNX platform telemetry explicitly disabled before session creation',thresholdSelection:'ceil((maximum of 12 separately listed calibration-negative similarities + .05)*100)/100; no positive labels in formula',plannerCalls,embeddingCalls,metrics,rows,providerCharge:0};
await fs.writeFile('../../docs/intelligence/continuation/semantic-results.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(metrics));
assert.ok(rows.every(r=>r.httpStatus===200&&r.receiptStatuses.includes('succeeded')));
