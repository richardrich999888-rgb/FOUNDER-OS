// Offline aggregate instrumentation. Keep consented observations outside the repository.
import fs from 'node:fs/promises';
import {z} from 'zod';
const count=z.number().int().nonnegative();
const schema=z.array(z.object({
  participant:z.string().min(1),workflow:z.string().min(1),consent:z.literal(true),
  baselineSteps:count.positive(),assistedSteps:count,setupSteps:count,
  baselineSeconds:z.number().positive(),assistedSeconds:z.number().nonnegative(),
  baselineCompleted:z.boolean(),assistedCompleted:z.boolean(),reviewPreserved:z.boolean(),
  unauthorizedActions:count,commitmentsExpected:count,commitmentsCapturedCorrectly:count,
  missedCommitments:count,corrections:count,returnedWeek2:z.boolean(),willingToPay:z.boolean(),
}).strict()).min(1);
export function score(input){
 const rows=schema.parse(input),keys=new Set();
 for(const r of rows){const k=JSON.stringify([r.participant,r.workflow]);if(keys.has(k))throw Error('Duplicate pair');keys.add(k);if(r.commitmentsCapturedCorrectly>r.commitmentsExpected)throw Error('Invalid capture count');}
 const mean=fn=>rows.reduce((a,r)=>a+fn(r),0)/rows.length;
 const sum=key=>rows.reduce((a,r)=>a+r[key],0);
 const people=[...new Set(rows.map(r=>r.participant))];
 const reduction=mean(r=>(r.baselineSteps-r.assistedSteps-r.setupSteps)/r.baselineSteps);
 return {pairs:rows.length,participants:people.length,meanStepReductionIncludingSetup:reduction,
 meanTimeReduction:mean(r=>(r.baselineSeconds-r.assistedSeconds)/r.baselineSeconds),
 baselineCompletionRate:mean(r=>Number(r.baselineCompleted)),assistedCompletionRate:mean(r=>Number(r.assistedCompleted)),
 commitmentCaptureAccuracy:sum('commitmentsExpected')?sum('commitmentsCapturedCorrectly')/sum('commitmentsExpected'):null,
 missedCommitments:sum('missedCommitments'),corrections:sum('corrections'),
 weeklyReturnParticipants:people.filter(p=>rows.some(r=>r.participant===p&&r.returnedWeek2)).length,
 willingToPayParticipants:people.filter(p=>rows.some(r=>r.participant===p&&r.willingToPay)).length,
 exploratoryTargetMet:people.length>=10&&reduction>=.25&&mean(r=>Number(r.assistedCompleted))>=mean(r=>Number(r.baselineCompleted))&&rows.every(r=>r.reviewPreserved&&r.unauthorizedActions===0),
 limitation:'Exploratory paired observations; not causal or population-level commercial validation.'};
}
if(process.argv[1]?.endsWith('score-private-alpha.mjs')){
 if(!process.argv[2])throw Error('Provide a consented JSON observation file; no default synthetic results.');
 console.log(JSON.stringify(score(JSON.parse(await fs.readFile(process.argv[2],'utf8'))),null,2));
}
