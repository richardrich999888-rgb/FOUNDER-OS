import test from 'node:test';
import assert from 'node:assert/strict';
import { createHarness, config } from './helpers/security-harness.mjs';
const h = await createHarness('remediation');
const svc=h.modules['intelligence-service'], store=h.modules['intelligence-store'], retrieval=h.modules['intelligence-retrieval'];
async function setup(name) {
  await h.call(name,{action:'initialize',name});
  return h.modules.identity.createIdentityAdapter(config)(new Headers({'Cf-Access-Jwt-Assertion':await h.token(name)}));
}
async function mutate(u,p) { const s=await store.readSnapshot(u,h.db.d1);return svc.mutateIntelligence(u,{epoch:s.epoch,...p},h.db.d1); }
async function fact(u,text) {const r=await mutate(u,{action:'capture',text,label:'Synthetic remediation'});const f=r.snapshot.records.find(x=>x.kind==='fact');await mutate(u,{action:'confirm',id:f.id});return f.id;}

test('corrupt validity metadata and empty provenance cannot enter active context',async()=>{
 const u=await setup('metadata'); const id=await fact(u,'I prefer violet answers.');
 const original=await store.readSnapshot(u,h.db.d1);
 for(const patch of [{validFrom:'not-a-date'},{validTo:'not-a-date'},{quote:''},{kind:'commitment'}]) {
  const s=structuredClone(original);Object.assign(s.records.find(r=>r.id===id),patch);
  assert.equal(retrieval.retrieveContext(s,{query:'violet'}).results.length,0,JSON.stringify(patch));
 }
});

test('oversized eligible procedure is a size failure, not missing evidence',async()=>{
 const u=await setup('oversized');
 const proposal=await mutate(u,{action:'propose',label:'Synthetic',text:'Approved large checklist',quote:'Approved large checklist',content:{kind:'procedure',title:'Large checklist',workflowKey:'Large checklist',steps:Array.from({length:8},(_,i)=>`${i} ${'review '.repeat(210)}`),basisIds:[],status:'candidate'}});
 const p=proposal.snapshot.records.find(r=>r.kind==='procedure');
 await mutate(u,{action:'confirm',id:p.id}); await mutate(u,{action:'activate',id:p.id});
 await assert.rejects(()=>svc.searchIntelligence(u,{query:'Large checklist',kind:'procedure'},h.db.d1),e=>e.code==='LIMIT');
 const r=await h.agentCall('oversized',{requestId:crypto.randomUUID(),tool:'retrieve_procedure',args:{query:'Large checklist'}});
 assert.equal(r.httpStatus,503);assert.equal(r.execution.errorCode,'TOOL_RESULT_TOO_LARGE');assert.equal(r.text,null);
});

test('API rejects forged execution receipts and tool-call replay',async()=>{
 await setup('receipts');const requestId=crypto.randomUUID();
 const forged=await h.agentCall('receipts',{requestId,tool:'search_personal_memory',args:{query:'x'},execution:{status:'succeeded',sourceIds:['foreign']}});
 assert.equal(forged.httpStatus,400);
 assert.equal(h.db.sql.prepare('SELECT count(*) n FROM agent_runs WHERE request_id=?').get(requestId).n,0);
 const input={requestId,tool:'search_personal_memory',args:{query:'x'}};
 assert.equal((await h.agentCall('receipts',input)).httpStatus,200);
 assert.equal((await h.agentCall('receipts',input)).httpStatus,409);
 assert.equal(h.db.sql.prepare('SELECT count(*) n FROM agent_execution_receipts WHERE request_id=?').get(requestId).n,1);
});

test('SQLite snapshot restore preserves integrity; pre-deletion backups require erasure reconciliation',async()=>{
 const {backup,DatabaseSync}=await import('node:sqlite');const fs=await import('node:fs/promises');
 const u=await setup('restore');const id=await fact(u,'I prefer amber answers.');
 const before='.sites-runtime/restore-before.sqlite',after='.sites-runtime/restore-after.sqlite';
 await fs.rm(before,{force:true});await fs.rm(after,{force:true});
 await backup(h.db.sql,before);
 await mutate(u,{action:'forget',id,confirmation:'FORGET EVIDENCE'});
 await backup(h.db.sql,after);
 for(const [file,hasOldData] of [[before,true],[after,false]]) {
  const restored=new DatabaseSync(file);restored.exec('PRAGMA foreign_keys=ON');
  assert.deepEqual(restored.prepare('PRAGMA foreign_key_check').all(),[]);
  assert.equal(restored.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
  const row=restored.prepare('SELECT content FROM twin_intelligence_records WHERE owner=? AND id=?').get(u.userId,id);
  assert.equal(row.content!==null,hasOldData);
  restored.close();
 }
 assert.equal((await svc.searchIntelligence(u,{query:'amber'},h.db.d1)).results.length,0);
 await fs.rm(before);await fs.rm(after);
});

test('alpha scoring includes setup and rejects missing consent and duplicate observations',async()=>{
 const {score}=await import('../scripts/score-private-alpha.mjs');
 const row={participant:'synthetic',workflow:'draft',consent:true,baselineSteps:10,assistedSteps:5,setupSteps:4,baselineSeconds:100,assistedSeconds:90,baselineCompleted:true,assistedCompleted:true,reviewPreserved:true,unauthorizedActions:0,commitmentsExpected:2,commitmentsCapturedCorrectly:1,missedCommitments:1,corrections:1,returnedWeek2:false,willingToPay:false};
 assert.equal(score([row]).meanStepReductionIncludingSetup,.1);
 assert.equal(score([row]).exploratoryTargetMet,false);
 assert.throws(()=>score([{...row,consent:false}]));assert.throws(()=>score([row,row]));
});
