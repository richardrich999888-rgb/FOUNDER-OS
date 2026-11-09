import fs from 'node:fs/promises';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createHarness,config} from './helpers/security-harness.mjs';
const raw=await fs.readFile('tests/fixtures/intelligence-challenge-v1.json','utf8'), hash=createHash('sha256').update(raw).digest('hex');
assert.equal(hash,(await fs.readFile('tests/fixtures/intelligence-challenge-v1.sha256','utf8')).trim());
const fixture=JSON.parse(raw), h=await createHarness('challenge'), svc=h.modules['intelligence-service'],store=h.modules['intelligence-store'],retrieval=h.modules['intelligence-retrieval'];
await h.call('challenge',{action:'initialize',name:'Synthetic challenge'});
const u=await h.modules.identity.createIdentityAdapter(config)(new Headers({'Cf-Access-Jwt-Assertion':await h.token('challenge')}));
async function mutate(p){const s=await store.readSnapshot(u,h.db.d1);return svc.mutateIntelligence(u,{epoch:s.epoch,...p},h.db.d1);}
const ids=new Map();for(const c of fixture.corpus){const r=await mutate({action:'propose',text:c.text,quote:c.text,label:'Independent synthetic challenge',content:{kind:'fact',factType:'context',text:c.text,key:c.id,subjectId:null,value:null,rationale:null}});const f=r.snapshot.records.find(x=>r.ids.includes(x.id)&&x.kind==='fact');await mutate({action:'confirm',id:f.id});ids.set(c.id,f.id);}
const snapshot=await store.readSnapshot(u,h.db.d1),legacy=h.modules.core.emptyState('Synthetic');
legacy.memories=fixture.corpus.map(c=>({id:ids.get(c.id),text:c.text,category:'Context',source:'Synthetic',status:'confirmed',createdAt:snapshot.legacy.createdAt,updatedAt:snapshot.legacy.createdAt}));
const rows=[];
for(const [i,q] of fixture.queries.entries())for(const mode of ['legacy','structured','hybrid']){
 const start=performance.now();const result=mode==='legacy'?h.modules.core.retrieve(q.query,legacy):retrieval.retrieveContext(snapshot,{query:q.query,mode}).results;
 const rank=result.findIndex(r=>mode==='legacy'?r.excerpt===fixture.corpus.find(c=>c.id===q.target).text:r.id===ids.get(q.target))+1;
 rows.push({id:i,partition:i<12?'literal':'paraphrase',mode,rank,latencyMs:performance.now()-start});
}
const gates=[];const id=ids.get('deck');
for(const [name,patch] of Object.entries({foreignOwner:{owner:'other'},foreignGeneration:{generation:'other'},proposed:{confirmation:'proposed'},deleted:{validity:'deleted'},superseded:{validity:'superseded'},restricted:{privacy:'restricted'},future:{validFrom:'2199-01-01T00:00:00Z'},expired:{validTo:'2000-01-01T00:00:00Z'},badStart:{validFrom:'invalid'},badEnd:{validTo:'invalid'},emptyQuote:{quote:''},wrongKind:{kind:'commitment'},falseQuote:{quote:'nonexistent span'}})){
 const s=structuredClone(snapshot);Object.assign(s.records.find(r=>r.id===id),patch);gates.push({name,pass:!retrieval.retrieveContext(s,{query:'Orion pitch deck indigo'}).results.some(r=>r.id===id)});
}
const metrics={};for(const mode of ['legacy','structured','hybrid']){const rr=rows.filter(r=>r.mode===mode);metrics[mode]={n:rr.length,recallAt5:rr.filter(r=>r.rank>0&&r.rank<=5).length/rr.length,mrr:rr.reduce((a,r)=>a+(r.rank?1/r.rank:0),0)/rr.length};}
const result={measuredAt:new Date().toISOString(),fixtureHash:hash,scope:fixture.authorship,category:'deterministic retrieval; no LLM',metrics,gates,rows,semanticTargetMet:metrics.hybrid.recallAt5>=0.9,paidInferenceCostUsd:0};
await fs.writeFile('../../docs/intelligence/remediation/challenge-results.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({metrics,gatesPassed:gates.filter(x=>x.pass).length,gatesTotal:gates.length,semanticTargetMet:result.semanticTargetMet}));
assert.ok(gates.every(x=>x.pass),'critical gates must pass');
// Exit 0 denotes completed measurement, not semantic target acceptance; target is explicit above.
