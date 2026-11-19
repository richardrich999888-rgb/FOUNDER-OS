import { env } from 'cloudflare:workers';
import { z } from 'zod';
import { getDb } from '@/db';
import { assertOrigin,memoryReply } from '@/lib/twin/core';
import { identity,load,json,fail,modelStatus } from '@/lib/twin/server';
import { createD1Admission } from '@/lib/agent/admission';
import { systemClock } from '@/lib/agent/deadline';
import { handleLiveAiRequest } from '@/lib/agent/live-ai';
import { createOpenAIResponsesModel } from '@/lib/agent/model-adapter';
import { createD1ReceiptStore } from '@/lib/agent/receipts';
export const dynamic='force-dynamic';
const bodySchema=z.object({message:z.string().trim().min(1).max(4000),mode:z.enum(['memory','ai']),requestId:z.string().uuid()});
export async function POST(request:Request){try{
 assertOrigin(request.headers.get('origin'),request.url);const user=await identity(),raw=await request.text();if(raw.length>10000)return json({error:'Please keep your message under 4,000 characters.'},413);
 let body:unknown;try{body=JSON.parse(raw);}catch{return json({error:'Invalid request.'},400);}
 const parsed=bodySchema.safeParse(body);if(!parsed.success)return json({error:'Please enter a valid message.'},400);
 const data=await load(user.userId);if(!data)return json({error:'Start your twin first.'},409);const {message,mode,requestId}=parsed.data;
 if(mode==='memory')return json(memoryReply(message,data.state));
 if(!modelStatus().configured)return json({error:'Live AI is not connected yet. Memory mode works now.'},503);if(!data.state.aiConsent)return json({error:'Enable AI context sharing in Settings first.'},403);
 // Composition root: adapters are bound here; all policy lives in lib/agent.
 const vars=env as unknown as Record<string,string>,db=getDb();
 const outcome=await handleLiveAiRequest(
  {identity:{userId:user.userId},aiContextConsent:data.state.aiConsent,message,requestId},
  {admission:createD1Admission(db),model:createOpenAIResponsesModel({apiKey:vars.OPENAI_API_KEY,model:vars.OPENAI_MODEL}),
   corpus:{loadCorpus:async(userId)=>{const owned=await load(userId);return owned?{memories:owned.state.memories,documents:owned.state.documents}:null;}},
   receipts:createD1ReceiptStore(db),clock:systemClock,newId:()=>crypto.randomUUID()});
 return json(outcome.body,outcome.status);
 }catch(e){return fail(e);}}
