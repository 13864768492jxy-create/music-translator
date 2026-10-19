const VERSION='music-dialogue-20261019-1';
const ASSETS=['./','./index.html','./style.css?v=7','./app.js?v=9','./core.js?v=6','./dsp.js?v=6','./storage.js?v=6','./analysis-worker.js?v=6','./video-export.js?v=7','./manifest.webmanifest','./icon.svg','./vendor/icons/style.css','./vendor/icons/Phosphor.woff2'];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('music-dialogue-')&&key!==VERSION).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const request=event.request,url=new URL(request.url);
  if(request.method!=='GET'||url.origin!==self.location.origin||url.pathname.includes('/cdn-cgi/')||url.pathname.includes('/examples/')||request.headers.has('range'))return;
  if(request.mode==='navigate'){event.respondWith(fetch(request).then(response=>{if(response.ok&&!response.redirected){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put('./',copy));}return response;}).catch(()=>caches.match('./')));return;}
  event.respondWith(caches.match(request).then(cached=>cached||fetch(request).then(response=>{if(response.ok&&!response.redirected){const copy=response.clone();caches.open(VERSION).then(cache=>cache.put(request,copy));}return response;})));
});
