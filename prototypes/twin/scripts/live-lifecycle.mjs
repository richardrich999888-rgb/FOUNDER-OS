// Genuine model responses with synthetic temporal changes and timed consent revocation.
import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHarness} from '../tests/helpers/security-harness.mjs';
if(!process.env.TWIN_AGENT_ENDPOINT||!process.env.TWIN_AGENT_MODEL)process.exit(2);
const realFetch=globalThis.fetch,h=await createHarness('live-lifecycle'),auth=globalThis.fetch;
Object.assign(h.env,{TWIN_AGENT_ENDPOINT:process.env.TWIN_AGENT_ENDPOINT,TWIN_AGENT_MODEL:process.env.TWIN_AGENT_MODEL,TWIN_AGENT_API_KEY:process.env.TWIN_AGENT_API_KEY});
let modelCalls=0,revokeOnResponse=0,revoked=false;
globalThis.fetch=async(url,opts)=>{
 if(String(url)!==h.env.TWIN_AGENT_ENDPOINT)return auth(url,opts);
 modelCalls++;const response=await realFetch(url,opts);
 if(revokeOnResponse>0 && --revokeOnResponse===0){const a=await h.call('lifecycle-revoke');assert.equal((await h.call('lifecycle-revoke',{action:'profile.update',name:'Synthetic',aiConsent:false,version:a.version})).status,200);revoked=true;}
 return response; // Original provider response is not substituted or edited.
};
async function setup(owner){assert.equal((await h.call(owner,{action:'initialize',name:'Synthetic'})).status,200);const a=await h.call(owner);assert.equal((await h.call(owner,{action:'profile.update',name:'Synthetic',aiConsent:true,version:a.version})).status,200);}
async function command(owner,p){const s=await h.intelligenceCall(owner);const r=await h.intelligenceCall(owner,{epoch:s.epoch,...p});assert.equal(r.status,200);return h.intelligenceCall(owner);}
const rows=[];
try{
 const owner='lifecycle-temporal';await setup(owner);
 let s=await command(owner,{action:'capture',text:'I prefer Monday meetings.',label:'Synthetic old preference'});const old=s.records.find(r=>r.kind==='fact');await command(owner,{action:'confirm',id:old.id});
 s=await command(owner,{action:'capture',text:'I now prefer Thursday meetings.',label:'Synthetic correction'});const current=s.records.find(r=>r.kind==='fact'&&r.confirmation==='proposed');
 assert.equal((await h.intelligenceCall(owner,{action:'confirm',epoch:s.epoch,id:current.id})).status,409);
 await command(owner,{action:'confirm',id:current.id,supersedes:[old.id]});
 let start=performance.now(),r=await h.agentCall(owner,{mode:'model',requestId:crypto.randomUUID(),message:'Search my current meeting preference. Which day do I prefer?'});
 const currentSource=(r.sources??[]).some(s=>s.sourceId.startsWith(`intelligence:${current.id}:`)),oldSource=(r.sources??[]).some(s=>s.sourceId.startsWith(`intelligence:${old.id}:`));
 rows.push({name:'approved-temporal-correction',pass:r.httpStatus===200&&currentSource&&!oldSource&&!/Monday/i.test(r.text??'')&&/Thursday/i.test(r.text??''),httpStatus:r.httpStatus,grounding:r.execution?.grounding,errorCode:r.execution?.errorCode,currentSource,oldSource,mentionsApprovedValue:/Thursday/i.test(r.text??''),latencyMs:performance.now()-start,receipts:r.execution?.receipts});
 await setup('lifecycle-revoke');s=await command('lifecycle-revoke',{action:'capture',text:'I prefer concise answers.',label:'Synthetic revocation'});await command('lifecycle-revoke',{action:'confirm',id:s.records.find(r=>r.kind==='fact').id});
 revokeOnResponse=2;const before=modelCalls;start=performance.now();r=await h.agentCall('lifecycle-revoke',{mode:'model',requestId:crypto.randomUUID(),message:'Search my saved memory for concise answers.'});
 rows.push({name:'consent-revoked-after-evidence-read',pass:revoked&&modelCalls>before&&r.httpStatus===409&&r.execution?.errorCode==='AUTHORIZATION_REVOKED'&&r.execution?.receipts?.some(x=>x.status==='succeeded')&&r.text===null&&(r.sources??[]).length===0,httpStatus:r.httpStatus,errorCode:r.execution?.errorCode,latencyMs:performance.now()-start,modelCalls:modelCalls-before,toolReceipts:r.execution?.receipts?.length??0,sourceCount:(r.sources??[]).length});
}finally{globalThis.fetch=realFetch;}
const report={measuredAt:new Date().toISOString(),model:process.env.TWIN_AGENT_MODEL,category:'genuine inference; synthetic JWT/API/D1-adapter lifecycle; revocation deliberately timed before releasing original provider response',modelCalls,rows,providerCharge:0};
await fs.writeFile('../../docs/intelligence/final-reliability/live-lifecycle.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));process.exitCode=rows.length===2&&rows.every(r=>r.pass)?0:1;
