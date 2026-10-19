import {analyzePCM,melPatch} from './dsp.js?v=6';
let encoder,head,ort,spec,labels;
const post=(stage,progress,extra={})=>self.postMessage({type:'progress',stage,progress,...extra});
async function prepare(){
  if(encoder)return;
  post('首次载入音色模型 约 35 MB',.16);
  ort=await import('./vendor/onnx/ort.wasm.min.mjs');ort.env.wasm.numThreads=1;
  ort.env.wasm.wasmPaths=new URL('./vendor/onnx/',self.location.href).href;
  [spec,labels]=await Promise.all([fetch('./models/frontend.json').then(r=>r.json()),fetch('./models/mtg_jamendo_instrument-discogs-effnet-1.json').then(r=>r.json()).then(v=>v.classes)]);
  encoder=await ort.InferenceSession.create('./models/discogs-effnet-bsdynamic-1.onnx',{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  head=await ort.InferenceSession.create('./models/mtg_jamendo_instrument-discogs-effnet-1.onnx',{executionProviders:['wasm']});
}
self.onmessage=async({data})=>{
  const {samples,start,classify=true}=data;
  try{
    post('测量音量 起音与乐句',.04);const acoustic=analyzePCM(samples,16000,start);self.postMessage({type:'acoustic',acoustic});
    let classification=null,modelError=null;
    if(classify&&samples.length>=32768&&acoustic.p95>=.0006){try{
      await prepare();const count=Math.min(5,Math.max(1,Math.floor(samples.length/32768))),scores=new Float64Array(labels.length),windows=[];
      for(let i=0;i<count;i++){
        const at=Math.round((samples.length-32768)*(count===1?0:i/(count-1))),patch=melPatch(samples,at,spec);
        post(`比较音色 ${i+1} / ${count}`,.4+.55*i/count);
        const input=new ort.Tensor('float32',patch,[1,128,96]);const encoded=await encoder.run({melspectrogram:input});
        const prediction=await head.run({embeddings:encoded.embeddings});const values=prediction.activations.data;
        for(let k=0;k<scores.length;k++)scores[k]+=values[k]/count;
        const top=Array.from(values,(score,k)=>({label:labels[k],score})).sort((a,b)=>b.score-a.score)[0];
        windows.push({start:start+at/16000,end:start+(at+32768)/16000,top});
        input.dispose();Object.values(encoded).forEach(t=>t.dispose());Object.values(prediction).forEach(t=>t.dispose());
      }
      classification={model:'MTG Jamendo instrument · Discogs EffNet',ranking:Array.from(scores,(score,k)=>({label:labels[k],score})).sort((a,b)=>b.score-a.score),windows,
        status:'candidate_requires_review',instrumentCountInferred:false,calibratedConfidence:false};
    }catch(error){modelError='音色模型未完成 '+error.message;}}
    else if(classify)modelError=acoustic.p95<.0006?'未测得足够声音 不生成乐器猜测':'片段短于 2.048 秒 只生成声学测量';
    self.postMessage({type:'done',acoustic,classification,modelError});
  }catch(error){self.postMessage({type:'error',error:error.message});}
};
