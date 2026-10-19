// MusiCNN preprocessing matches Essentia's published, fixed frontend.
// The waveform, envelope and onset candidates always come from decoded PCM.
export function fft(real, imag) {
  const n=real.length;
  for(let i=1,j=0;i<n;i++) { let b=n>>1;for(;j&b;b>>=1)j^=b;j^=b;if(i<j){[real[i],real[j]]=[real[j],real[i]];[imag[i],imag[j]]=[imag[j],imag[i]];} }
  for(let len=2;len<=n;len<<=1){const a=-2*Math.PI/len,cr=Math.cos(a),ci=Math.sin(a);
    for(let i=0;i<n;i+=len){let wr=1,wi=0;for(let j=0;j<len/2;j++){const k=i+j,h=k+len/2,tr=wr*real[h]-wi*imag[h],ti=wr*imag[h]+wi*real[h];real[h]=real[k]-tr;imag[h]=imag[k]-ti;real[k]+=tr;imag[k]+=ti;const next=wr*cr-wi*ci;wi=wr*ci+wi*cr;wr=next;}} }
}
export function melFrame(samples, center, spec) {
  const re=new Float64Array(512),im=new Float64Array(512);
  for(let i=0;i<512;i++)re[i]=(samples[center-256+i]||0)*spec.window[i];
  fft(re,im);const power=new Float64Array(257);for(let i=0;i<257;i++)power[i]=re[i]*re[i]+im[i]*im[i];
  return spec.filters.map(f=>{let sum=0;for(let i=0;i<f.weights.length;i++)sum+=power[f.start+i]*f.weights[i];return Math.log10(1+10000*sum);});
}
export function melPatch(samples,start,spec){const out=new Float32Array(128*96);for(let i=0;i<128;i++)out.set(melFrame(samples,start+i*256,spec),i*96);return out;}
export function analyzePCM(x,sampleRate=16000,start=0) {
  const hop=320,size=1024,rms=[],flux=[],centroids=[],times=[];let previous=new Float64Array(513);
  for(let c=0;c<x.length;c+=hop){const re=new Float64Array(size),im=new Float64Array(size);let sum=0;
    for(let j=0;j<size;j++){const v=x[c+j-size/2]||0;sum+=v*v;re[j]=v*(.5-.5*Math.cos(2*Math.PI*j/(size-1)));}
    fft(re,im);let weight=0,total=0,change=0;
    for(let j=1;j<=size/2;j++){const v=Math.hypot(re[j],im[j]);total+=v;weight+=v*j*sampleRate/size;change+=Math.max(0,v-previous[j]);previous[j]=v;}
    rms.push(Math.sqrt(sum/size));flux.push(change/(size/2));centroids.push(total?weight/total:0);times.push(start+c/sampleRate);
  }
  const sorted=[...rms].sort((a,b)=>a-b),p95=sorted[Math.floor(sorted.length*.95)]||0, floor=Math.max(.0006,p95*.045);
  const onsets=[];for(let i=2;i<flux.length-2;i++){const local=flux.slice(Math.max(0,i-20),i+1).sort((a,b)=>a-b),median=local[Math.floor(local.length/2)]||0;
    if(flux[i]>median*1.7+.0002&&flux[i]>flux[i-1]&&flux[i]>=flux[i+1]&&rms[i]>floor&&(!onsets.length||times[i]-onsets.at(-1)>.09))onsets.push(times[i]);}
  const active=times.filter((_,i)=>rms[i]>floor),end=start+x.length/sampleRate;
  const boundaries=[active[0]??start];let last=boundaries[0];
  for(let i=1;i<rms.length-1;i++){const t=times[i],elapsed=t-last;
    const dip=rms[i]<p95*.22&&rms[i]<=rms[i-1]&&rms[i]<=rms[i+1];
    const accent=onsets.some(v=>Math.abs(v-t)<.011);
    if(elapsed>=3.2&&((dip&&elapsed>=3.8)||(accent&&elapsed>=5.2)||elapsed>=8)){boundaries.push(t);last=t;}}
  if(end-last<1.8&&boundaries.length>1)boundaries.pop();boundaries.push(end);
  const phrases=[];for(let i=0;i<boundaries.length-1;i++)if(boundaries[i+1]-boundaries[i]>.4)phrases.push({start:boundaries[i],end:Math.max(boundaries[i]+.2,boundaries[i+1]-.18)});
  if(!active.length)phrases.length=0;
  const mean=rms.reduce((a,b)=>a+b,0)/Math.max(1,rms.length),variance=rms.reduce((a,b)=>a+(b-mean)**2,0)/Math.max(1,rms.length);
  return {sampleRate,hopSeconds:hop/sampleRate,start,end,rms,times,onsets,phrases,floor,p95,meanRms:mean,
    centroid:centroids.reduce((a,b)=>a+b,0)/Math.max(1,centroids.length),dynamicVariation:Math.sqrt(variance)/(mean||1),onsetDensity:onsets.length/Math.max(.1,end-start),
    caveat:'起音是20毫秒步长的声学候选 乐句分组需要试听核对 不代表独立乐器数量'};
}
