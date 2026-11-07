// Exercises the real route handlers with an in-memory D1 adapter and a simulated dispatch identity.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
const dir=path.resolve('.sites-runtime/handler-tests');await fs.mkdir(dir,{recursive:true});
await fs.writeFile(path.join(dir,'context.mjs'),`export let current=null; export const setUser=(id)=>current=id?{userId:id,email:'qa@example.test',displayName:'QA',fullName:null}:null; export async function getChatGPTUser(){return current;}`);
await fs.writeFile(path.join(dir,'env.mjs'),'export const env = {};');
await fs.writeFile(path.join(dir,'db.mjs'),`import { DatabaseSync } from 'node:sqlite';import {drizzle} from 'drizzle-orm/d1';import fs from 'node:fs';const sql=new DatabaseSync(':memory:');sql.exec(fs.readFileSync('drizzle/0000_last_chameleon.sql','utf8'));class Statement{constructor(query,args=[]){this.query=query;this.args=args;}bind(...args){return new Statement(this.query,args);}async all(){const stmt=sql.prepare(this.query);const results=stmt.all(...this.args);return {results,success:true,meta:{changes:sql.prepare('SELECT changes() as n').get().n}};}async run(){return this.all();}async raw(){const stmt=sql.prepare(this.query);stmt.setReturnArrays(true);return stmt.all(...this.args);}async first(column){const result=sql.prepare(this.query).get(...this.args);return column?result?.[column]:result;}}const d1={prepare:q=>new Statement(q),batch:async statements=>Promise.all(statements.map(s=>s.all()))};const db=drizzle(d1);export const getDb=()=>db;`);
const files={'schema.mjs':'db/schema.ts','core.mjs':'lib/twin/core.ts','server.mjs':'lib/twin/server.ts','twin.mjs':'app/api/twin/route.ts','chat.mjs':'app/api/chat/route.ts'};
const aliases={'cloudflare:workers':'./env.mjs','@/app/chatgpt-auth':'./context.mjs','@/db/schema':'./schema.mjs','@/db':'./db.mjs','@/lib/twin/core':'./core.mjs','@/lib/twin/server':'./server.mjs'};
for(const [out,input] of Object.entries(files)){let source=await fs.readFile(input,'utf8');for(const [from,to] of Object.entries(aliases))source=source.replaceAll(`'${from}'`,`'${to}'`);await fs.writeFile(path.join(dir,out),ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText);}
const context=await import(path.join(dir,'context.mjs')),route=await import(path.join(dir,'twin.mjs')),chat=await import(path.join(dir,'chat.mjs'));
async function call(user,payload,origin='https://twin.test',isChat=false){context.setUser(user);const req=new Request(`https://twin.test/api/${isChat?'chat':'twin'}`,payload?{method:'POST',headers:{...(origin?{Origin:origin}:{}),'Content-Type':'application/json'},body:JSON.stringify(payload)}:undefined);const r=await (isChat?chat.POST(req):payload?route.POST(req):route.GET());return {status:r.status,...await r.json()};}
let a,b,mid;
test('API security and persistence flow',async t=>{
 await t.test('anonymous read rejected',async()=>assert.equal((await call(null)).status,401));
 await t.test('missing Origin rejected',async()=>assert.equal((await call('a',{action:'initialize',name:'QA'},null)).status,403));
 await t.test('cross-origin write rejected',async()=>assert.equal((await call('a',{action:'initialize',name:'QA'},'https://evil.test')).status,403));
 await t.test('authenticated setup persists suggested memories',async()=>{a=await call('a',{action:'initialize',name:'QA'});assert.equal(a.status,200);assert.equal(a.state.memories.length,4);assert.ok(a.state.memories.every(m=>m.status==='suggested'));});
 await t.test('other user cannot read account',async()=>{b=await call('b');assert.equal(b.initialized,false);});
 await t.test('chat ignores unconfirmed facts',async()=>{const r=await call('a',{message:'What do you know about me?',mode:'memory',requestId:crypto.randomUUID()},undefined,true);assert.equal(r.status,200);assert.equal(r.sources.length,0);});
 await t.test('memory saved',async()=>{a=await call('a',{action:'memory.add',text:'QA colour preference is moss green.',category:'Preference',version:a.version});assert.equal(a.status,200);mid=a.state.memories[0].id;});
 await t.test('memory recalled with source',async()=>{const r=await call('a',{message:'moss green',mode:'memory',requestId:crypto.randomUUID()},undefined,true);assert.equal(r.status,200);assert.match(r.text,/moss green/);assert.ok(r.sources.length);});
 await t.test('stale updates rejected',async()=>assert.equal((await call('a',{action:'memory.confirm',id:mid,version:0})).status,409));
 await t.test('cross-user IDs cannot mutate records',async()=>{b=await call('b',{action:'initialize',name:'Other QA'});assert.equal((await call('b',{action:'memory.delete',id:mid,version:b.version})).status,404);});
 await t.test('document import persists',async()=>{a=await call('a',{action:'document.add',name:'qa.txt',text:'Project cedar has a Friday review.',version:a.version});assert.equal(a.status,200);});
 await t.test('document recall cites filename',async()=>{const r=await call('a',{message:'cedar',mode:'memory',requestId:crypto.randomUUID()},undefined,true);assert.equal(r.sources[0].label,'qa.txt');});
 await t.test('dated task persists',async()=>{a=await call('a',{action:'task.add',title:'QA rehearsal',due:'2026-11-09T10:00:00Z',version:a.version});assert.equal(a.status,200);assert.equal(a.state.tasks.length,1);});
 await t.test('completion persists',async()=>{a=await call('a',{action:'task.toggle',id:a.state.tasks[0].id,version:a.version});assert.equal(a.state.tasks[0].status,'done');});
 await t.test('memory deletion removes retrieval',async()=>{a=await call('a',{action:'memory.delete',id:mid,version:a.version});const r=await call('a',{message:'moss green',mode:'memory',requestId:crypto.randomUUID()},undefined,true);assert.equal(r.sources.length,0);});
 await t.test('unconfigured AI fails explicitly',async()=>assert.equal((await call('a',{message:'hello',mode:'ai',requestId:crypto.randomUUID()},undefined,true)).status,503));
 await t.test('erase requires exact confirmation',async()=>assert.equal((await call('a',{action:'erase',confirmation:'yes',version:a.version})).status,400));
 await t.test('account erasure removes all active data',async()=>{assert.equal((await call('a',{action:'erase',confirmation:'DELETE MY DATA',version:a.version})).status,200);assert.equal((await call('a')).initialized,false);assert.equal((await call('b')).initialized,true);});
});
