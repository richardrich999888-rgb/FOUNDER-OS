import test from 'node:test';import assert from 'node:assert/strict';
import {createHarness,config} from './helpers/security-harness.mjs';
const h=await createHarness('semantic'),m=n=>h.modules['agent-'+n],emb=h.modules['intelligence-embeddings'],ret=h.modules['intelligence-retrieval'];
async function setup(name,consent=true){await h.call(name,{action:'initialize',name});const a=await h.call(name);await h.call(name,{action:'profile.update',name,aiConsent:consent,version:a.version});return h.modules.identity.createIdentityAdapter(config)(new Headers({'Cf-Access-Jwt-Assertion':await h.token(name)}));}
async function fact(u,text,confirm=true){const svc=h.modules['intelligence-service'],store=h.modules['intelligence-store'];let s=await store.readSnapshot(u,h.db.d1);const r=await svc.mutateIntelligence(u,{action:'capture',text,label:'Synthetic',epoch:s.epoch},h.db.d1);const f=r.snapshot.records.find(x=>r.ids.includes(x.id)&&x.kind==='fact');if(confirm){s=await store.readSnapshot(u,h.db.d1);await svc.mutateIntelligence(u,{action:'confirm',id:f.id,epoch:s.epoch},h.db.d1);}return f.id;}
const env={TWIN_EMBEDDING_ENDPOINT:'http://127.0.0.1:9999/v1/embeddings',TWIN_EMBEDDING_MODEL:'synthetic',TWIN_EMBEDDING_MIN_SCORE:'.31'};
test('semantic candidates remain approved, private and account scoped; score IDs cannot grant access',async()=>{
 const a=await setup('semantic-a'),b=await setup('semantic-b');const id=await fact(a,'I prefer amber answers.');const proposed=await fact(a,'I prefer hidden answers.',false);const foreign=await fact(b,'I prefer foreign answers.');
 const s=await h.modules['intelligence-store'].readSnapshot(a,h.db.d1);let sent=[];
 const scores=await emb.embeddingScores(s,'communication',{minimumScore:.31,embed:async texts=>{sent=texts;return texts.map(()=>[1,0]);}},new AbortController().signal);
 assert.ok(sent.some(t=>t.includes('amber')));assert.ok(!sent.some(t=>t.includes('hidden')||t.includes('foreign')));
 scores.set(foreign,1);scores.set(proposed,1);
 assert.deepEqual(ret.retrieveContext(s,{query:'communication'},Date.now(),scores).results.map(r=>r.id),[id]);
 const deleted=structuredClone(s);deleted.records.find(r=>r.id===id).validity='deleted';assert.equal(ret.retrieveContext(deleted,{query:'communication'},Date.now(),scores).results.length,0);
});
test('embedding provider cannot be invoked by a local-only principal',async()=>{
 const u=await setup('semantic-local',false),p=await m('principal').createVerifiedPrincipal(u,['search_personal_memory'],'local',h.db.d1);let calls=0;
 const tool=m('intelligence-tools').createIntelligenceRegistry(h.db.d1,{minimumScore:.31,embed:async()=>{calls++;return[];}}).get('search_personal_memory');
 await assert.rejects(()=>tool.execute({query:'x'},{principal:p,signal:new AbortController().signal}),e=>e.code==='AUTHORIZATION_REVOKED');assert.equal(calls,0);
});
test('consent revocation during embedding prevents a result',async()=>{
 const u=await setup('semantic-revoke');await fact(u,'I prefer amber answers.');const p=await m('principal').createVerifiedPrincipal(u,['search_personal_memory'],'provider',h.db.d1);
 const port={minimumScore:.31,embed:async texts=>{const a=await h.call('semantic-revoke');await h.call('semantic-revoke',{action:'profile.update',name:'Synthetic',aiConsent:false,version:a.version});return texts.map(()=>[1,0]);}};
 const tool=m('intelligence-tools').createIntelligenceRegistry(h.db.d1,port).get('search_personal_memory');
 await assert.rejects(()=>tool.execute({query:'x'},{principal:p,signal:new AbortController().signal}),e=>e.code==='AUTHORIZATION_REVOKED');
});
test('embedding HTTP adapter rejects redirect, malformed dimensions, duplicate indexes and zero vectors',async()=>{
 for(const body of [{data:[{index:0,embedding:[1]},{index:0,embedding:[1]}]},{data:[{index:0,embedding:[1]},{index:1,embedding:[1,2]}]},{data:[{index:0,embedding:[0]},{index:1,embedding:[1]}]}]){
 const p=emb.createEmbeddingPort(env,async()=>new Response(JSON.stringify(body)));await assert.rejects(()=>p.embed(['a','b'],new AbortController().signal));}
 let calls=0;const p=emb.createEmbeddingPort(env,async(_u,o)=>{calls++;assert.equal(o.redirect,'manual');return new Response('',{status:302,headers:{Location:'https://other.test'}});});
 await assert.rejects(()=>p.embed(['x'],new AbortController().signal));assert.equal(calls,1);
 assert.throws(()=>emb.createEmbeddingPort({...env,TWIN_EMBEDDING_ENDPOINT:'http://other.test'}));
});
test('embedding response size and request capacity are bounded',async()=>{
 let called=0;const p=emb.createEmbeddingPort(env,async()=>{called++;return new Response('x'.repeat(1_000_001));});
 await assert.rejects(()=>p.embed(['x'],new AbortController().signal),e=>e.code==='MODEL_MALFORMED_RESPONSE');
 await assert.rejects(()=>p.embed(Array(66).fill('x'),new AbortController().signal),e=>e.code==='TOOL_RESULT_TOO_LARGE');assert.equal(called,1);
});

test('forgetting during embedding discards old vectors and context',async()=>{
 const u=await setup('semantic-forget'),id=await fact(u,'I prefer amber answers.');const p=await m('principal').createVerifiedPrincipal(u,['search_personal_memory'],'provider',h.db.d1);
 const port={minimumScore:.31,embed:async texts=>{const s=await h.modules['intelligence-store'].readSnapshot(u,h.db.d1);await h.modules['intelligence-service'].mutateIntelligence(u,{action:'forget',epoch:s.epoch,id,confirmation:'FORGET EVIDENCE'},h.db.d1);return texts.map(()=>[1,0]);}};
 const tool=m('intelligence-tools').createIntelligenceRegistry(h.db.d1,port).get('search_personal_memory');
 await assert.rejects(()=>tool.execute({query:'x'},{principal:p,signal:new AbortController().signal}),e=>e.code==='AUTHORIZATION_REVOKED');
});

test('remote embedding configuration cannot introduce a different provider origin',()=>{
 assert.throws(()=>emb.createEmbeddingPort({...env,TWIN_AGENT_ENDPOINT:'https://approved.test/chat',TWIN_EMBEDDING_ENDPOINT:'https://other.test/embeddings'}));
 assert.ok(emb.createEmbeddingPort({...env,TWIN_AGENT_ENDPOINT:'https://approved.test/chat',TWIN_EMBEDDING_ENDPOINT:'https://approved.test/embeddings'}));
});
