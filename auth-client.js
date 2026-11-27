(()=>{
'use strict';
const key='sr72_customer_auth',legacy='sr42_customer_auth',idleMs=30*24*60*60*1000;
let store,pending=null,lastTouch=0;
try{store=localStorage;const probe=key+'_probe';store.setItem(probe,'1');store.removeItem(probe)}catch{try{store=sessionStorage}catch{}}
function raw(k=key,s=store){try{return JSON.parse(s?.getItem(k)||'null')}catch{return null}}
function put(s){try{if(s)store?.setItem(key,JSON.stringify(s));else store?.removeItem(key);return true}catch{return false}}
function clearLegacy(){try{sessionStorage.removeItem(legacy)}catch{}}
function signal(reason){window.dispatchEvent(new CustomEvent('sr72-auth-change',{detail:{reason}}))}
function valid(s){return !!(s&&typeof s.id==='string'&&typeof s.access_token==='string'&&s.access_token&&typeof s.refresh_token==='string'&&s.refresh_token&&Number.isFinite(s.expires_at)&&Number.isFinite(s.lastActivity))}
function session(x,id,activity){if(!x?.access_token||!x?.refresh_token)return null;return {id,access_token:x.access_token,refresh_token:x.refresh_token,expires_at:Number(x.expires_at)||Math.floor(Date.now()/1000)+Number(x.expires_in||3600),lastActivity:activity}}
function newId(){return crypto.randomUUID()}
// Upgrade a previously open tab once, without importing an old session over a newer one.
let old=null;try{old=raw(legacy,sessionStorage)}catch{};if(!raw()&&old?.access_token&&old?.refresh_token){put(session(old,newId(),Date.now()))}clearLegacy();
function read(){const s=raw();if(!valid(s))return null;if(Date.now()-s.lastActivity>=idleMs||s.lastActivity>Date.now()+60000){put(null);clearLegacy();signal('expired');return null}return s}
function save(x){clearLegacy();if(!x){put(null);signal('logout');return}const s=session(x,newId(),Date.now());if(!valid(s)||!put(s))throw Error('Impossibile salvare la sessione / Sesiunea nu poate fi salvată');lastTouch=0;signal('login')}
function touch(){if(document.visibilityState==='hidden')return;const now=Date.now();if(now-lastTouch<60000)return;lastTouch=now;const s=read();if(s&&now-s.lastActivity>=60000){const current=raw();if(current?.id===s.id&&current.refresh_token===s.refresh_token)put({...current,lastActivity:now})}}
for(const e of ['pointerdown','keydown','touchstart','scroll'])window.addEventListener(e,touch,{passive:true});
window.addEventListener('pageshow',touch);window.addEventListener('focus',touch);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')touch()});
// Also expire an idle tab left open, without keeping it alive in the background.
setInterval(()=>{if(document.visibilityState!=='hidden')read()},60000);
window.addEventListener('storage',e=>{if(e.key!==key&&e.key!==null)return;let before=null,after=null;try{before=JSON.parse(e.oldValue);after=JSON.parse(e.newValue)}catch{}if(e.key===null||before?.id!==after?.id){clearLegacy();signal(after?'changed':'remote-logout')}});
async function renew(id){let s=read();if(!s||s.id!==id)return undefined;if(s.expires_at>Date.now()/1000+60)return s.access_token;try{const x=await srRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token});const current=read();if(!current||current.id!==id)return undefined;if(current.refresh_token!==s.refresh_token)return current.access_token;const next=session(x,id,current.lastActivity);if(!valid(next)||!put(next))throw Error('Sessione non valida / Sesiune nevalidă');return next.access_token}catch(e){const current=read();if(!current||current.id!==id)return undefined;if(current.refresh_token!==s.refresh_token)return current.access_token;if([400,401,403].includes(e.status)){put(null);clearLegacy();signal('expired');throw Error('Sessione scaduta. Accedi nuovamente. / Sesiune expirată. Autentifică-te din nou.')}throw e}}
window.srAccountSave=save;
window.srAccountToken=async()=>{const s=read();if(!s)return undefined;if(s.expires_at>Date.now()/1000+60)return s.access_token;if(!pending||pending.id!==s.id){const job={id:s.id,promise:null};pending=job;job.promise=(async()=>{try{return await (navigator.locks?.request?navigator.locks.request(key,()=>renew(s.id)):renew(s.id))}finally{if(pending===job)pending=null}})()}return pending.promise};
// Opening the site is activity, but only after checking the inactivity deadline.
touch();
})();
