/* USER DASHBOARD SCRIPT
   LocalStorage model:
   - users (see index.html)
   - currentSession: { username, role }
   - savedPhrases_<username>, quickPhrases_<username>, reminders_<username>
   - lastEmergency : { user, type, ts }
*/
const qs = id => document.getElementById(id);

// Icon dictionary + categories
const ICONS = {
  hello:"👋", yes:"✅", no:"❌", thanks:"🙏", help:"🆘",
  hungry:"🍽️", thirsty:"🥤", bathroom:"🚻", doctor:"👨‍⚕️",
  happy:"😊", sad:"😢", angry:"😠", tired:"😪",
  pain:"🤕", water:"💧", food:"🍲", cold:"🧊", hot:"🔥"
};
const CATS = {
  basic:[ {t:"Hello",k:"hello"}, {t:"Yes",k:"yes"}, {t:"No",k:"no"}, {t:"Thanks",k:"thanks"}, {t:"I need help",k:"help"} ],
  needs:[ {t:"I am hungry",k:"hungry"}, {t:"I am thirsty",k:"thirsty"}, {t:"Bathroom",k:"bathroom"}, {t:"Call the doctor",k:"doctor"} ],
  feel:[ {t:"I am happy",k:"happy"}, {t:"I am sad",k:"sad"}, {t:"I am angry",k:"angry"}, {t:"I am tired",k:"tired"} ],
  care:[ {t:"Pain",k:"pain"}, {t:"Need water",k:"water"}, {t:"Need food",k:"food"}, {t:"Too cold",k:"cold"}, {t:"Too hot",k:"hot"} ],
};
let currentCat = 'basic';

const setPref = (k,v)=> localStorage.setItem(`${k}_${USER}`, JSON.stringify(v));
const getPref = (k,f)=> JSON.parse(localStorage.getItem(`${k}_${USER}`) ?? JSON.stringify(f));

// Session guard
let session = JSON.parse(localStorage.getItem('currentSession') || 'null');
if (!session || session.role !== 'user') {
  alert('No active user session. Redirecting to login.');
  localStorage.removeItem('currentSession');
  location.href = 'index.html';
}
const USER = session.username || 'unknown_user';
let currentLang = 'en-US';

// === Caregiver linking (user side) ===
function renderLinkedCaregiver(){
  const box = document.getElementById('linkedCgInfo');
  if(!box) return;
  const users = JSON.parse(localStorage.getItem('users') || '{}');
  const me = users[USER] || {};
  box.textContent = me.connectedCaregiver ? `Linked caregiver: ${me.connectedCaregiver}` : 'No caregiver linked';
}

function linkCaregiverByName(){
  const cg = (document.getElementById('cgNameInput')?.value || '').trim();
  if(!cg) return alert('Enter caregiver username');

  const users = JSON.parse(localStorage.getItem('users') || '{}');

  // must exist and must be a caregiver account
  const cgRecord = users[cg];
  if(!cgRecord || cgRecord.role !== 'caregiver'){
    alert('Caregiver not found. Ask them to sign up and sign in as caregiver.');
    return;
  }

  // write mutual link
  users[USER] = users[USER] || {};
  users[USER].connectedCaregiver = cg;

  users[cg] = cgRecord;
  users[cg].connectedUser = USER;

  localStorage.setItem('users', JSON.stringify(users));
  renderLinkedCaregiver();
  alert('Linked to caregiver: ' + cg);
}

function linkCaregiverByCode(){
  const code = (document.getElementById('cgCodeInput')?.value || '').trim();
  if(code.length !== 6) return alert('Enter a 6‑digit code');

  const users = JSON.parse(localStorage.getItem('users') || '{}');
  const map = JSON.parse(localStorage.getItem('link_codes') || '{}');

  // Find which caregiver owns this code
  // We scan caregivers to find one whose cg_code_<cg> equals this code
  let ownerCG = null;
  for(const uname of Object.keys(users)){
    const urec = users[uname];
    if(urec && urec.role === 'caregiver'){
      const cgCode = localStorage.getItem(`cg_code_${uname}`);
      if(cgCode === code){ ownerCG = uname; break; }
    }
  }

  if(!ownerCG){
    alert('No caregiver owns this code. Ask caregiver to show code again.');
    return;
  }

  // Confirm the caregiver exists and is caregiver role
  const cgRecord = users[ownerCG];
  if(!cgRecord || cgRecord.role !== 'caregiver'){
    alert('Invalid caregiver for this code.');
    return;
  }

  // Mark this code as claimed by this user (so caregiver "Use code" resolves)
  map[code] = USER;
  localStorage.setItem('link_codes', JSON.stringify(map));

  // Optional: immediately complete mutual link on user side
  users[USER] = users[USER] || {};
  users[USER].connectedCaregiver = ownerCG;
  users[ownerCG].connectedUser = USER;
  localStorage.setItem('users', JSON.stringify(users));

  renderLinkedCaregiver();
  alert(`Linked to caregiver: ${ownerCG}`);
}

document.getElementById('cgLinkBtn')?.addEventListener('click', linkCaregiverByName);
document.getElementById('cgUseCodeBtn')?.addEventListener('click', linkCaregiverByCode);

// Presence heartbeat (lets caregiver show "online/last seen")
setInterval(()=>{
  localStorage.setItem(`presence_${USER}`, JSON.stringify({ ts: Date.now(), by: USER }));
}, 4000);

renderLinkedCaregiver();

// Profile
function loadProfile() {
  qs('profileSection').innerHTML = `<p>User: <strong>${USER}</strong></p>`;
}
loadProfile();

// Clock
function updateClock(){ qs('clock').textContent = new Date().toLocaleString(); }
setInterval(updateClock,1000); updateClock();

// Speech
function speakText(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = currentLang;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
  trackUsage(text);
}
function trackUsage(text) {
  const key = `usage_${USER}`;
  const usage = JSON.parse(localStorage.getItem(key) || '{}');
  usage[text] = (usage[text]||0)+1;
  localStorage.setItem(key, JSON.stringify(usage));
}
qs('speakBtn').addEventListener('click', ()=> speakText(qs('messageInput').value.trim()));
qs('clearMsgBtn').addEventListener('click', ()=> qs('messageInput').value='');

// Voice input
function startVoiceInput(){
  try {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new Recognition();
    r.lang = currentLang;
    r.start();
    r.onresult = e => { qs('messageInput').value = e.results[0][0].transcript; };
    r.onerror = ()=> showMessage('🎤 Voice input error');
  } catch { showMessage('🎤 Speech recognition not available'); }
}
qs('voiceInputBtn').addEventListener('click', startVoiceInput);

// Quick phrases
function renderQuickPhrases(){
  const key = `quickPhrases_${USER}`;
  let quick = JSON.parse(localStorage.getItem(key) || '["I am hungry","I need help","I am thirsty","I am happy"]');
  const cont = qs('quickPhrases'); cont.innerHTML='';
  quick.forEach((p,i)=>{
    const row = document.createElement('div'); row.className='u-chip-row';
    const btn = document.createElement('button'); btn.className='u-chip'; btn.textContent=p; btn.onclick = ()=> speakText(p);
    const edit = document.createElement('button'); edit.className='u-icon-btn'; edit.textContent='✏'; edit.title='Edit';
    edit.onclick = ()=>{
      const np = prompt('Edit phrase:', p);
      if (np && np.trim()){ quick[i]=np.trim(); localStorage.setItem(key, JSON.stringify(quick)); renderQuickPhrases(); }
    };
    row.append(btn, edit); cont.appendChild(row);
  });
}
renderQuickPhrases();

// Saved phrases
function loadSavedPhrases(){
  const key = `savedPhrases_${USER}`;
  let phrases = JSON.parse(localStorage.getItem(key) || '[]');
  const container = qs('savedPhrases'); container.innerHTML='';
  phrases.forEach((p, idx)=>{
    const row = document.createElement('div'); row.className='u-chip-row';
    const btn = document.createElement('button'); btn.className='u-chip success'; btn.textContent=p; btn.onclick = ()=> speakText(p);
    const del = document.createElement('button'); del.className='u-icon-btn danger'; del.textContent='❌'; del.title='Delete';
    del.onclick = ()=>{
      phrases.splice(idx,1); localStorage.setItem(key, JSON.stringify(phrases)); loadSavedPhrases();
    };
    row.append(btn, del); container.appendChild(row);
  });
}
loadSavedPhrases();

qs('saveBtn').addEventListener('click', ()=> {
  const val = qs('customPhrase').value.trim(); if(!val) return;
  const key = `savedPhrases_${USER}`; let arr = JSON.parse(localStorage.getItem(key) || '[]'); arr.push(val); localStorage.setItem(key, JSON.stringify(arr));
  qs('customPhrase').value=''; loadSavedPhrases();
});

// Reminders
function loadReminders(){
  const key = `reminders_${USER}`;
  let reminders = JSON.parse(localStorage.getItem(key) || '[]');
  const cont = qs('reminderList'); cont.innerHTML='';
  reminders.forEach((r,idx)=>{
    const row = document.createElement('div'); row.className='u-chip-row';
    const s = document.createElement('span'); s.textContent = r; s.className='u-pill';
    const del = document.createElement('button'); del.className='u-icon-btn danger'; del.textContent='❌'; del.title='Delete';
    del.onclick = ()=>{
      reminders.splice(idx,1); localStorage.setItem(key, JSON.stringify(reminders)); loadReminders();
    };
    row.append(s, del); cont.appendChild(row);
  });
}
loadReminders();
qs('addReminderBtn').addEventListener('click', ()=> {
  const v = qs('reminderInput').value.trim(); if(!v) return;
  const k = `reminders_${USER}`; const arr = JSON.parse(localStorage.getItem(k) || '[]'); arr.push(v); localStorage.setItem(k, JSON.stringify(arr));
  qs('reminderInput').value=''; loadReminders();
});

// Emergency
function triggerEmergency(type='I need help') {
  const payload = { user: USER, type, ts: new Date().toISOString() };
  localStorage.setItem('lastEmergency', JSON.stringify(payload));
  showMessage('🚨 Emergency triggered!');
  speakText(type);
}
qs('e1').addEventListener('click', ()=> triggerEmergency('I need help'));
qs('e2').addEventListener('click', ()=> triggerEmergency('Call the doctor'));
document.querySelectorAll('.emergency').forEach(btn => btn.addEventListener('click', ()=> triggerEmergency(btn.dataset.contact)));

// Export / import
qs('exportBtn').addEventListener('click', ()=> {
  const data = {
    savedPhrases: JSON.parse(localStorage.getItem(`savedPhrases_${USER}`) || '[]'),
    quickPhrases: JSON.parse(localStorage.getItem(`quickPhrases_${USER}`) || '[]'),
    reminders: JSON.parse(localStorage.getItem(`reminders_${USER}`) || '[]'),
    usage: JSON.parse(localStorage.getItem(`usage_${USER}`) || '{}')
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = `${USER}_silentAid_backup.json`; a.click();
});
qs('importFile').addEventListener('change', (e)=>{
  const f = e.target.files[0]; if(!f) return;
  const r = new FileReader(); r.onload = () => {
    try {
      const data = JSON.parse(r.result);
      if (data.savedPhrases) localStorage.setItem(`savedPhrases_${USER}`, JSON.stringify(data.savedPhrases));
      if (data.quickPhrases) localStorage.setItem(`quickPhrases_${USER}`, JSON.stringify(data.quickPhrases));
      if (data.reminders) localStorage.setItem(`reminders_${USER}`, JSON.stringify(data.reminders));
      loadSavedPhrases(); renderQuickPhrases(); loadReminders();
      alert('Import successful');
    } catch { alert('Invalid file'); }
  };
  r.readAsText(f);
});

// Messages
function showMessage(m) {
  const el = qs('systemMessages'); el.textContent = m; el.classList.remove('sr-only');
  setTimeout(()=> el.classList.add('sr-only'), 3000);
}

// Draft autosave
setInterval(()=> {
  const draft = qs('messageInput').value || '';
  localStorage.setItem(`draft_${USER}`, draft);
}, 2000);
window.addEventListener('load', ()=> {
  const d = localStorage.getItem(`draft_${USER}`); if (d) qs('messageInput').value = d;
});

// Theme + logout
qs('themeToggle').addEventListener('click', ()=> {
  document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', document.body.classList.contains('dark-theme'));
});
if (localStorage.getItem('theme') === 'true') document.body.classList.add('dark-theme');

qs('logoutBtn').addEventListener('click', ()=> {
  localStorage.removeItem('currentSession'); location.href='index.html';
});

// Keyboard shortcuts 1..6
document.addEventListener('keydown', (e)=> {
  if (e.key >= '1' && e.key <= '6') {
    const quick = JSON.parse(localStorage.getItem(`quickPhrases_${USER}`) || '["I am hungry","I need help","I am thirsty","I am happy"]');
    const idx = parseInt(e.key, 10) - 1;
    if (quick[idx]) speakText(quick[idx]);
  }
});

function tileMarkup(item, iconSize, faved){
  const fs = Math.round(iconSize*0.5);
  return `
    <div class="u-ico" style="width:${iconSize}px;height:${iconSize}px;font-size:${fs}px">${ICONS[item.k]||"🔹"}</div>
    <div class="u-label">${item.t}</div>
    <button class="u-star" title="Favorite" aria-label="Favorite">${faved?"⭐":"☆"}</button>
  `;
}
function renderTiles(){
  const grid = qs('quickPhrases');
  const favStrip = qs('favStrip');
  const hideLabel = getPref('hideLabel', false);
  const iconSize = getPref('iconSize', 88);
  const favs = new Set(getPref('favorites', []));
  const playHints = getPref('playHints', true);

  [grid, favStrip].forEach(g=> g.classList.toggle('u-hide-label', hideLabel));

  // favorites first strip
  favStrip.innerHTML = '';
  favs.forEach(key=>{
    const item = Object.values(CATS).flat().find(x => x.k===key);
    if(!item) return;
    const tile = document.createElement('button');
    tile.className = 'u-tile faved';
    tile.dataset.text = item.t; tile.dataset.key = item.k;
    tile.innerHTML = tileMarkup(item, iconSize, true);
    attachTileHandlers(tile, playHints);
    favStrip.appendChild(tile);
  });

  // category tiles
  const items = currentCat==='fav' ? [] : (CATS[currentCat]||[]);
  grid.innerHTML = '';
  items.forEach(it=>{
    const faved = favs.has(it.k);
    const tile = document.createElement('button');
    tile.className = 'u-tile'+(faved?' faved':'');
    tile.dataset.text = it.t; tile.dataset.key = it.k;
    tile.innerHTML = tileMarkup(it, iconSize, faved);
    attachTileHandlers(tile, playHints);
    grid.appendChild(tile);
  });
}
function attachTileHandlers(tile, playHints){
  const speak = ()=> speakText(tile.dataset.text);
  tile.addEventListener('click', (e)=>{
    if(e.target.classList.contains('u-star')){
      const favs = new Set(getPref('favorites', []));
      const k = tile.dataset.key;
      if(favs.has(k)) favs.delete(k); else favs.add(k);
      setPref('favorites', Array.from(favs));
      renderTiles();
      return;
    }
    speak();
  });
  // long-press variants demo ( bathroom -> “I need help in bathroom” )
  let pressT;
  tile.addEventListener('pointerdown', ()=> { pressT = setTimeout(()=> speakText(`${tile.dataset.text} please`), 550); });
  tile.addEventListener('pointerup', ()=> clearTimeout(pressT));
  tile.addEventListener('pointerleave', ()=> clearTimeout(pressT));

  if(playHints){
    tile.addEventListener('mouseenter', ()=> {
      try{
        const u = new SpeechSynthesisUtterance(tile.dataset.text);
        u.lang = currentLang; u.rate = 1.05; u.volume = .6;
        window.speechSynthesis.speak(u);
      }catch{}
    });
  }
}

// Tabs
document.getElementById('qpTabs').addEventListener('click', (e)=>{
  const b = e.target.closest('.u-tab'); if(!b) return;
  document.querySelectorAll('#qpTabs .u-tab').forEach(x=> x.classList.toggle('active', x===b));
  currentCat = b.dataset.cat || 'basic';
  renderTiles();
});

// Settings
const imgOnly = qs('imageOnlyToggle');
const sizeRange = qs('iconSizeRange');
const hintToggle = qs('playHintToggle');

imgOnly.checked = getPref('hideLabel', false);
sizeRange.value = getPref('iconSize', 88);
hintToggle.checked = getPref('playHints', true);

imgOnly.addEventListener('change', ()=> { setPref('hideLabel', imgOnly.checked); renderTiles(); });
sizeRange.addEventListener('input', ()=> { setPref('iconSize', parseInt(sizeRange.value,10)); renderTiles(); });
hintToggle.addEventListener('change', ()=> { setPref('playHints', hintToggle.checked); renderTiles(); });

// Initial render
renderTiles();

// Auto-consume caregiver messages
setInterval(()=>{
  try{
    const sayRaw = localStorage.getItem(`mail_say_${USER}`);
    if(sayRaw){
      const msg = JSON.parse(sayRaw);
      if(msg && msg.t) speakText(msg.t);
      localStorage.removeItem(`mail_say_${USER}`);
    }
    const pingRaw = localStorage.getItem(`mail_checkin_${USER}`);
    if(pingRaw){
      showMessage('🔔 Caregiver pinged — are you okay?');
      speakText('Caregiver ping. Are you okay?');
      localStorage.removeItem(`mail_checkin_${USER}`);
    }
  }catch{}
}, 2000);


