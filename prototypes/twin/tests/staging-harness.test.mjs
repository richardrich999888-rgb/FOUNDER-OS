import test from 'node:test';
import assert from 'node:assert/strict';
import {hosted, prerequisites} from '../scripts/staging-security.mjs';

// These unsigned strings exercise the staging driver only. No real Access claim
// is made here; application JWT verification is covered by the security suites.
const fakeToken = (sub, extra={}) => Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT',kid:'fixture'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub,type:'app',nbf:Math.floor(Date.now()/1000)-60,iss:'https://staging-fixture.cloudflareaccess.com',aud:['a'.repeat(64)],iat:Math.floor(Date.now()/1000)-60,exp:Math.floor(Date.now()/1000)+600,...extra})).toString('base64url')+'.fixture';
function inputs(){return {config:{environment:'staging',syntheticOnly:true,authorizedSyntheticWrites:true,suite:'p0-003',baseURL:'https://gateway.test',directURL:'https://worker.test',expectedCommit:'b'.repeat(40),issuer:'https://staging-fixture.cloudflareaccess.com',audience:'a'.repeat(64),cloudflareAccountId:'c'.repeat(32),stagingDatabaseId:'11111111-1111-4111-8111-111111111111',deploymentEvidenceReference:'synthetic-driver-test',legacyMarker:'TWIN-STAGING-LEGACY-FIXTURE'},env:{TWIN_STAGING_JWT_A:fakeToken('a'),TWIN_STAGING_JWT_B:fakeToken('b'),TWIN_STAGING_JWT_A_REFRESH:fakeToken('a',{nonce:2}),TWIN_STAGING_JWT_B_REFRESH:fakeToken('b',{nonce:2}),TWIN_STAGING_JWT_LEGACY:fakeToken('legacy'),TWIN_STAGING_JWT_EXPIRED:fakeToken('a',{iat:0,nbf:0,exp:1}),TWIN_STAGING_JWT_WRONG_ISSUER:fakeToken('a',{iss:'https://other-fixture.cloudflareaccess.com'}),TWIN_STAGING_JWT_WRONG_AUDIENCE:fakeToken('a',{aud:['d'.repeat(64)]}),TWIN_STAGING_CF_API_TOKEN:'SYNTHETIC_SECRET_TOKEN'}};}
const migrations=['0000_last_chameleon.sql','0001_persistent_intelligence.sql','0002_verified_agent_runtime.sql'];
function sqlReply(init){const {sql}=JSON.parse(init.body);return Response.json({success:true,result:[{success:true,results:sql.startsWith('SELECT name')?migrations.map(name=>({name})):[]}]});}

test('staging refuses to mutate an account initialized concurrently by another request',async()=>{
 const {config,env}=inputs(),writes=[];let initialized=false;
 const raced={state:{name:'TWIN-STAGING-A-different-run',memories:[]},generation:'foreign-generation',version:7,initialized:true};
 const report=await hosted(config,env,async(url,init)=>{
  if(String(url).startsWith('https://api.cloudflare.com/'))return sqlReply(init);
  if(init.headers['Cf-Access-Jwt-Assertion']!==env.TWIN_STAGING_JWT_A || !String(url).endsWith('/api/twin'))return Response.json({}, {status:401});
  if(init.method==='GET')return Response.json(initialized?raced:{initialized:false,generationPrecondition:true});
  const body=JSON.parse(init.body);
  if(body.action==='initialize'){initialized=true;return Response.json(raced);}
  writes.push(body.action);return Response.json(body.action==='erase'?{initialized:false}:{}, {status:body.action==='erase'?200:500});
 });
 assert.equal(report.status,'FAIL');assert.deepEqual(writes,[],'must not seed or erase the concurrently initialized account');
});

test('staging unexpected transport errors cannot leak uppercase credentials in reports',async()=>{
 const {config,env}=inputs();
 const report=await hosted(config,env,async()=>{throw Error(env.TWIN_STAGING_CF_API_TOKEN);});
 assert.equal(report.status,'FAIL');assert.doesNotMatch(JSON.stringify(report),/SYNTHETIC_SECRET_TOKEN/);
});

test('missing, production, ambiguous or malformed staging inputs never reach a transport',async()=>{
 const {config,env}=inputs();
 const variants=[undefined,null,[],{...config,environment:'production'},{...config,authorizedSyntheticWrites:false},{...config,suite:'p0-004'},
  {...config,directURL:config.baseURL},{...config,baseURL:config.baseURL+'/'},{...config,baseURL:'http://gateway.test'},
  {...config,baseURL:'https://user:pass@gateway.test'},{...config,baseURL:'https://gateway.test/private'},
  {...config,baseURL:'https://gateway.test/?secret=1'},{...config,expectedCommit:'PRIVATE_TOKEN'}];
 for(const candidate of variants){let calls=0;const r=await hosted(candidate,env,async()=>{calls++;});assert.equal(r.status,'BLOCKED');assert.equal(calls,0);assert.doesNotMatch(JSON.stringify(r),/PRIVATE_TOKEN|user:pass/);}
 for(const patch of [{TWIN_STAGING_JWT_B:env.TWIN_STAGING_JWT_A},{TWIN_STAGING_JWT_A:fakeToken('a',{exp:1})},
  {TWIN_STAGING_JWT_A:'x.'+Buffer.from('null').toString('base64url')+'.x'},{TWIN_STAGING_JWT_A:'PRIVATE\r\nHEADER'},
  {TWIN_STAGING_JWT_WRONG_ISSUER:'not-a-token'},{TWIN_STAGING_JWT_WRONG_AUDIENCE:fakeToken('a',{aud:['d'.repeat(64)],exp:1})},{TWIN_STAGING_CF_API_TOKEN:undefined},{TWIN_STAGING_JWT_A_REFRESH:env.TWIN_STAGING_JWT_A}]){
  let calls=0;const r=await hosted(config,{...env,...patch},async()=>{calls++;});assert.equal(r.status,'BLOCKED');assert.equal(calls,0);
 }
 assert.deepEqual(prerequisites(config,env),[]);
});

test('bounded staging reads reject oversized byte streams and cancel the source',async()=>{
 const {requestJSON}=await import('../scripts/staging-security.mjs');let cancelled=false;
 const stream=new ReadableStream({pull(c){c.enqueue(new Uint8Array(17));},cancel(){cancelled=true;}});
 await assert.rejects(()=>requestJSON('https://gateway.test',{},async()=>new Response(stream),{maxBytes:16,timeoutMs:1000}),e=>e.message==='RESPONSE_TOO_LARGE');
 assert.equal(cancelled,true);
});

test('staging deadline covers both a stalled transport and a stalled response stream',async()=>{
 const {requestJSON}=await import('../scripts/staging-security.mjs');let cancelled=false,signal;
 await assert.rejects(()=>requestJSON('https://gateway.test',{},async(_u,o)=>{signal=o.signal;return new Promise(()=>{});},{timeoutMs:20}),e=>e.message==='REQUEST_TIMEOUT');
 assert.equal(signal.aborted,true);
 const stream=new ReadableStream({start(){},cancel(){cancelled=true;}});
 await assert.rejects(()=>requestJSON('https://gateway.test',{},async()=>new Response(stream),{timeoutMs:20}),e=>e.message==='REQUEST_TIMEOUT');
 assert.equal(cancelled,true);
});

test('staging redirects remain observations and never cause credential forwarding',async()=>{
 const {requestJSON}=await import('../scripts/staging-security.mjs');let calls=0;
 const r=await requestJSON('https://gateway.test',{headers:{Authorization:'Bearer SYNTHETIC'}},async(url,init)=>{
  calls++;assert.equal(url,'https://gateway.test');assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.test'}});
 });
 assert.equal(r.status,302);assert.equal(calls,1);
});

test('direct Worker redirects, unconfigured 503s, disclosures and competing migrations fail',async()=>{
 for(const mode of ['redirect','unconfigured','disclosure','chat-disclosure','migration']){
  const {config,env}=inputs();let writes=0;
  const r=await hosted(config,env,async(url,init)=>{
   if(String(url).startsWith('https://api.cloudflare.com/')){
    if(mode==='migration'&&JSON.parse(init.body).sql.startsWith('SELECT name'))return Response.json({success:true,result:[{success:true,results:[...migrations,'0001_agent_receipts.sql'].map(name=>({name}))}]});
    return sqlReply(init);
   }
   if(init.method==='POST'&&String(url).endsWith('/api/twin'))writes++;
   const direct=String(url).startsWith(config.directURL);
   return Response.json(mode==='disclosure'?{state:{private:'SYNTHETIC_PRIVATE_MEMORY'}}:mode==='chat-disclosure'?{text:'SYNTHETIC_PRIVATE_MEMORY'}:{},{status:direct?(mode==='redirect'?302:mode==='unconfigured'?503:401):401});
  });
  assert.equal(r.status,'FAIL',mode);assert.equal(writes,0);assert.doesNotMatch(JSON.stringify(r),/SYNTHETIC_PRIVATE_MEMORY/);
 }
});

test('cleanup refuses changed generations, names or versions, and uses CAS for last-moment races',async()=>{
 for(const mode of ['generation','name','version','cas','aba']){
  const {config,env}=inputs();let state,created=false,stop=false,eraseCalls=0;
  const r=await hosted(config,env,async(url,init)=>{
   if(String(url).startsWith('https://api.cloudflare.com/'))return sqlReply(init);
   const jwt=init.headers['Cf-Access-Jwt-Assertion'];
   if(jwt===env.TWIN_STAGING_JWT_B && String(url).endsWith('/api/twin') && init.method==='GET'){
    stop=true;return Response.json({initialized:true}); // force cleanup of A after seeding
   }
   if(jwt!==env.TWIN_STAGING_JWT_A || !String(url).endsWith('/api/twin'))return Response.json({}, {status:401});
   if(init.method==='GET'){
    if(!created)return Response.json({initialized:false,generationPrecondition:true});
    const view=structuredClone(state);
    if(stop){if(mode==='generation')view.generation='2'.repeat(32);if(mode==='name')view.state.name='TWIN-STAGING-A-different';if(mode==='version')view.version++;}
    return Response.json(view);
   }
   const b=JSON.parse(init.body);
   if(b.action==='initialize'){created=true;state={state:{name:b.name,memories:[]},generation:'1'.repeat(32),version:0};return Response.json(state);}
   if(b.action==='memory.add'){assert.equal(b.expectedGeneration,state.generation);state.version=1;state.state.memories=[{id:crypto.randomUUID(),text:b.text}];return Response.json(state);}
   if(b.action==='erase'){eraseCalls++;assert.equal(b.version,1);assert.equal(b.expectedGeneration,'1'.repeat(32));if(mode==='aba')state.generation='2'.repeat(32);return Response.json({}, {status:409});}
   throw Error('unexpected fixture request');
  });
  assert.equal(r.status,'FAIL');assert.equal(eraseCalls,['cas','aba'].includes(mode)?1:0,mode);
  assert.equal(r.checks.find(x=>x.id==='cleanup-A').status,'FAIL');
 }
});

test('complete staging driver exercises real signed identities, API handlers, SQL receipts and safe cleanup locally',async()=>{
 const realFetch=globalThis.fetch;
 const {createHarness,issuer}=await import('./helpers/security-harness.mjs');
 const path=await import('node:path');
 const h=await createHarness('staging-flow');
 try {
  const {config,env}=inputs();config.issuer=issuer;
  env.TWIN_STAGING_JWT_A=await h.token('stage-a');env.TWIN_STAGING_JWT_B=await h.token('stage-b');
  env.TWIN_STAGING_JWT_A_REFRESH=await h.token('stage-a',{nonce:2});env.TWIN_STAGING_JWT_B_REFRESH=await h.token('stage-b',{nonce:2});
  env.TWIN_STAGING_JWT_LEGACY=await h.token('verified-staging-legacy');
  const now=Math.floor(Date.now()/1000);
  env.TWIN_STAGING_JWT_EXPIRED=await h.token('stage-a',{iat:now-600,nbf:now-600,exp:now-120});
  env.TWIN_STAGING_JWT_WRONG_ISSUER=await h.token('stage-a',{iss:'https://other-fixture.cloudflareaccess.com',aud:['e'.repeat(64)]});
  env.TWIN_STAGING_JWT_WRONG_AUDIENCE=await h.token('stage-a',{aud:['d'.repeat(64)]});
  h.env.TWIN_AUTH_ACCOUNT_LINKS=JSON.stringify([{subject:'verified-staging-legacy',accountId:'legacy-fixture-account'}]);
  const legacy=h.modules.core.emptyState('Synthetic legacy');
  legacy.memories.push({id:crypto.randomUUID(),text:config.legacyMarker,category:'Context',status:'confirmed',source:'Synthetic',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  h.db.sql.prepare('INSERT INTO twin_accounts(user_id,state,version) VALUES(?,?,?)').run('legacy-fixture-account',JSON.stringify(legacy),7);
  h.db.sql.exec('CREATE TABLE d1_migrations(id INTEGER PRIMARY KEY,name TEXT NOT NULL)');
  migrations.forEach((name,index)=>h.db.sql.prepare('INSERT INTO d1_migrations VALUES(?,?)').run(index+1,name));
  const dir=path.resolve('.sites-runtime/security-staging-flow');
  const context=await import(path.join(dir,'context.mjs'));
  const routes=Object.fromEntries(await Promise.all([['/api/twin','twin'],['/api/intelligence','intelligence-route'],['/api/agent','agent-route'],['/api/chat','chat']].map(async([url,file])=>[url,await import(path.join(dir,file+'.mjs'))])));
  let requests=0;
  const report=await hosted(Object.freeze(config),env,async(url,init)=>{
   requests++;assert.equal(init.redirect,'manual');
   if(String(url).startsWith('https://api.cloudflare.com/')){
    assert.equal(init.headers.Authorization,'Bearer '+env.TWIN_STAGING_CF_API_TOKEN);
    const {sql,params=[]}=JSON.parse(init.body);assert.match(sql,/^(SELECT|PRAGMA foreign_key_check)/);
    return Response.json({success:true,result:[{success:true,results:h.db.sql.prepare(sql).all(...params)}]});
   }
   const parsed=new URL(url);assert.ok([config.baseURL,config.directURL].includes(parsed.origin));
   assert.equal(init.headers.Authorization,undefined);
   if(parsed.origin===config.directURL)assert.equal(init.headers.Cookie,undefined);
   const request=new Request(url,init),route=routes[parsed.pathname];assert.ok(route);
   return context.run(request.headers,()=>init.method==='POST'?route.POST(request):route.GET());
  });
  assert.equal(report.status,'PASS',JSON.stringify(report));assert.ok(requests>56);
  assert.equal(report.hostedReadiness,'BLOCKED_PENDING_MANUAL_GATES');
  assert.deepEqual(report.checks.filter(x=>x.id.startsWith('cleanup-')).map(x=>x.status),['PASS','PASS']);
  assert.equal(h.db.sql.prepare('SELECT count(*) n FROM twin_accounts').get().n,1);
  const preserved=h.db.sql.prepare('SELECT state,version FROM twin_accounts WHERE user_id=?').get('legacy-fixture-account');
  assert.equal(preserved.state,JSON.stringify(legacy));assert.equal(preserved.version,7);
  for(const secret of Object.values(env))assert.equal(JSON.stringify(report).includes(secret),false);
  assert.doesNotMatch(JSON.stringify(report),/legacy-fixture-account|TWIN-STAGING-LEGACY-FIXTURE/);
 } finally {globalThis.fetch=realFetch;}
});

test('staging CLI requires explicit mode and reports missing hosted prerequisites as exit 2',async()=>{
 const {main}=await import('../scripts/staging-security.mjs');
 const originalFetch=globalThis.fetch,originalLog=console.log;let requests=0;const lines=[];
 globalThis.fetch=async()=>{requests++;throw Error('unexpected network');};console.log=x=>lines.push(x);
 try {
  for(const args of [[],['--local','--hosted'],['--unknown'],['--hosted','--report']])assert.equal(await main(args,{}),2);
  assert.equal(await main(['--hosted'],{}),2);
  assert.equal(requests,0);assert.equal(JSON.parse(lines.at(-1)).status,'BLOCKED');
 } finally {globalThis.fetch=originalFetch;console.log=originalLog;}
});

test('a response arriving after a staging timeout is cancelled without reading its body',async()=>{
 const {requestJSON}=await import('../scripts/staging-security.mjs');let resolve,cancelled=false;
 const response=new Response(new ReadableStream({cancel(){cancelled=true;}}));
 const pending=requestJSON('https://gateway.test',{},()=>new Promise(r=>{resolve=r;}),{timeoutMs:20});
 await assert.rejects(pending,e=>e.message==='REQUEST_TIMEOUT');
 resolve(response);await new Promise(r=>setTimeout(r,0));assert.equal(cancelled,true);
});

test('client generation preconditions prevent same-version writes and erasure after account recreation',async()=>{
 const realFetch=globalThis.fetch;
 const {createHarness}=await import('./helpers/security-harness.mjs');
 const h=await createHarness('staging-generation');
 try {
  const outcomes=[];
  for(const action of ['memory.add','erase']){
   const owner='generation-'+action;
   const first=await h.call(owner,{action:'initialize',name:'First synthetic account'});
   assert.equal((await h.call(owner,{action:'erase',confirmation:'DELETE MY DATA',version:0})).status,200);
   const replacement=await h.call(owner,{action:'initialize',name:'Replacement synthetic account'});
   assert.notEqual(replacement.generation,first.generation);
   const stale=await h.call(owner,{action,version:0,expectedGeneration:first.generation,
    text:'STALE_SYNTHETIC_WRITE',category:'Context',confirmation:'DELETE MY DATA'});
   const after=await h.call(owner);
   outcomes.push({action,status:stale.status,preserved:after.generation===replacement.generation && after.version===0});
  }
  assert.deepEqual(outcomes,[{action:'memory.add',status:409,preserved:true},{action:'erase',status:409,preserved:true}]);
  const first=await h.call('current-generation',{action:'initialize',name:'Current synthetic'});
  for(const expectedGeneration of [null,42,{},'']){
   assert.equal((await h.call('current-generation',{action:'erase',confirmation:'DELETE MY DATA',version:0,expectedGeneration})).status,409);
  }
  const saved=await h.call('current-generation',{action:'memory.add',version:0,expectedGeneration:first.generation,text:'CURRENT_SYNTHETIC',category:'Context'});
  assert.equal(saved.status,200);assert.equal(saved.generation,first.generation);
  const next=await h.call('current-generation',{action:'task.add',version:saved.version,expectedGeneration:saved.generation,title:'Safe next save',due:null});
  assert.equal(next.status,200);assert.equal(next.generation,first.generation);
 } finally {globalThis.fetch=realFetch;}
});
