import {Output,Mp4OutputFormat,BufferTarget,CanvasSource,AudioBufferSource,Quality,canEncodeVideo,canEncodeAudio} from './vendor/media/mediabunny.mjs';
export async function supportsFrameExport(canvas,buffer){
  if(!window.VideoEncoder||!window.AudioEncoder)return false;
  return (await canEncodeVideo('avc',{width:canvas.width,height:canvas.height,frameRate:30}))&&
    (await canEncodeAudio('aac',{sampleRate:buffer.sampleRate,numberOfChannels:Math.min(2,buffer.numberOfChannels)}));
}
export async function encodeFrames({canvas,buffer,start,end,title,draw,onProgress,isCancelled}){
  const sr=buffer.sampleRate,first=Math.round(start*sr),sampleCount=Math.min(Math.round((end-start)*sr),buffer.length-first),duration=sampleCount/sr,channels=Math.min(2,buffer.numberOfChannels);
  const clipped=new AudioBuffer({numberOfChannels:channels,length:sampleCount,sampleRate:sr}),fade=Math.min(sampleCount,Math.round(.35*sr));
  for(let ch=0;ch<channels;ch++){const target=clipped.getChannelData(ch);target.set(buffer.getChannelData(ch).subarray(first,first+sampleCount));for(let i=0;i<fade;i++)target[sampleCount-fade+i]*=(fade-i-1)/fade;}
  const output=new Output({format:new Mp4OutputFormat({fastStart:'in-memory'}),target:new BufferTarget()});
  const video=new CanvasSource(canvas,{codec:'avc',quality:new Quality('high')}),audio=new AudioBufferSource({codec:'aac',quality:new Quality('high')});
  output.addVideoTrack(video,{frameRate:30});output.addAudioTrack(audio);output.setMetadataTags({title});
  try{
    await output.start();await audio.add(clipped);audio.close();const frames=Math.ceil(duration*30);
    for(let n=0;n<frames;n++){
      if(isCancelled())throw Error('cancelled');draw(start+n/30);await video.add(n/30,Math.min(1/30,duration-n/30));
      if(n%8===0){onProgress(n/frames);await new Promise(resolve=>setTimeout(resolve,0));}
    }
    video.close();await output.finalize();onProgress(1);return {blob:new Blob([output.target.buffer],{type:'video/mp4'}),frames,duration,sampleCount,sampleRate:sr};
  }catch(error){await output.cancel().catch(()=>{});throw error;}
}
