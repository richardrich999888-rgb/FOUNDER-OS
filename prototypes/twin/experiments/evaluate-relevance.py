"""Standalone genuine cross-encoder experiment; kernel-isolated, synthetic only."""
import os,json,hashlib,time,runpy
runpy.run_path(os.path.join(os.path.dirname(__file__),'network-sandbox.py'))['block_new_network_connections']()
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()
from tokenizers import Tokenizer
root=os.environ['RERANKER_DIR'];path=os.path.join(root,'model.onnx')
assert hashlib.sha256(open(path,'rb').read()).hexdigest()=='5d3e70fd0c9ff14b9b5169a51e957b7a9c74897afd0a35ce4bd318150c1d4d4a'
assert hashlib.sha256(open(os.path.join(root,'tokenizer.json'),'rb').read()).hexdigest()=='d241a60d5e8f04cc1b2b3e9ef7a4921b27bf526d9f6050ab90f9267a1f9e5c66'
tok=Tokenizer.from_file(os.path.join(root,'tokenizer.json'));tok.enable_padding();tok.enable_truncation(max_length=512)
opts=ort.SessionOptions();opts.intra_op_num_threads=2
session=ort.InferenceSession(path,sess_options=opts,providers=['CPUExecutionProvider'])
fixtures=[]
for name in ['intelligence-challenge-v1','semantic-holdout-v1','relevance-near-misses-v1']:
 raw=open('tests/fixtures/'+name+'.json','rb').read();assert hashlib.sha256(raw).hexdigest()==open('tests/fixtures/'+name+'.sha256').read().strip();fixtures.append(json.loads(raw))
corpus=fixtures[0]['corpus'];cases=[dict(q,partition='old-challenge') for q in fixtures[0]['queries']]+[dict(q,partition='holdout') for q in fixtures[1]['queries']]+[{'query':q,'target':None,'partition':'near-miss'} for q in fixtures[2]['queries']]
rows=[]
for q in cases:
 start=time.perf_counter();e=tok.encode_batch([(q['query'],c['text']) for c in corpus]);data={'input_ids':np.array([x.ids for x in e],dtype=np.int64),'attention_mask':np.array([x.attention_mask for x in e],dtype=np.int64),'token_type_ids':np.array([x.type_ids for x in e],dtype=np.int64)}
 scores=session.run(None,{x.name:data[x.name] for x in session.get_inputs()})[0].reshape(-1);order=[int(i) for i in np.argsort(-scores) if scores[i]>=0][:5]
 rank=next((k+1 for k,i in enumerate(order) if corpus[i]['id']==q['target']),0) if q['target'] else None
 rows.append({**q,'rank':rank,'abstained':not order,'topLogit':float(scores.max()),'latencyMs':(time.perf_counter()-start)*1000,'selectedIds':[corpus[i]['id'] for i in order]})
metrics={}
for partition in ['old-challenge','holdout','near-miss']:
 pos=[r for r in rows if r['partition']==partition and r['target']];neg=[r for r in rows if r['partition']==partition and not r['target']]
 metrics[partition]={'positives':len(pos),'recallAt5':sum(r['rank']>0 for r in pos)/len(pos) if pos else None,'negativeCount':len(neg),'abstentions':sum(r['abstained'] for r in neg)}
report={'model':'cross-encoder/ms-marco-MiniLM-L6-v2','revision':'233902d25c440f23af6f7d6e94d2946bac0bee0a','minimumLogit':0,'thresholdSelection':'fixed zero-logit cutoff selected before evaluation; not tuned on these cases','category':'standalone real local relevance inference, no generative planner or application integration','networkIsolation':'seccomp before native imports','metrics':metrics,'rows':rows}
open('../../docs/intelligence/final-reliability/relevance-experiment.json','w').write(json.dumps(report,indent=2)+'\n');print(json.dumps(metrics))
