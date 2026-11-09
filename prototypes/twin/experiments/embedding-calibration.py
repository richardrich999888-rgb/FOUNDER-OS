import json,time,os,hashlib,math
import runpy
runpy.run_path(os.path.join(os.path.dirname(__file__),'network-sandbox.py'))['block_new_network_connections']()
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()  # Must precede session creation; no platform telemetry.
from tokenizers import Tokenizer
assert hashlib.sha256(open(os.path.join(os.environ['MODEL_DIR'],'model.onnx'),'rb').read()).hexdigest()=='6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452'
assert hashlib.sha256(open(os.path.join(os.environ['MODEL_DIR'],'tokenizer.json'),'rb').read()).hexdigest()=='be50c3628f2bf5bb5e3a7f17b1f74611b2561a3a27eeab05e5aa30f411572037'
fixture=json.load(open('tests/fixtures/intelligence-challenge-v1.json'))
tok=Tokenizer.from_file(os.path.join(os.environ['MODEL_DIR'],'tokenizer.json'));tok.enable_truncation(max_length=256);tok.enable_padding()
opt=ort.SessionOptions();opt.intra_op_num_threads=2
start=time.perf_counter();session=ort.InferenceSession(os.path.join(os.environ['MODEL_DIR'],'model.onnx'),sess_options=opt,providers=['CPUExecutionProvider']);load=time.perf_counter()-start

def embed(texts):
 enc=tok.encode_batch(texts); data={'input_ids':np.array([e.ids for e in enc],dtype=np.int64),'attention_mask':np.array([e.attention_mask for e in enc],dtype=np.int64),'token_type_ids':np.array([e.type_ids for e in enc],dtype=np.int64)}
 out=session.run(None,{i.name:data[i.name] for i in session.get_inputs()})[0];mask=data['attention_mask'][...,None];pooled=(out*mask).sum(1)/np.clip(mask.sum(1),1,None);return pooled/np.linalg.norm(pooled,axis=1,keepdims=True)
start=time.perf_counter();corpus=embed([c['text'] for c in fixture['corpus']]);corpusMs=(time.perf_counter()-start)*1000
rows=[]
for q in fixture['queries']:
 start=time.perf_counter();v=embed([q['query']])[0];scores=corpus@v;order=np.argsort(-scores);selected=[i for i in order if scores[i]>=.45][:5];rank=next((k+1 for k,i in enumerate(selected) if fixture['corpus'][i]['id']==q['target']),0);rows.append({'query':q['query'],'target':q['target'],'rank':rank,'topScore':float(scores[order[0]]),'latencyMs':(time.perf_counter()-start)*1000})
negatives=['What is my favourite mountain?','What is my passport number?','Who is my dentist?','What is my bank account balance?','What is my birthday?','What is my blood type?','Who is my spouse?','Which university did I attend?','What is my shoe size?','Where was I born?','What is my dog called?','What is my home address?']
negative=[]
for q in negatives:
 scores=corpus@embed([q])[0];negative.append({'query':q,'maxScore':float(scores.max()),'abstained':bool(scores.max()<.45)})
calibrated=math.ceil((max(r['maxScore'] for r in negative)+.05)*100)/100
report={'calibratedThresholdFromNegatives':calibrated,'calibrationMargin':.05,'model':'sentence-transformers/all-MiniLM-L6-v2','threshold':.45,'loadSeconds':load,'corpusEncodeMs':corpusMs,'recallAt5':sum(r['rank']>0 for r in rows)/len(rows),'mrr':sum(1/r['rank'] if r['rank'] else 0 for r in rows)/len(rows),'rows':rows,'negativeQueries':negative,'scope':'standalone model ranking; not secured application integration','zeroApiCharge':True}
open('.sites-runtime/embedding-calibration.json','w').write(json.dumps(report,indent=2));print(json.dumps({k:v for k,v in report.items() if k not in ['rows','negativeQueries']}));print('negatives abstained',sum(r['abstained'] for r in negative),len(negative))
