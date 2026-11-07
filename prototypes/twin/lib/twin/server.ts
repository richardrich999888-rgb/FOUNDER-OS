import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { accounts } from '@/db/schema';
import { getDb } from '@/db';
import { eq } from 'drizzle-orm';
import type { State } from './core';
export function json(data:unknown,status=200){return Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});}
export async function identity(){const user=await getChatGPTUser();if(!user)throw new Error('AUTH');return user;}
export async function load(userId:string){const [row]=await getDb().select().from(accounts).where(eq(accounts.userId,userId));return row?{state:JSON.parse(row.state) as State,version:row.version}:null;}
export function modelStatus(){const vars=env as unknown as Record<string,string|undefined>;return {configured:Boolean(vars.OPENAI_API_KEY&&vars.OPENAI_MODEL),provider:'OpenAI',model:vars.OPENAI_MODEL||null};}
export function fail(error:unknown){const msg=error instanceof Error?error.message:'';if(msg==='AUTH')return json({error:'Sign in to access your private twin.',signIn:'/signin-with-chatgpt?return_to=%2F'},401);if(msg==='ORIGIN')return json({error:'This request must come from your Twin app.'},403);return json({error:'Your request could not be completed. Please try again.'},500);}
