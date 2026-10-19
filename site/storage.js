const openDB=()=>new Promise((resolve,reject)=>{const r=indexedDB.open('music-dialogue-studio',1);r.onupgradeneeded=()=>r.result.createObjectStore('projects',{keyPath:'id'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
async function run(mode,action){const db=await openDB();return new Promise((resolve,reject)=>{const tx=db.transaction('projects',mode),store=tx.objectStore('projects');const request=action(store);let result;request.onsuccess=()=>result=request.result;tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};});}
export const saveProject=p=>run('readwrite',s=>s.put(p));
export const getProject=id=>run('readonly',s=>s.get(id));
export const listProjects=()=>run('readonly',s=>s.getAll());
