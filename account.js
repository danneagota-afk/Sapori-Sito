const $=id=>document.getElementById(id);
const qp=new URLSearchParams(location.search);
const hash=new URLSearchParams((location.hash||'').replace(/^#/,'').replace(/^\?/,'')||'');
const params=hash.has('type')||hash.has('access_token')||hash.has('error')||hash.has('error_code')?hash:qp;
const modeFromQuery=(qp.get('mode')||'').toLowerCase();
let mode=modeFromQuery==='signup'?'signup':modeFromQuery==='recover'?'recover':'login';
let accountLang=(localStorage.getItem('sr_lang')==='ro'?'ro':'it');
let recoveryToken='';
let confirmationPending=false;
let currentUser=null,currentRows=null;
let personalView='orders';

function at(it,ro){return accountLang==='ro'?ro:it}
function redirectPath(){return location.origin+location.pathname}
function email(){return $('email').value.trim().toLowerCase()}
function msg(t='',err=false){const m=$('msg');if(!t){m.hidden=true;m.textContent='';m.className='';return;}m.hidden=false;m.textContent=t;m.className=err?'error':''}
function busy(fn){return async ev=>{ev?.preventDefault?.();const form=ev?.currentTarget?.closest?.('form')||ev?.currentTarget?.form||ev?.currentTarget;const buttons=form?form.querySelectorAll('button'):[];buttons.forEach(b=>b.disabled=true);try{await fn(ev)}catch(e){msg(friendly(e),true)}finally{buttons.forEach(b=>b.disabled=false)}}}
function friendly(e){const raw=String(e?.message||e||'');const lower=raw.toLowerCase();
  if(lower.includes('invalid login')||lower.includes('invalid_credentials'))return at('Email o password non corretti.','E-mail sau parolă incorecte.');
  if(lower.includes('email not confirmed'))return at('Controlla la tua email e conferma il tuo account.','Verifică emailul și confirmă contul.');
  if(lower.includes('user already registered'))return at('Esiste già un account con questa email. Prova ad accedere.','Există deja un cont cu acest e-mail. Încearcă să te autentifici.');
  if(lower.includes('password should be'))return at('La password deve avere almeno 8 caratteri.','Parola trebuie să aibă cel puțin 8 caractere.');
  if(lower.includes('network')||lower.includes('fetch'))return at('Connessione non disponibile. Riprova tra poco.','Conexiunea nu este disponibilă. Încearcă din nou.');
  return raw||at('Operazione non riuscita.','Operațiune nereușită.');
}
function setText(id,it,ro){const n=$(id); if(n)n.textContent=at(it,ro)}
function setMode(next,clear=true){
  mode=next;
  const guest=$('guest'), account=$('account'), recovery=$('recovery');
  const signed=next==='signed';
  $('shell').classList.toggle('signed',signed);
  guest.hidden=signed||next==='reset';
  account.hidden=!signed;
  recovery.hidden=next!=='reset';
  $('tab-login').setAttribute('aria-selected',String(next!=='signup'));
  $('tab-signup').setAttribute('aria-selected',String(next==='signup'));
  $('tab-login').disabled=next==='login';
  $('tab-signup').disabled=next==='signup';
  $('confirm-group').hidden=next!=='signup';
  $('confirm').disabled=next!=='signup';
  $('password-hint').hidden=next!=='signup';
  $('recover').hidden=next==='signup';
  $('back-login').hidden=next!=='signup';
  $('login-submit').textContent=next==='signup'?at('Crea account','Creează cont'):at('Accedi','Autentifică-te');
  $('account-title').textContent= signed
    ? at('Il tuo account.','Contul tău.')
    : next==='signup'
      ? at('Crea il tuo account.','Creează-ți contul.')
      : next==='reset'
        ? at('Imposta una nuova password.','Setează o parolă nouă.')
        : at('Bentornato.','Bine ai revenit.');
  $('account-lead').textContent=signed
    ? at('Gestisci ordini, dati e indirizzo in un unico spazio elegante.','Gestionezi comenzile, datele și adresa într-un singur spațiu elegant.')
    : next==='signup'
      ? at('Registrati per seguire i tuoi ordini e riutilizzare i tuoi dati al checkout.','Înregistrează-te pentru a urmări comenzile și a refolosi datele la finalizarea comenzii.')
      : next==='reset'
        ? at('Inserisci la tua nuova password per rientrare nel tuo account.','Introdu noua parolă pentru a reintra în cont.')
        : at('Accedi per ritrovare ordini, dati e preferenze.','Autentifică-te pentru a regăsi comenzile, datele și preferințele.');
  $('guest-note').textContent=at('Puoi acquistare anche senza registrarti.','Poți comanda și fără cont.');
  syncConfirmation();
  if(clear) msg();
}
function syncConfirmation(){
  const box=$('confirmation-actions');
  box.hidden=!confirmationPending;
  if(!confirmationPending)return;
  $('confirmation-login').textContent=at('Accedi','Autentifică-te');
  $('confirmation-resend').textContent=at('Invia di nuovo la conferma','Trimite din nou confirmarea');
  $('confirmation-hint').textContent=at('Se l’email non arriva, controlla anche spam o promozioni.','Dacă e-mailul nu ajunge, verifică și spam sau promoții.');
}
function validatePassword(pw,confirm){
  if(String(pw).length<8) throw Error(at('La password deve avere almeno 8 caratteri.','Parola trebuie să aibă minimum 8 caractere.'));
  if(confirm!=null && pw!==confirm) throw Error(at('Le password non coincidono.','Parolele nu coincid.'));
}
function toggleReveal(btnId,inputId){const b=$(btnId),i=$(inputId); if(!b||!i)return; b.onclick=()=>{const show=i.type==='password'; i.type=show?'text':'password'; b.textContent=show?at('Nascondi','Ascunde'):at('Mostra','Arată')}}
function applyTranslations(){
  document.documentElement.lang=accountLang==='ro'?'ro':'it';
  $('language').textContent=accountLang==='ro'?'IT':'RO';
  $('language').ariaLabel=accountLang==='ro'?'Italiano':'Română';
  setText('checkout-return','← Torna al negozio','← Înapoi la magazin');
  setText('tab-login','Accedi','Autentifică-te');
  setText('tab-signup','Registrati','Înregistrează-te');
  document.querySelector('[for=email]').textContent=at('E-mail','E-mail');
  document.querySelector('[for=password]').textContent=at('Password','Parolă');
  document.querySelector('[for=confirm]').textContent=at('Conferma password','Confirmă parola');
  document.querySelector('#recovery [for=newpassword]').textContent=at('Nuova password','Parolă nouă');
  document.querySelector('#recovery [for=newconfirm]').textContent=at('Conferma password','Confirmă parola');
  document.querySelectorAll('[data-t=passwordHint]').forEach(n=>n.textContent=at('Almeno 8 caratteri.','Minimum 8 caractere.'));
  $('recover').textContent=at('Password dimenticata?','Ai uitat parola?');
  $('back-login').textContent=at('← Torna all’accesso','← Înapoi la autentificare');
  $('shop-link').textContent=at('Vai al negozio','Mergi la magazin');
  $('logout').textContent=at('Esci','Ieși');
  setText('confirmation-login','Accedi','Autentifică-te');
  setText('confirmation-resend','Invia di nuovo la conferma','Trimite din nou confirmarea');
  setText('checkout-context','', '');
  setMode(mode,false);
  if(currentUser) renderPersonal();
  if(Array.isArray(currentRows)) renderOrders(currentRows);
}

$('language').onclick=()=>{accountLang=accountLang==='it'?'ro':'it'; localStorage.setItem('sr_lang',accountLang); applyTranslations();};
$('tab-login').onclick=()=>setMode('login');
$('tab-signup').onclick=()=>setMode('signup');
$('back-login').onclick=()=>setMode('login');
$('recover').onclick=busy(async()=>{const address=email(); if(!address) throw Error(at('Inserisci prima la tua email.','Introdu mai întâi e-mailul.')); await srRequest('/auth/v1/recover?redirect_to='+encodeURIComponent(redirectPath()),{email:address}); setMode('login'); msg(at('Ti abbiamo inviato un link per cambiare password.','Ți-am trimis un link pentru schimbarea parolei.'));});

toggleReveal(document.querySelector('[data-reveal="password"]')?.id||'', 'password');
// fallback because reveal buttons do not have ids in html
Array.from(document.querySelectorAll('.reveal')).forEach(btn=>{const inputId=btn.dataset.reveal; btn.onclick=()=>{const input=$(inputId); const show=input.type==='password'; input.type=show?'text':'password'; btn.textContent=show?at('Nascondi','Ascunde'):at('Mostra','Arată')}});

$('login').onsubmit=busy(async()=>{
  const address=email(); if(!address) throw Error(at('Inserisci una email valida.','Introdu un e-mail valid.'));
  const pw=$('password').value;
  if(mode==='signup'){
    validatePassword(pw,$('confirm').value);
    await srRequest('/auth/v1/signup?redirect_to='+encodeURIComponent(redirectPath()),{email:address,password:pw,data:{language:accountLang}});
    confirmationPending=true; syncConfirmation();
    $('password').value=''; $('confirm').value='';
    msg(at('Registrazione inviata. Controlla la tua email per confermare l’account.','Înregistrarea a fost trimisă. Verifică e-mailul pentru a confirma contul.'));
    return;
  }
  let r;
  try{r=await srRequest('/auth/v1/token?grant_type=password',{email:address,password:pw});}
  catch(e){ if(/email not confirmed/i.test(String(e.message))){confirmationPending=true; syncConfirmation();} throw e; }
  if(!r?.access_token) throw Error(at('Accesso non riuscito.','Autentificare nereușită.'));
  srAccountSave(r); $('password').value=''; await show();
});
$('confirmation-login').onclick=()=>setMode('login');
$('confirmation-resend').onclick=busy(async()=>{ await srRequest('/auth/v1/resend?redirect_to='+encodeURIComponent(redirectPath()),{type:'signup',email:email()}); msg(at('Se l’account attende conferma, riceverai un nuovo link.','Dacă există un cont în așteptarea confirmării, vei primi un link nou.')); });
$('logout').onclick=busy(async()=>{ try{const token=await srAccountToken(); if(token) await srRequest('/auth/v1/logout',{},token)} finally {srAccountSave(null); currentUser=null; currentRows=null; personalView='orders'; $('profile-view').replaceChildren(); $('orders').replaceChildren(); setMode('login'); msg(at('Hai effettuato la disconnessione.','Te-ai deconectat.'));}});
$('recovery').onsubmit=busy(async()=>{
  if(!recoveryToken) throw Error(at('Link scaduto. Richiedine uno nuovo.','Link expirat. Cere unul nou.'));
  const pw=$('newpassword').value; validatePassword(pw,$('newconfirm').value);
  const r=await fetch(SR_SUPABASE.url+'/auth/v1/user',{method:'PUT',headers:{apikey:SR_SUPABASE.key,Authorization:'Bearer '+recoveryToken,'Content-Type':'application/json'},body:JSON.stringify({password:pw})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw Error(j.message||j.msg||at('Aggiornamento non riuscito.','Actualizare nereușită.'));
  try{await srRequest('/auth/v1/logout',{},recoveryToken)}catch{}
  recoveryToken=''; srAccountSave(null); $('recovery').reset(); setMode('login'); msg(at('Password aggiornata. Accedi di nuovo.','Parolă actualizată. Autentifică-te din nou.'));
});

const el=(tag,txt,cls)=>{const n=document.createElement(tag); if(txt!=null) n.textContent=txt; if(cls) n.className=cls; return n};
function status(s){const labels={'Da confermare':'De confirmat','Confermata':'Confirmată','In preparazione':'În pregătire','Pronta':'Pregătită','Spedita':'Expediată','Ritirata':'Ridicată','Consegnata':'Livrată','Annullata':'Anulată'}; return accountLang==='ro'?(labels[s]||s):s}
function renderOrders(rows){
  const target=$('orders'); target.replaceChildren();
  if(!rows.length){ target.append(el('p',at('Non hai ancora ordini associati a questo account.','Nu ai încă nicio comandă asociată acestui cont.'))); return; }
  rows.forEach(o=>{
    const card=el('article',null,'order');
    const top=el('div',null,'order-top');
    top.append(el('strong',status(o.status)),el('strong',Number(o.total||0).toLocaleString(accountLang==='ro'?'ro-RO':'it-IT',{style:'currency',currency:'EUR'})));
    card.append(top,el('p',o.id));
    if(o.created_at&&Number.isFinite(Date.parse(o.created_at))) card.append(el('small',new Date(o.created_at).toLocaleString(accountLang==='ro'?'ro-RO':'it-IT',{timeZone:'Europe/Rome',dateStyle:'medium',timeStyle:'short'})));
    if(o.trackingToken){const a=el('a',at('Segui il tuo ordine →','Urmărește comanda →')); a.href='track.html#'+encodeURIComponent(o.trackingToken); card.append(a)}
    (Array.isArray(o.products)?o.products:[]).forEach(pr=>{
      card.append(el('p',(pr[accountLang]||pr.it||pr.ro||'')+' × '+pr.qty));
      if(['Ritirata','Consegnata'].includes(o.status)){
        const details=el('details'); const summary=el('summary',at('Scrivi una recensione','Scrie o recenzie')); const f=el('form',null,'stack');
        const label=el('label',at('Voto','Notă')); const select=el('select'); select.name='stars'; [5,4,3,2,1].forEach(n=>select.append(el('option',String(n)))); label.append(select);
        const bodyLabel=el('label',at('Recensione','Recenzie')); const ta=el('textarea'); ta.name='body'; ta.required=true; ta.maxLength=1500; bodyLabel.append(ta);
        const submit=el('button',at('Invia recensione','Trimite recenzia')); f.append(label,bodyLabel,submit);
        f.onsubmit=busy(async()=>{const fd=new FormData(f); await srRequest('/rest/v1/rpc/sr_submit_review',{p:{product_id:pr.id,stars:Number(fd.get('stars')),body:fd.get('body')}},await srAccountToken()); f.reset(); msg(at('Recensione inviata per moderazione.','Recenzia a fost trimisă pentru moderare.'));});
        details.append(summary,f); card.append(details);
      }
    });
    target.append(card);
  })
}
async function show(){
  const token=await srAccountToken(); if(!token) return;
  const u=await srRequest('/auth/v1/user',undefined,token); if(!u?.id) throw Error(at('Sessione non valida.','Sesiune nevalidă.'));
  currentUser=u; currentRows=null; $('user-email').textContent=u.email||''; setMode('signed'); renderPersonal(); $('orders').textContent=at('Caricamento ordini…','Se încarcă comenzile…');
  try{const rows=await srRequest('/rest/v1/rpc/sr_my_orders',{},token); if(!Array.isArray(rows)) throw Error(at('Ordini non disponibili.','Comenzi indisponibile.')); currentRows=rows; renderOrders(rows);}catch(e){ $('orders').textContent=at('Non è stato possibile caricare gli ordini. Ricarica la pagina per riprovare.','Comenzile nu au putut fi încărcate. Reîncarcă pagina pentru a încerca din nou.'); msg(friendly(e),true); }
}

function renderPersonal(){
  if(!currentUser) return;
  const p=srProfileRead(currentUser), host=$('profile-view');
  const names={orders:at('I miei ordini','Comenzile mele'), profile:at('Dati personali','Date personale'), addresses:at('Indirizzo','Adresă'), preferences:at('Comunicazioni','Comunicări')};
  document.querySelectorAll('[data-view]').forEach(b=>{ b.textContent=names[b.dataset.view]; b.setAttribute('aria-pressed',String(b.dataset.view===personalView)); b.onclick=()=>{personalView=b.dataset.view; msg(); renderPersonal()}; });
  $('orders-view').hidden=personalView!=='orders'; host.hidden=personalView==='orders'; host.replaceChildren(); if(host.hidden) return;

  const head=el('div',null,'view-head');
  head.append(el('span',at('Area personale','Zona personală'),'eyebrow-soft'),el('h2',names[personalView]));
  const intro=el('p',null,'view-intro');
  if(personalView==='profile') intro.textContent=at('Aggiorna i tuoi dati così saranno pronti al prossimo ordine.','Actualizează-ți datele ca să fie pregătite pentru următoarea comandă.');
  if(personalView==='addresses') intro.textContent=at('Ti basta un solo indirizzo principale. Potrai modificarlo quando vuoi.','Îți este suficientă o singură adresă principală. O poți modifica oricând.');
  if(personalView==='preferences') intro.textContent=at('Scegli se ricevere novità e offerte. Le comunicazioni sugli ordini restano sempre attive.','Alege dacă vrei să primești noutăți și oferte. Comunicările despre comenzi rămân mereu active.');
  head.append(intro); host.append(head);

  const card=el('section',null,'panel-card');
  const form=el('form',null,'stack profile-form');
  const field=(label,key,value='',type='text',max=160,required=false)=>{const l=el('label',label,'field'); const input=el(type==='textarea'?'textarea':'input'); input.name=key; if(type!=='textarea') input.type=type; input.value=value||''; input.maxLength=max; input.required=required; l.append(input); return l;};
  const save=async()=>{const token=await srAccountToken(); const u=await srProfileSave(p,token); if(!u?.id||u.id!==currentUser.id) throw Error(at('Risposta non valida.','Răspuns invalid.')); currentUser=u; renderPersonal(); msg(at('Modifiche salvate.','Modificări salvate.'));};

  if(personalView==='profile'){
    const grid=el('div',null,'field-grid');
    grid.append(field(at('Nome e cognome','Nume și prenume'),'name',p.name,'text',70), field(at('Telefono','Telefon'),'phone',p.phone,'tel',30));
    form.append(grid);
    const emailInfo=el('div',null,'info-strip'); emailInfo.append(el('strong',at('Email account','E-mail cont')),el('span',currentUser.email||'')); form.append(emailInfo);
    form.onsubmit=busy(async()=>{const d=new FormData(form); p.name=String(d.get('name')).trim(); p.phone=String(d.get('phone')).trim(); if(p.phone&&!/^[+0-9 ()-]{6,30}$/.test(p.phone)) throw Error(at('Telefono non valido.','Telefon invalid.')); await save()});
  }

  if(personalView==='addresses'){
    const existing=(p.addresses&&p.addresses[0])?p.addresses[0]:{label:at('Casa','Acasă'),address:'',cap:'',city:'',province:''};
    const summary=el('div',null,'address-summary');
    if(existing.address){
      summary.append(el('span',existing.label||at('Indirizzo principale','Adresa principală'),'chip'), el('strong',existing.address), el('p',`${existing.cap} ${existing.city} (${existing.province})`));
      const clear=el('button',at('Rimuovi indirizzo','Șterge adresa'),'text-button'); clear.type='button'; clear.onclick=busy(async()=>{p.addresses=[]; await save()}); summary.append(clear);
    } else {
      summary.append(el('span',at('Nessun indirizzo salvato','Nicio adresă salvată'),'chip'), el('p',at('Inserisci il tuo indirizzo principale per velocizzare il checkout.','Introdu adresa principală pentru a finaliza comenzile mai repede.')));
    }
    card.append(summary);
    const grid=el('div',null,'field-grid');
    grid.append(
      field(at('Nome indirizzo (es. Casa)','Nume adresă (ex. Acasă)'),'label',existing.label,'text',40),
      field(at('Strada e numero','Stradă și număr'),'address',existing.address,'text',160,true),
      field('CAP','cap',existing.cap,'text',5,true),
      field(at('Località','Localitate'),'city',existing.city,'text',80,true),
      field(at('Provincia','Provincie'),'province',existing.province,'text',2,true)
    );
    form.append(grid);
    form.onsubmit=busy(async()=>{
      const a=Object.fromEntries(new FormData(form)); Object.keys(a).forEach(k=>a[k]=String(a[k]).trim()); a.province=a.province.toUpperCase();
      if(a.address.length<3||a.city.length<2||!/^[0-9]{5}$/.test(a.cap)||!/^[A-Z]{2}$/.test(a.province)) throw Error(at('Controlla indirizzo, CAP e provincia.','Verifică adresa, codul poștal și provincia.'));
      p.addresses=[a]; await save();
    });
  }

  if(personalView==='preferences'){
    const prefBox=el('label',null,'preference-card'); const check=el('input'); check.type='checkbox'; check.checked=!!p.marketing;
    prefBox.append(check,el('div',null,'preference-copy'));
    prefBox.querySelector('div').append(el('strong',at('Novità e offerte','Noutăți și oferte')),el('p',at('Voglio ricevere email promozionali quando il servizio sarà attivo.','Vreau să primesc e-mailuri promoționale când serviciul va fi activ.')));
    form.append(prefBox, el('small',at('Le email relative agli ordini continueranno ad arrivare anche se lasci questa opzione disattivata.','E-mailurile legate de comenzi vor continua să sosească și dacă lași această opțiune dezactivată.')));
    form.onsubmit=busy(async()=>{p.marketing=check.checked; await save()});
  }

  const submit=el('button',personalView==='addresses'?at('Salva indirizzo','Salvează adresa'):at('Salva modifiche','Salvează modificările'),'primary'); submit.type='submit'; form.append(submit); card.append(form); host.append(card);
}

setMode(mode,false);
applyTranslations();
if(params.get('error')||params.get('error_code')){ history.replaceState(null,'',location.pathname+location.search); msg(at('Link non valido o scaduto. Richiedi un nuovo link.','Link invalid sau expirat. Cere un link nou.'),true); }
else if(params.get('access_token')&&params.get('type')==='recovery'){ recoveryToken=params.get('access_token'); history.replaceState(null,'',location.pathname+location.search); setMode('reset'); }
else if(params.get('access_token')&&params.get('refresh_token')){ srAccountSave({access_token:params.get('access_token'),refresh_token:params.get('refresh_token'),expires_in:Number(params.get('expires_in')||3600)}); history.replaceState(null,'',location.pathname+location.search); show().then(()=>{if(currentUser) msg(at('Accesso confermato. Benvenuto!','Autentificare confirmată. Bun venit!'));}).catch(e=>msg(friendly(e),true)); }
else if(mode!=='recover') show().catch(e=>msg(friendly(e),true));
