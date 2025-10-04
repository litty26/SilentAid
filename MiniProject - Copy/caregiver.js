/* Caregiver dashboard — expanded tools */
const qs = id => document.getElementById(id);
const qsa = sel => Array.from(document.querySelectorAll(sel));

/* Auth */
let session = JSON.parse(localStorage.getItem('currentSession') || 'null');
if (!session || session.role !== 'caregiver') {
  alert('No active caregiver session. Redirecting to login.');
  localStorage.removeItem('currentSession');
  location.href = 'index.html';
}
const CG = session.username;

/* State */
let connectedUser = '';
let currentLang = 'en-US';
let dnd = JSON.parse(localStorage.getItem(`cg_dnd_${CG}`) || 'false');
let lastEmergencyTS = null;
const PACKS_KEY = `cg_packs_${CG}`;

/* UI boot */
function updateClock(){
  const el = document.querySelector('.cg-clock');
  if(el) el.textContent = new Date().toLocaleString();
}
setInterval(updateClock,1000); updateClock();

qs('langSelect').addEventListener('change', e=> currentLang = e.target.value);
qs('themeToggle').addEventListener('click', ()=>{
  document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', document.body.classList.contains('dark-theme'));
});
if (localStorage.getItem('theme') === 'true') document.body.classList.add('dark-theme');

qs('profileSection').innerHTML = `<p>Signed in as <strong>${CG}</strong></p>`;

/* Presence */
function touchPresence(){
  if(!connectedUser) return;
  localStorage.setItem(`presence_${connectedUser}`, JSON.stringify({ ts: Date.now(), by: CG }));
}
function renderPresence(){
  const seen = document.getElementById('ovSeen');
  const status = document.getElementById('ovStatus');
  const info = document.getElementById('presenceInfo');

  if(!connectedUser){
    if(seen) seen.textContent = '—';
    if(status) status.textContent = 'Not linked';
    if(info) info.textContent = '';
    return;
  }
  const raw = localStorage.getItem(`presence_${connectedUser}`);
  if(!raw){
    if(info) info.textContent = 'Last seen: unknown';
    if(seen) seen.textContent = 'unknown';
    if(status) status.textContent = 'away';
    return;
  }
  try{
    const p = JSON.parse(raw);
    const time = new Date(p.ts).toLocaleString();
    if(info) info.textContent = `Last seen: ${time}`;
    if(seen) seen.textContent = time;
    if(status) status.textContent = 'online';
  }catch{}
}

/* Link by username */
qs('linkUserBtn').addEventListener('click', ()=>{
  const u = qs('linkUserInput').value.trim();
  if(!u) return alert('Enter a username to link');
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  if(!users[u]) return alert('User not found');
  users[CG] = users[CG] || {}; users[CG].connectedUser = u;
  localStorage.setItem('users', JSON.stringify(users));
  connectedUser = u; renderConnectedInfo(); loadUserData(); renderUsage();
  alert('Linked to user: ' + u);
});

/* Code / QR pairing (local simulation) */
function currentLinkCode(){
  let code = localStorage.getItem(`cg_code_${CG}`);
  if(!code){ code = (Math.random()*1e6|0).toString().padStart(6,'0'); localStorage.setItem(`cg_code_${CG}`, code); }
  return code;
}
qs('useCodeBtn').addEventListener('click', ()=>{
  const code = qs('linkCodeInput').value.trim();
  if(code.length !== 6) return alert('Enter a 6‑digit code');
  const map = JSON.parse(localStorage.getItem('link_codes') || '{}');
  const user = map[code];
  if(!user) return alert('Code not found. Ask the user to show the code.');
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  users[CG] = users[CG] || {}; users[CG].connectedUser = user;
  localStorage.setItem('users', JSON.stringify(users));
  connectedUser = user; renderConnectedInfo(); loadUserData(); renderUsage();
  alert('Linked to ' + user);
});
qs('showQRBtn').addEventListener('click', ()=>{
  const wrap = qs('careQR');
  if(wrap.classList.contains('sr-only')){
    const code = currentLinkCode();
    wrap.classList.remove('sr-only'); wrap.removeAttribute('aria-hidden');
    wrap.innerHTML = `<div><strong>Pair code:</strong> ${code}</div><div class="cg-hint">User can enter this code.</div>`;
    const map = JSON.parse(localStorage.getItem('link_codes') || '{}');
    map[code] = connectedUser || ''; localStorage.setItem('link_codes', JSON.stringify(map));
  }else{
    wrap.classList.add('sr-only'); wrap.setAttribute('aria-hidden','true');
  }
});

/* Connected info + overview */
function renderConnectedInfo(){
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  const cgData = users[CG] || {};
  connectedUser = cgData.connectedUser || connectedUser || '';
  const info = qs('connectedInfo');
  info.innerHTML = connectedUser
    ? `<p><strong>${connectedUser}</strong></p><p class="cg-hint">You will receive emergency alerts for this user.</p>`
    : `<p class="cg-hint">No user linked. Use username, code, or QR to pair.</p>`;

  const ov = document.getElementById('ovUser');
  if(ov) ov.textContent = connectedUser || 'No user linked';
  renderPresence();
}

/* Manage phrases */
function filtered(list){
  const q = (qs('phraseSearch')?.value || '').toLowerCase();
  const f = qs('phraseFilter')?.value || '';
  return list.filter(x=>{
    const okQ = !q || x.toLowerCase().includes(q);
    const len = x.length;
    const okF = !f || (f==='short' && len<=12) || (f==='long' && len>12);
    return okQ && okF;
  });
}
function loadUserData(){
  if(!connectedUser) return;
  const quickRaw = localStorage.getItem(`quickPhrases_${connectedUser}`) || '[]';
  const savedRaw = localStorage.getItem(`savedPhrases_${connectedUser}`) || '[]';
  let quick = JSON.parse(quickRaw); let saved = JSON.parse(savedRaw);

  const qp = qs('userQuickPhrases'); qp.innerHTML='';
  filtered(quick).forEach((q,i)=>{
    const chip = document.createElement('div'); chip.className='cg-chip'; chip.textContent=q;
    const del = document.createElement('span'); del.textContent='✖'; del.className='del';
    del.onclick=()=>{ quick = JSON.parse(localStorage.getItem(`quickPhrases_${connectedUser}`) || '[]');
                      const idx = quick.indexOf(q); if(idx>-1){ quick.splice(idx,1); localStorage.setItem(`quickPhrases_${connectedUser}`, JSON.stringify(quick)); loadUserData(); } };
    chip.appendChild(del); qp.appendChild(chip);
  });

  const sp = qs('userSavedPhrases'); sp.innerHTML='';
  filtered(saved).forEach((s,i)=>{
    const card = document.createElement('div'); card.className='cg-alert';
    card.innerHTML = `<div>${s}</div>`;
    const del = document.createElement('button'); del.className='cg-btn danger'; del.textContent='Delete';
    del.onclick=()=>{ saved = JSON.parse(localStorage.getItem(`savedPhrases_${connectedUser}`) || '[]');
                      const idx = saved.indexOf(s); if(idx>-1){ saved.splice(idx,1); localStorage.setItem(`savedPhrases_${connectedUser}`, JSON.stringify(saved)); loadUserData(); } };
    card.appendChild(del); sp.appendChild(card);
  });

  touchPresence();
}
qs('addQuickBtn').addEventListener('click', ()=>{
  if(!connectedUser) return alert('Link a user first');
  const phrase = qs('newQuick').value.trim(); if(!phrase) return;
  const key = `quickPhrases_${connectedUser}`;
  const arr = JSON.parse(localStorage.getItem(key) || '[]'); arr.push(phrase);
  localStorage.setItem(key, JSON.stringify(arr));
  qs('newQuick').value=''; loadUserData(); renderUsage();
});
qs('bulkClearQuick').addEventListener('click', ()=>{
  if(!connectedUser) return;
  if(confirm('Remove all quick phrases for this user?')){
    localStorage.setItem(`quickPhrases_${connectedUser}`, JSON.stringify([]));
    loadUserData(); renderUsage();
  }
});
['phraseSearch','phraseFilter'].forEach(id=>{
  const el = document.getElementById(id); if(el) el.addEventListener('input', loadUserData);
});

/* Overview quick actions */
const ovSpeakBtn = document.getElementById('ovSpeakBtn');
const ovPingBtn = document.getElementById('ovPingBtn');
const ovWaterBtn = document.getElementById('ovWaterBtn');
const ovMedsBtn = document.getElementById('ovMedsBtn');
function mail(key, payload){ if(!connectedUser) return alert('Link a user first'); localStorage.setItem(`${key}_${connectedUser}`, JSON.stringify(payload)); }
ovSpeakBtn.addEventListener('click', ()=> mail('mail_say', {t:'Hello! Your caregiver is here.', ts:Date.now(), by:CG}));
ovPingBtn.addEventListener('click', ()=> { mail('mail_checkin', {ts:Date.now(), by:CG}); speakLocal('Ping sent'); });
ovWaterBtn.addEventListener('click', ()=> { const k=`reminders_${connectedUser}`; const arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.push('[Hydration] Please drink water.'); localStorage.setItem(k, JSON.stringify(arr)); speakLocal('Hydration reminder sent'); });
ovMedsBtn.addEventListener('click', ()=> { const k=`reminders_${connectedUser}`; const arr=JSON.parse(localStorage.getItem(k)||'[]'); arr.push('[Medication] Time to take meds.'); localStorage.setItem(k, JSON.stringify(arr)); speakLocal('Medication reminder sent'); });

/* Remote & mailbox */
function speakLocal(text){
  try{ const u=new SpeechSynthesisUtterance(text); u.lang=currentLang; window.speechSynthesis.speak(u);}catch{}
}
qs('remoteSayBtn').addEventListener('click', ()=>{
  if(!connectedUser) return alert('Link a user first');
  const text = qs('remoteSayInput').value.trim(); if(!text) return;
  mail('mail_say', {t:text, ts:Date.now(), by:CG}); speakLocal('Sent to user'); qs('remoteSayInput').value='';
});
qs('sendReminderBtn').addEventListener('click', ()=>{
  if(!connectedUser) return alert('Link a user first');
  const text = qs('remoteReminderInput').value.trim(); if(!text) return;
  const key = `reminders_${connectedUser}`; const arr = JSON.parse(localStorage.getItem(key) || '[]'); arr.push(`[From ${CG}] ${text}`); localStorage.setItem(key, JSON.stringify(arr));
  qs('remoteReminderInput').value=''; speakLocal('Reminder set');
});
qs('checkInBtn').addEventListener('click', ()=>{ if(!connectedUser) return alert('Link a user first'); mail('mail_checkin', {ts:Date.now(), by:CG}); qs('checkInStatus').textContent='Check‑in sent…'; });
qs('clearMailbox').addEventListener('click', ()=>{ if(!connectedUser) return; ['mail_say','mail_checkin'].forEach(k=> localStorage.removeItem(`${k}_${connectedUser}`)); renderMailbox(); });

function renderMailbox(){
  const box = qs('mailboxList'); if(!box) return; box.innerHTML='';
  ['mail_say','mail_checkin'].forEach(k=>{
    const raw = localStorage.getItem(`${k}_${connectedUser}`); if(!raw) return;
    try{
      const p=JSON.parse(raw);
      const div = document.createElement('div'); div.className='item';
      div.textContent = k.replace('mail_','') + ': ' + (p.t || '(ping)') + ' — ' + new Date(p.ts).toLocaleString();
      box.appendChild(div);
    }catch{}
  });
}

/* Realtime alerts and usage */
function addAlertCard(p){
  const list = qs('alertsList'); if(!list) return;
  const el = document.createElement('div'); el.className='cg-alert';
  el.innerHTML = `<strong>${p.type}</strong><small>${new Date(p.ts).toLocaleString()} — from ${p.user}</small>`;
  const ack = document.createElement('button'); ack.className='cg-btn ghost'; ack.textContent='Acknowledge';
  ack.onclick=()=>{ el.style.opacity=.6; ack.disabled=true; };
  el.appendChild(ack); list.prepend(el);
  if(!dnd) speakLocal(`${p.type} from ${p.user}`);
}
window.addEventListener('storage', (e)=>{
  if(e.key==='lastEmergency' && e.newValue){
    try{ const p=JSON.parse(e.newValue); if(p.user===connectedUser) addAlertCard(p); }catch{}
  }
  if(connectedUser && (e.key===`mail_say_${connectedUser}` || e.key===`mail_checkin_${connectedUser}`)) renderMailbox();
});

/* DND */
qs('dndToggle').checked = dnd;
qs('dndToggle').addEventListener('change', (e)=> { dnd = e.target.checked; localStorage.setItem(`cg_dnd_${CG}`, dnd); });

/* Export / Import */
qs('exportBtn').addEventListener('click', ()=>{
  if(!connectedUser) return alert('Link a user first');
  const data = {
    savedPhrases: JSON.parse(localStorage.getItem(`savedPhrases_${connectedUser}`) || '[]'),
    quickPhrases: JSON.parse(localStorage.getItem(`quickPhrases_${connectedUser}`) || '[]'),
    reminders: JSON.parse(localStorage.getItem(`reminders_${connectedUser}`) || '[]')
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `${connectedUser}_data.json`; a.click();
});
qs('importFile').addEventListener('change', (e)=>{
  if(!connectedUser) return alert('Link a user first');
  const f=e.target.files[0]; if(!f) return;
  const r=new FileReader(); r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(d.savedPhrases) localStorage.setItem(`savedPhrases_${connectedUser}`, JSON.stringify(d.savedPhrases));
      if(d.quickPhrases) localStorage.setItem(`quickPhrases_${connectedUser}`, JSON.stringify(d.quickPhrases));
      if(d.reminders) localStorage.setItem(`reminders_${connectedUser}`, JSON.stringify(d.reminders));
      loadUserData(); renderUsage(); alert('Imported');
    }catch{ alert('Invalid file'); }
  }; r.readAsText(f);
});

/* Packs */
function readPacks(){ return JSON.parse(localStorage.getItem(PACKS_KEY) || '[]'); }
function writePacks(arr){ localStorage.setItem(PACKS_KEY, JSON.stringify(arr)); }
function renderPacks(){
  const list=qs('packList'); if(!list) return; list.innerHTML='';
  readPacks().forEach((p,i)=>{
    const card=document.createElement('div'); card.className='cg-pack';
    card.innerHTML=`<h4>${p.name}</h4><div class="cg-hint">${p.items.length} items</div>`;
    const row=document.createElement('div'); row.className='cg-row';
    const edit=document.createElement('button'); edit.className='cg-btn ghost'; edit.textContent='Edit'; edit.onclick=()=>openPack(i);
    const push=document.createElement('button'); push.className='cg-btn primary'; push.textContent='Push to user'; push.onclick=()=>pushPack(i);
    row.append(edit,push); card.appendChild(row); list.appendChild(card);
  });
}
qs('createPackBtn').addEventListener('click', ()=>{
  const name=qs('packName').value.trim(); if(!name) return;
  const packs=readPacks(); packs.push({name,items:[]}); writePacks(packs); qs('packName').value=''; renderPacks();
});
function openPack(idx){
  const packs=readPacks(); const pack=packs[idx]; if(!pack) return;
  const dlg=qs('packModal'); qs('packTitle').textContent=`Edit: ${pack.name}`;
  const list=qs('packPhrases'); list.innerHTML='';
  pack.items.forEach((it,ii)=>{
    const row=document.createElement('div'); row.className='cg-row';
    const span=document.createElement('div'); span.textContent=it; span.style.flex='1';
    const del=document.createElement('button'); del.className='cg-btn danger'; del.textContent='Delete';
    del.onclick=()=>{ pack.items.splice(ii,1); packs[idx]=pack; writePacks(packs); openPack(idx); };
    row.append(span,del); list.appendChild(row);
  });
  qs('addPackPhraseBtn').onclick=()=>{ const val=qs('packPhraseInput').value.trim(); if(!val) return; pack.items.push(val); packs[idx]=pack; writePacks(packs); qs('packPhraseInput').value=''; openPack(idx); };
  qs('deletePackBtn').onclick=()=>{ packs.splice(idx,1); writePacks(packs); dlg.close(); renderPacks(); };
  qs('pushPackBtn').onclick=()=>pushPack(idx);
  qs('closePackBtn').onclick=()=>dlg.close();
  dlg.showModal();
}
function pushPack(idx){
  if(!connectedUser) return alert('Link a user first');
  const p=readPacks()[idx]; if(!p) return;
  const key=`quickPhrases_${connectedUser}`; const arr=JSON.parse(localStorage.getItem(key) || '[]');
  p.items.forEach(it=>{ if(!arr.includes(it)) arr.push(it); });
  localStorage.setItem(key, JSON.stringify(arr)); loadUserData(); renderUsage(); alert('Pack pushed');
}

/* Tabs */
qs('cgTabs').addEventListener('click', (e)=>{
  const b=e.target.closest('.cg-tab'); if(!b) return;
  qsa('.cg-tab').forEach(x=>x.classList.toggle('active', x===b));
  const tab=b.dataset.tab;
  qsa('[data-panel]').forEach(c=>{
    const show=c.dataset.panel===tab;
    c.classList.toggle('sr-only', !show);
    c.setAttribute('aria-hidden', show ? 'false' : 'true');
  });
});

/* Alerts polling + mailbox refresh */
setInterval(()=>{
  try{
    const raw=localStorage.getItem('lastEmergency'); if(raw){
      const p=JSON.parse(raw);
      if(p.ts!==lastEmergencyTS && p.user===connectedUser){ lastEmergencyTS=p.ts; addAlertCard(p); }
    }
    renderMailbox();
  }catch{}
},1500);

/* Usage (top phrases) */
function renderUsage(){
  const box = qs('usageList'); if(!box) return; box.innerHTML='';
  if(!connectedUser){ box.innerHTML='<div class="cg-hint">No data</div>'; return; }
  const usage = JSON.parse(localStorage.getItem(`usage_${connectedUser}`) || '{}');
  const top = Object.entries(usage).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(top.length===0){ box.innerHTML='<div class="cg-hint">No usage yet</div>'; return; }
  top.forEach(([txt,count])=>{
    const row = document.createElement('div'); row.className='cg-row';
    const pill = document.createElement('div'); pill.className='cg-chip'; pill.textContent=txt;
    const c = document.createElement('div'); c.textContent = `×${count}`; c.style.marginLeft='auto'; c.style.color='#5b6b84';
    row.append(pill,c); box.appendChild(row);
  });
}

/* Init */
(function init(){
  const users=JSON.parse(localStorage.getItem('users') || '{}');
  if(users[CG] && users[CG].connectedUser) connectedUser=users[CG].connectedUser;
  qs('dndToggle').checked = dnd;
  renderConnectedInfo(); loadUserData(); renderPacks(); renderMailbox(); renderUsage();
})();
qs('logoutBtn').addEventListener('click', ()=>{ localStorage.removeItem('currentSession'); location.href='index.html'; });
