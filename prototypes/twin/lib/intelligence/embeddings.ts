import { z } from "zod";
import { eligibleRecords } from "./retrieval";
import { recordText, type Snapshot } from "./model";
import { AgentError } from "../agent/errors";

/** Optional server-owned provider. No persistent vectors or cross-account cache. */
export type EmbeddingPort = Readonly<{
  minimumScore: number;
  embed(texts: readonly string[], signal: AbortSignal): Promise<readonly (readonly number[])[]>;
}>;
const vector = z.array(z.number().finite()).min(1).max(2048);
const responseSchema = z.object({data:z.array(z.object({index:z.number().int().nonnegative(),embedding:vector})).min(1).max(65)});
export function createEmbeddingPort(env: Record<string,string|undefined>, fetchImpl: typeof fetch = fetch): EmbeddingPort | undefined {
  const endpoint=env.TWIN_EMBEDDING_ENDPOINT, model=env.TWIN_EMBEDDING_MODEL;
  if (!endpoint && !model && !env.TWIN_EMBEDDING_MIN_SCORE) return undefined;
  const minimumScore=Number(env.TWIN_EMBEDDING_MIN_SCORE);
  if (!endpoint || !model || !env.TWIN_EMBEDDING_MIN_SCORE || !Number.isFinite(minimumScore) || minimumScore <= 0 || minimumScore > 1)
    throw new AgentError("MODEL_UNAVAILABLE");
  const url=new URL(endpoint), loopback=["127.0.0.1","localhost","[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || !(url.protocol === "https:" || (loopback && url.protocol === "http:"))) throw new AgentError("MODEL_UNAVAILABLE");
  // Existing AI consent names the configured inference provider. Do not silently add a
  // second remote recipient. Loopback experiments remain on this machine.
  if (!loopback && (!env.TWIN_AGENT_ENDPOINT || new URL(env.TWIN_AGENT_ENDPOINT).origin !== url.origin))
    throw new AgentError("MODEL_UNAVAILABLE");
  return Object.freeze({minimumScore,async embed(texts: readonly string[],signal: AbortSignal){
    if (!texts.length || texts.length>65 || texts.some(t=>!t.trim() || t.length>4000) || texts.join('').length>64000) throw new AgentError("TOOL_RESULT_TOO_LARGE");
    const headers:Record<string,string>={"Content-Type":"application/json"};
    if(env.TWIN_EMBEDDING_API_KEY)headers.Authorization=`Bearer ${env.TWIN_EMBEDDING_API_KEY}`;
    const r=await fetchImpl(endpoint,{method:"POST",headers,body:JSON.stringify({model,input:texts}),redirect:"manual",signal});
    if(!r.ok || !r.body)throw new AgentError("MODEL_UNAVAILABLE");
    const reader=r.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    try {while(true){const c=await reader.read();if(c.done)break;size+=c.value.byteLength;if(size>1_000_000){await reader.cancel();throw new AgentError("MODEL_MALFORMED_RESPONSE");}chunks.push(c.value);}}finally{reader.releaseLock();}
    const bytes=new Uint8Array(size);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.length;}
    const parsed=responseSchema.safeParse(JSON.parse(new TextDecoder().decode(bytes)));
    if(!parsed.success || parsed.data.data.length!==texts.length)throw new AgentError("MODEL_MALFORMED_RESPONSE");
    const rows=parsed.data.data.sort((a,b)=>a.index-b.index), dimension=rows[0].embedding.length;
    if(rows.some((r,i)=>r.index!==i || r.embedding.length!==dimension || !r.embedding.some(n=>n!==0)))throw new AgentError("MODEL_MALFORMED_RESPONSE");
    return rows.map(r=>r.embedding);
  }});
}

/** Ranking is advisory: retrieveContext reapplies every owner/provenance/temporal gate. */
export async function embeddingScores(s: Snapshot, query: string, port: EmbeddingPort, signal: AbortSignal) {
  const candidates=eligibleRecords(s).filter(r=>r.kind!=="source" && r.kind!=="revision" && !(r.content?.kind==="procedure" && r.content.status!=="active"));
  if(!candidates.length)return new Map<string,number>();
  if(candidates.length>64)throw new AgentError("TOOL_RESULT_TOO_LARGE");
  const vectors=await port.embed([query,...candidates.map(recordText)],signal);
  if(vectors.length!==candidates.length+1)throw new AgentError("MODEL_MALFORMED_RESPONSE");
  const cosine=(a:readonly number[],b:readonly number[])=>{
    if(a.length!==b.length || !a.length || [...a,...b].some(n=>!Number.isFinite(n)))throw new AgentError("MODEL_MALFORMED_RESPONSE");
    const norm=Math.sqrt(a.reduce((n,v)=>n+v*v,0)*b.reduce((n,v)=>n+v*v,0));
    const score=a.reduce((n,v,i)=>n+v*b[i],0)/norm;
    if(!Number.isFinite(score))throw new AgentError("MODEL_MALFORMED_RESPONSE");return Math.max(-1,Math.min(1,score));
  };
  return new Map(candidates.map((r,i)=>[r.id,cosine(vectors[0],vectors[i+1])]).filter(([,v])=>(v as number)>=port.minimumScore) as [string,number][]);
}
