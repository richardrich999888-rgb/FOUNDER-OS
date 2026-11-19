import { getDb } from '@/db';
import { accounts,aiRequests,agentExecutionReceipts,agentRuns } from '@/db/schema';
import { and,eq } from 'drizzle-orm';
import { z } from 'zod';
import { emptyState,event,seedMemories,assertOrigin } from '@/lib/twin/core';
import {identity,load,json,fail,modelStatus} from '@/lib/twin/server';
export const dynamic='force-dynamic';
const id=z.string().uuid(),text=z.string().trim().min(1).max(2000),category=z.enum(['Goal','Preference','Context','Routine','People']);
const schema=z.discriminatedUnion('action',[
 z.object({action:z.literal('initialize'),name:z.string().trim().min(1).max(60)}),
 z.object({action:z.literal('memory.add'),text,category}),
 z.object({action:z.literal('memory.update'),id,text,category}),z.object({action:z.literal('memory.confirm'),id}),z.object({action:z.literal('memory.delete'),id}),
 z.object({action:z.literal('task.add'),title:z.string().trim().min(1).max(300),due:z.string().datetime().nullable()}),z.object({action:z.literal('task.toggle'),id}),z.object({action:z.literal('task.delete'),id}),
 z.object({action:z.literal('document.add'),name:z.string().trim().min(1).max(160),text:z.string().trim().min(1).max(60000)}),z.object({action:z.literal('document.delete'),id}),
 z.object({action:z.literal('profile.update'),name:z.string().trim().min(1).max(60),aiConsent:z.boolean()}),z.object({action:z.literal('erase'),confirmation:z.literal('DELETE MY DATA')}),
]);
export async function GET(){try{const user=await identity(),data=await load(user.userId);return json({...data,initialized:!!data,model:modelStatus()});}catch(e){return fail(e);}}
export async function POST(request:Request){try{
 assertOrigin(request.headers.get('origin'),request.url);const user=await identity();
 if(Number(request.headers.get('content-length')||0)>100000)return json({error:'This upload is too large.'},413);
 const raw=await request.text();if(raw.length>100000)return json({error:'This upload is too large.'},413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 const parsed=schema.safeParse(body);if(!parsed.success)return json({error:parsed.error.issues[0]?.message||'Please check the fields.'},400);
 const data=parsed.data,db=getDb(),current=await load(user.userId);
 if(data.action==='initialize'){
  if(current)return json({...current,initialized:true,model:modelStatus()});
  const state=emptyState(data.name),now=new Date().toISOString();state.memories=seedMemories.map(m=>({...m,id:crypto.randomUUID(),source:'Onboarding example',status:'suggested',createdAt:now,updatedAt:now}));event(state,'Your twin was created','Four example memories are ready for review.');
  await db.insert(accounts).values({userId:user.userId,state:JSON.stringify(state),version:0}).onConflictDoNothing();return json({...await load(user.userId),initialized:true,model:modelStatus()});
 }
 if(!current)return json({error:'Start your twin first.'},409);if((body as {version?:unknown}).version!==current.version)return json({error:'Your twin changed in another tab. Refresh and try again.'},409);
 const state=structuredClone(current.state),now=new Date().toISOString();
 if(data.action==='erase'){const deleted=await db.delete(accounts).where(and(eq(accounts.userId,user.userId),eq(accounts.version,current.version))).returning();if(!deleted.length)return json({error:'Your data changed. Refresh before deleting.'},409);await db.delete(aiRequests).where(eq(aiRequests.userId,user.userId));await db.delete(agentExecutionReceipts).where(eq(agentExecutionReceipts.userId,user.userId));await db.delete(agentRuns).where(eq(agentRuns.userId,user.userId));return json({initialized:false,model:modelStatus()});}
 if(data.action==='memory.add'){if(state.memories.length>=300)return json({error:'The prototype supports up to 300 memories.'},400);state.memories.unshift({id:crypto.randomUUID(),text:data.text,category:data.category,source:'You told Twin',status:'confirmed',createdAt:now,updatedAt:now});event(state,'Memory added','Confirmed by you.');}
 if(data.action.startsWith('memory.')&&data.action!=='memory.add'){const item=state.memories.find(m=>m.id===('id'in data?data.id:''));if(!item)return json({error:'Memory not found.'},404);
  if(data.action==='memory.delete'){state.memories=state.memories.filter(m=>m.id!==data.id);event(state,'Memory forgotten','Removed from active memory.');}
  if(data.action==='memory.confirm'){item.status='confirmed';item.updatedAt=now;event(state,'Memory confirmed','Available for personal context.');}
  if(data.action==='memory.update'){item.text=data.text;item.category=data.category;item.status='confirmed';item.updatedAt=now;event(state,'Memory updated','Your correction replaced the previous version.');}
 }
 if(data.action==='task.add'){if(state.tasks.length>=200)return json({error:'The prototype supports up to 200 tasks.'},400);state.tasks.unshift({id:crypto.randomUUID(),title:data.title,due:data.due,status:'open',createdAt:now});event(state,'Task added','Saved in your task list. No background notification was scheduled.');}
 if(data.action==='task.toggle'||data.action==='task.delete'){const item=state.tasks.find(t=>t.id===data.id);if(!item)return json({error:'Task not found.'},404);if(data.action==='task.delete'){state.tasks=state.tasks.filter(t=>t.id!==data.id);event(state,'Task removed');}else{item.status=item.status==='open'?'done':'open';event(state,item.status==='done'?'Task marked complete':'Task reopened','Updated by you.');}}
 if(data.action==='document.add'){if(state.documents.length>=30)return json({error:'The prototype supports up to 30 documents.'},400);state.documents.unshift({id:crypto.randomUUID(),name:data.name,text:data.text,createdAt:now});event(state,'Document imported','Searchable text saved in your private account.');}
 if(data.action==='document.delete'){if(!state.documents.some(d=>d.id===data.id))return json({error:'Document not found.'},404);state.documents=state.documents.filter(d=>d.id!==data.id);event(state,'Document deleted','Removed from active search.');}
 if(data.action==='profile.update'){state.name=data.name;state.aiConsent=data.aiConsent;event(state,'Preferences updated',data.aiConsent?'AI context sharing allowed when a model is configured.':'AI context sharing is off.');}
 const updated=await db.update(accounts).set({state:JSON.stringify(state),version:current.version+1}).where(and(eq(accounts.userId,user.userId),eq(accounts.version,current.version))).returning();if(!updated.length)return json({error:'Your twin changed in another tab. Refresh and try again.'},409);
 return json({state,version:current.version+1,initialized:true,model:modelStatus()});
 }catch(e){return fail(e);}}
