export type Memory = { id:string; text:string; category:string; source:string; status:'confirmed'|'suggested'; createdAt:string; updatedAt:string };
export type Task = { id:string; title:string; due:string|null; status:'open'|'done'; createdAt:string };
export type Document = { id:string; name:string; text:string; createdAt:string };
export type Event = { id:string; title:string; detail:string; at:string };
export type State = { name:string; aiConsent:boolean; createdAt:string; memories:Memory[]; tasks:Task[]; documents:Document[]; activity:Event[] };
export type Proposal = { type:'memory'|'task'; text:string; category?:string };
/** Grounding outcome reported by the agent runtime (lib/agent/runtime.ts). */
export type Grounding = 'cited'|'no_evidence'|'not_required'|'evidence_fallback'|'none';
export type ReplyExecution = { grounding:Grounding; answerSource:'model'|'runtime_abstention'|'runtime_evidence_fallback'|null; toolExecutions:number };
export type Reply = { text:string; mode:'memory'|'ai'; sources:{label:string;excerpt:string}[]; proposal?:Proposal; execution?:ReplyExecution };
/**
 * User-facing label for a reply. Live AI answers state whether they were checked against the
 * user's saved information, so an uncited model answer is never presented like a cited one.
 * Any unrecognised or missing grounding value fails closed to the "not checked" label.
 */
export function replyLabel(reply:Pick<Reply,'mode'|'execution'>):string{
 if(reply.mode==='memory')return 'Memory mode';
 switch(reply.execution?.grounding){
  case 'cited':return 'AI answer · cites your saved information';
  case 'evidence_fallback':return 'Excerpts from your saved information';
  case 'no_evidence':return 'Not found in your saved information';
  default:return 'AI answer · not checked against your saved information';
 }
}
// Generic examples only. No private account data is distributed with this source.
export const seedMemories = [
 {text:'I prefer concise answers.',category:'Preference'},
 {text:'I want help keeping track of commitments.',category:'Goal'},
 {text:'I prefer to review proposed actions before they are saved.',category:'Preference'},
 {text:'I want to organize notes and documents.',category:'Goal'},
];
export function emptyState(name='Friend'):State {return {name,aiConsent:false,createdAt:new Date().toISOString(),memories:[],tasks:[],documents:[],activity:[]};}
export function event(state:State,title:string,detail=''){state.activity.unshift({id:crypto.randomUUID(),title,detail,at:new Date().toISOString()});state.activity=state.activity.slice(0,300);}
const stopWords=new Set('what which that this with from about your mine have know does the and are for you me my is to of in a an i can do please tell show'.split(' '));
/**
 * Light, deterministic suffix stripping so inflections match ("meetings"/"meeting"/"meet",
 * "preference"/"prefer", "writing"/"write"). Applied identically to queries and records, so
 * consistency matters more than linguistic accuracy. First matching rule wins; a rule applies
 * only if the remaining stem keeps >= MIN_STEM characters. Not a full Porter stemmer.
 */
const MIN_STEM=3;
const SUFFIX_RULES:[string,string][]=[['ings',''],['ing',''],['ences',''],['ence',''],['ances',''],['ance',''],['ies','y'],['ied','y'],['ly',''],['es',''],['ed',''],['s','']];
export function stem(word:string){
 let w=word;
 for(const [suffix,replacement] of SUFFIX_RULES){if(w.endsWith(suffix)&&w.length-suffix.length>=MIN_STEM){w=w.slice(0,-suffix.length)+replacement;break;}}
 if(w.length>MIN_STEM&&w.endsWith('e'))w=w.slice(0,-1);
 return w;
}
export function tokens(text:string){return [...new Set((text.toLowerCase().match(/[\p{L}\p{N}]+/gu)||[]).filter(x=>x.length>1&&!stopWords.has(x)).map(stem))];}
/** Retrieved record with stable provenance. `sourceId` is an opaque, non-sensitive identifier. */
export type RetrievedRecord = { kind:'memory'|'document'; sourceId:string; label:string; excerpt:string; createdAt:string; updatedAt:string; score:number };
/** Maximum number of passages returned by deterministic retrieval. */
export const RETRIEVAL_LIMIT = 5;
/** Maximum characters per document passage (documents are split on blank lines, then chunked). */
export const PASSAGE_CHARS = 650;
/**
 * Deterministic lexical retrieval over confirmed memories and user-imported documents.
 * Score = number of distinct query tokens present in the record. Ties keep corpus order
 * (Array.prototype.sort is stable), so results are reproducible for identical state.
 * Suggested (unconfirmed) memories are never searchable.
 */
export function retrieveWithProvenance(query:string,state:State):RetrievedRecord[]{
 const words=tokens(query);
 const memoryRecords=state.memories.filter(m=>m.status==='confirmed').map(m=>({kind:'memory' as const,sourceId:`memory:${m.id}`,label:`${m.category} · ${m.source}`,excerpt:m.text,createdAt:m.createdAt,updatedAt:m.updatedAt}));
 const documentRecords=state.documents.flatMap(d=>d.text.split(/\n\s*\n/).flatMap(p=>p.match(new RegExp(`[\\s\\S]{1,${PASSAGE_CHARS}}`,'g'))||[]).map((excerpt,index)=>({kind:'document' as const,sourceId:`document:${d.id}#${index}`,label:d.name,excerpt,createdAt:d.createdAt,updatedAt:d.createdAt})));
 return [...memoryRecords,...documentRecords].map(r=>({...r,score:words.filter(w=>tokens(r.excerpt).includes(w)).length})).filter(r=>r.score>0).sort((a,b)=>b.score-a.score).slice(0,RETRIEVAL_LIMIT);
}
/** Backwards-compatible retrieval used by Memory mode: label and excerpt only. */
export function retrieve(query:string,state:State){
 return retrieveWithProvenance(query,state).map(({label,excerpt})=>({label,excerpt}));
}
export function memoryReply(input:string,state:State):Reply {
 const message=input.trim();const remember=message.match(/^(?:remember(?: that)?|save (?:this|a) memory\s*:?)[\s:]+([\s\S]+)/i);
 if(remember)return {text:'Review this before adding it to your memory. You can edit or forget it later.',mode:'memory',sources:[],proposal:{type:'memory',text:remember[1].slice(0,2000),category:'Preference'}};
 const task=message.match(/^(?:add (?:a )?task|create (?:a )?task|remind me to)[\s:]+([\s\S]+)/i);
 if(task)return {text:'I prepared a task for your list. Choose a date when you review it. This prototype tracks tasks in the app; it does not send background reminders.',mode:'memory',sources:[],proposal:{type:'task',text:task[1].slice(0,300)}};
 if(/(what.*know.*(?:me|myself)|show.*memor|my profile)/i.test(message)){const memories=state.memories.filter(m=>m.status==='confirmed');return {text:memories.length?`Here is what you have confirmed:\n\n${memories.map(m=>`• ${m.text}`).join('\n')}\n\nYou can correct or remove any of these in Memory.`:'I do not have any confirmed memories yet. Review the starter memories or tell me “Remember that…” to begin.',mode:'memory',sources:memories.slice(0,8).map(m=>({label:m.source,excerpt:m.text}))};}
 if(/\b(tasks|briefing|today|my day)\b/i.test(message)){const tasks=state.tasks.filter(t=>t.status==='open');return {text:tasks.length?`You have ${tasks.length} open task${tasks.length===1?'':'s'}:\n\n${tasks.slice(0,12).map(t=>`• ${t.title}${t.due?` — ${t.due}`:''}`).join('\n')}\n\nThese are your saved tasks, not a synced calendar.`:'Your task list is clear. Tell me “Add a task: …” to prepare your first one.',mode:'memory',sources:[]};}
 const sources=retrieve(message,state);return sources.length?{text:`I found these relevant passages in the information you saved:\n\n${sources.map((s,i)=>`[${i+1}] ${s.excerpt}`).join('\n\n')}\n\nMemory mode retrieves your saved text; it does not generate a new answer.`,mode:'memory',sources}:{text:'I could not find that in your confirmed memories or documents. Add the information, ask about your saved tasks, or enable a live AI model in Settings once it is connected. I won’t invent missing details.',mode:'memory',sources:[]};
}
export function assertOrigin(origin:string|null,url:string){if(!origin||origin!==new URL(url).origin)throw new Error('ORIGIN');}
export function calendarFile(task:Task){
 if(!task.due||!Number.isFinite(Date.parse(task.due)))throw new Error('Choose a date and time first.');
 const escape=(s:string)=>s.replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
 const format=(d:Date)=>d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}/,'');const start=new Date(task.due),end=new Date(start.getTime()+30*60000);
 return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Twin//Personal agent//EN','BEGIN:VEVENT',`UID:${task.id}@twin`,`DTSTAMP:${format(new Date())}`,`DTSTART:${format(start)}`,`DTEND:${format(end)}`,`SUMMARY:${escape(task.title)}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
}
