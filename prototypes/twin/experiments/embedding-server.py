"""Synthetic local experiments only. CPU ONNX embeddings, kernel-blocked outbound networking and no request logging.
Install pinned experiment requirements; MODEL_DIR holds verified model.onnx/tokenizer.json.
The listener is deliberately fixed to loopback. Not a production inference deployment.
"""
import os,json,hashlib
from http.server import BaseHTTPRequestHandler,HTTPServer
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*args):pass
 def do_POST(self):
  try:
   size=int(self.headers.get('Content-Length','0'))
   if self.path!='/v1/embeddings' or not 0<size<=300000:raise ValueError()
   body=json.loads(self.rfile.read(size));texts=body['input']
   if body.get('model')!='all-MiniLM-L6-v2' or not isinstance(texts,list) or not 1<=len(texts)<=65 or any(not isinstance(t,str) or not 0<len(t)<=4000 for t in texts) or sum(map(len,texts))>64000:raise ValueError()
   enc=tok.encode_batch(texts);data={'input_ids':np.array([e.ids for e in enc],dtype=np.int64),'attention_mask':np.array([e.attention_mask for e in enc],dtype=np.int64),'token_type_ids':np.array([e.type_ids for e in enc],dtype=np.int64)}
   out=session.run(None,{i.name:data[i.name] for i in session.get_inputs()})[0];mask=data['attention_mask'][...,None]
   pooled=(out*mask).sum(1)/np.clip(mask.sum(1),1,None);vectors=pooled/np.linalg.norm(pooled,axis=1,keepdims=True)
   payload=json.dumps({'data':[{'index':i,'embedding':v.tolist()} for i,v in enumerate(vectors)]}).encode()
   self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(payload)
  except Exception:
   self.send_response(400);self.end_headers();self.wfile.write(b'{"error":"invalid embedding request"}')
server=HTTPServer(('127.0.0.1',int(os.environ.get('PORT','8090'))),Handler)
# Bind first; then permanently disallow new sockets/connect before native imports.
import runpy
runpy.run_path(os.path.join(os.path.dirname(__file__),'network-sandbox.py'))['block_new_network_connections']()
import numpy as np
import onnxruntime as ort
ort.disable_telemetry_events()  # Must precede session creation; no platform telemetry.
from tokenizers import Tokenizer
model_dir=os.environ['MODEL_DIR']
path=os.path.join(model_dir,'model.onnx')
assert hashlib.sha256(open(path,'rb').read()).hexdigest()=='6fd5d72fe4589f189f8ebc006442dbb529bb7ce38f8082112682524616046452'
assert hashlib.sha256(open(os.path.join(model_dir,'tokenizer.json'),'rb').read()).hexdigest()=='be50c3628f2bf5bb5e3a7f17b1f74611b2561a3a27eeab05e5aa30f411572037'
tok=Tokenizer.from_file(os.path.join(model_dir,'tokenizer.json'));tok.enable_padding();tok.enable_truncation(max_length=256)
opt=ort.SessionOptions();opt.intra_op_num_threads=2
session=ort.InferenceSession(path,sess_options=opt,providers=['CPUExecutionProvider'])

server.serve_forever()
