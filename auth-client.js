(()=>{
'use strict';
const key='sr72_customer_auth',legacy='sr42_customer_auth',maxAge=30*24*60*60*1000;
let local=null,temporary=null,pending=null;
function available(name){try{const s=window[name],p=key+'_probe';s.setItem(p,'1');s.removeItem(p);return s}catch{return null}}
local=available('localStorage');temporary=available('sessionStorage');
function raw(s,k=key){try{return JSON.parse(s?.getItem(k)||'null')}catch{return null}}
function put(s,x,k=key){if(!s)return false;try{if(x)s.setItem(k,JSON.stringify(x));else s.removeItem(k);return true}catch{return false}}
function clearLegacy(){put(temporary,null,legacy)}
function signal(reason){window.dispatchEvent(new CustomEvent('sr72-auth-change',{detail:{reason}}))}
function valid(s){return !!(s&&typeof s.id==='string'&&typeof s.access_token==='string'&&s.access_token&&typeof s.refresh_token==='string'&&s.refresh_token&&Number.isFinite(s.expires_at)&&Number.isFinite(s.lastActivity))}
function session(x,id,deadline){if(!x?.access_token||!x?.refresh_token)return null;return {id,access_token:x.access_token,refresh_token:x.refresh_token,expires_at:Number(x.expires_at)||Math.floor(Date.now()/1000)+Number(x.expires_in||3600),lastActivity:Date.now(),rememberUntil:deadline}}
function newId(){return crypto.randomUUID()}
function active(){const s=raw(temporary);if(s)return {store:temporary,s};const l=raw(local);return l?{store:local,s:l}:null}
// Preserve existing V72 sessions. Earlier session-only credentials stay session-only.
const old=raw(temporary,legacy);if(!active()&&old?.access_token&&old?.refresh_token)put(temporary,session(old,newId(),Date.now()+maxAge));clearLegacy();
function read(){const entry=active();if(!entry)return null;const {store,s}=entry;if(!valid(s)){put(store,null);return null}const now=Date.now();const deadline=Number.isFinite(s.rememberUntil)?s.rememberUntil:s.lastActivity+maxAge;if(now>=deadline||deadline>now+maxAge+60000){put(store,null);clearLegacy();signal('expired');return null}if(!Number.isFinite(s.rememberUntil)){s.rememberUntil=deadline;put(store,s)}return {store,s}}
// Default to a tab session. Remembering is an explicit choice made at login.
function save(x,remember=false){clearLegacy();if(!x){put(temporary,null);put(local,null);signal('logout');return}const s=session(x,newId(),Date.now()+maxAge),store=remember?local:temporary,other=remember?temporary:local;if(!valid(s)||!put(store,s))throw Error('Impossibile salvare la sessione / Sesiunea nu poate fi salvată');put(other,null);signal('login')}
function check(){if(document.visibilityState!=='hidden')read()}
window.addEventListener('pageshow',check);window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);setInterval(check,60000);
window.addEventListener('storage',e=>{if(e.storageArea!==local||e.key!==key&&e.key!==null||raw(temporary))return;let before=null,after=null;try{before=JSON.parse(e.oldValue);after=JSON.parse(e.newValue)}catch{}if(e.key===null||before?.id!==after?.id){clearLegacy();signal(after?'changed':'remote-logout')}});
async function renew(id){let entry=read();if(!entry||entry.s.id!==id)return undefined;const {s,store}=entry;if(s.expires_at>Date.now()/1000+60)return s.access_token;try{const x=await srRequest('/auth/v1/token?grant_type=refresh_token',{refresh_token:s.refresh_token});const current=read();if(!current||current.s.id!==id||current.store!==store)return undefined;if(current.s.refresh_token!==s.refresh_token)return current.s.access_token;const next=session(x,id,current.s.rememberUntil);if(!valid(next)||!put(store,next))throw Error('Sessione non valida / Sesiune nevalidă');return next.access_token}catch(e){const current=read();if(!current||current.s.id!==id||current.store!==store)return undefined;if(current.s.refresh_token!==s.refresh_token)return current.s.access_token;if([400,401,403].includes(e.status)){put(store,null);clearLegacy();signal('expired');throw Error('Sessione scaduta. Accedi nuovamente. / Sesiune expirată. Autentifică-te din nou.')}throw e}}
window.srAccountSave=save;
window.srAccountToken=async()=>{const entry=read();if(!entry)return undefined;const {s}=entry;if(s.expires_at>Date.now()/1000+60)return s.access_token;if(!pending||pending.id!==s.id){const job={id:s.id,promise:null};pending=job;job.promise=(async()=>{try{return await (navigator.locks?.request?navigator.locks.request(key,()=>renew(s.id)):renew(s.id))}finally{if(pending===job)pending=null}})()}return pending.promise};
check();
})();
