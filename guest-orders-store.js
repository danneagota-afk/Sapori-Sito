/* V76: private links only, device-local, no personal data or payment details. */
(()=>{'use strict';const key='sr76_guest_orders',ttl=30*864e5,valid=k=>typeof k==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(k),kind=k=>k==='real'||k==='test';
function read(){try{const a=JSON.parse(localStorage.getItem(key)||'[]');return (Array.isArray(a)?a:[]).filter(x=>x&&valid(x.token)&&kind(x.kind)&&Number.isFinite(x.savedAt)&&x.savedAt<=Date.now()&&Date.now()-x.savedAt<ttl).slice(0,50)}catch{return []}}
function write(a){try{localStorage.setItem(key,JSON.stringify(a));return true}catch{return false}}
function remember(type,token){if(!kind(type)||!valid(token))return false;token=token.toLowerCase();return write([{kind:type,token,savedAt:Date.now()},...read().filter(x=>x.token!==token||x.kind!==type)].slice(0,50))}
function forget(type,token){return write(read().filter(x=>x.kind!==type||x.token!==token))}
function clear(){try{localStorage.removeItem(key);return true}catch{return false}}
function url(type,token){return kind(type)&&valid(token)?(type==='test'?'order-payment.html':'track.html')+'#'+token:''}
window.srGuestOrders={read,remember,forget,clear,url,valid};try{if(localStorage.getItem(key)!==null)write(read())}catch{}})();
