/**
 * Jarvis — Ironman LLM Edition (client)
 * - Hinglish support (lang selector)
 * - Voice I/O
 * - Gemini LLM proxy via POST /api/chat (server)
 * - PWA-ready (manifest + service worker)
 */

const useLLM = document.getElementById('useLLM');
const micBtn = document.getElementById('micBtn');
const sendBtn = document.getElementById('sendBtn');
const textInput = document.getElementById('textInput');
const conversation = document.getElementById('conversation');
const statusText = document.getElementById('statusText');
const voiceSelect = document.getElementById('voiceSelect');
const rateInput = document.getElementById('rate');
const pitchInput = document.getElementById('pitch');
const quick = document.querySelectorAll('.quick button');
const showNotesBtn = document.getElementById('showNotes');
const showRmdBtn = document.getElementById('showRmd');
const langSelect = document.getElementById('langSelect');

let synth = window.speechSynthesis;
let voices = [];
let selectedVoiceIndex = 0;

function setStatus(t){ statusText.textContent = t; }
function appendMessage(text, who='assistant'){
  const el = document.createElement('div');
  el.className = who === 'user' ? 'user' : 'assistant';
  el.textContent = text;
  conversation.appendChild(el);
  conversation.scrollTop = conversation.scrollHeight;
}

function speak(text, lang){
  if(!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voices[selectedVoiceIndex] || null;
  // choose language: if Hinglish, prefer hi-IN voice if available, else en-IN
  u.lang = lang === 'hi' ? 'hi-IN' : (lang === 'en' ? 'en-IN' : (lang === 'hinglish' ? (voices.find(v=>v.lang && v.lang.startsWith('hi')) ? 'hi-IN' : 'en-IN') : 'en-IN'));
  u.rate = Number(rateInput.value) || 1;
  u.pitch = Number(pitchInput.value) || 1;
  synth.cancel();
  synth.speak(u);
}

function loadVoices(){
  voices = synth.getVoices() || [];
  voiceSelect.innerHTML = '';
  voices.forEach((v,i)=>{
    const opt = document.createElement('option'); opt.value = i; opt.textContent = `${v.name} — ${v.lang}`; voiceSelect.appendChild(opt);
  });
}
if(synth){
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
  voiceSelect.addEventListener('change', ()=>{ selectedVoiceIndex = +voiceSelect.value; });
}

// notes & reminders (local)
function getNotes(){ return JSON.parse(localStorage.getItem('jarvis_notes')||'[]'); }
function saveNotes(a){ localStorage.setItem('jarvis_notes', JSON.stringify(a)); }
function addNote(txt){ const arr = getNotes(); arr.push({ text: txt, at: Date.now() }); saveNotes(arr); }
function getReminders(){ return JSON.parse(localStorage.getItem('jarvis_rmd')||'[]'); }
function saveReminders(a){ localStorage.setItem('jarvis_rmd', JSON.stringify(a)); }
function addReminder(text, whenTs){ const arr = getReminders(); arr.push({ text, ts: whenTs }); saveReminders(arr); }

setInterval(()=>{
  const now = Date.now();
  const rs = getReminders();
  const remaining = [];
  rs.forEach(r=>{
    if(r.ts <= now){
      appendMessage('Reminder: ' + r.text, 'assistant');
      speak('Reminder: ' + r.text, 'en');
    } else remaining.push(r);
  });
  if(remaining.length !== rs.length) saveReminders(remaining);
}, 30000);

// parse reminder
function parseReminder(text){
  const inMatch = text.match(/in (\d+) (minute|minutes|hour|hours)/i);
  if(inMatch){
    const n = +inMatch[1];
    const unit = inMatch[2].toLowerCase();
    const idx = text.toLowerCase().indexOf('to ');
    const msg = idx > -1 ? text.slice(idx+3) : 'Reminder';
    const ms = unit.startsWith('hour') ? n * 3600000 : n * 60000;
    return { text: msg, ts: Date.now() + ms };
  }
  const atMatch = text.match(/at (\d{1,2}:\d{2})/i);
  if(atMatch){
    const [hh, mm] = atMatch[1].split(':').map(s=>+s);
    const now = new Date(); let t = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hh, mm);
    if(t.getTime() < now.getTime()) t.setDate(t.getDate()+1);
    const idx = text.toLowerCase().indexOf('to '); const msg = idx>-1? text.slice(idx+3) : 'Reminder';
    return { text: msg, ts: t.getTime() };
  }
  return null;
}

// local command handling (fallback)
function localHandle(command, langTag){
  const txt = command.trim();
  const low = txt.toLowerCase();
  if(!txt) return;
  if(low.includes('time') || low.includes('samay') ){
    const now = new Date(); const res = `It's ${now.toLocaleTimeString()}.`; appendMessage(res,'assistant'); speak(res, langTag);
  } else if(low.includes('date') || low.includes('taarikh')){
    const now = new Date(); const res = `Today is ${now.toLocaleDateString()}.`; appendMessage(res,'assistant'); speak(res, langTag);
  } else if(low.includes('joke') || low.includes('mazaak')){
    const jokes = [ 'Why did the programmer quit? Because he didn\'t get arrays.', 'Mujhe joke sunna hai? Yeh ek programming joke hai.' ];
    const r = jokes[Math.floor(Math.random()*jokes.length)]; appendMessage(r,'assistant'); speak(r, langTag);
  } else if(low.startsWith('search:') || low.startsWith('search ')){
    const q = txt.split(/search[: ]+/i).pop().trim(); appendMessage('Searching for '+q,'assistant'); speak('Searching '+q, langTag); window.open('https://www.google.com/search?q=' + encodeURIComponent(q), '_blank');
  } else if(low.startsWith('note') || low.startsWith('remember') || low.includes('yaad rakho')){
    const note = txt.replace(/^(note|remember)[: ]*/i,'').trim(); if(note){ addNote(note); appendMessage('Saved note: '+note,'assistant'); speak('Saved note', langTag); } else appendMessage('Add note text','assistant');
  } else if(low.startsWith('remind me') || low.startsWith('set reminder') || low.includes('remind')){
    const parsed = parseReminder(txt); if(parsed){ addReminder(parsed.text, parsed.ts); appendMessage('Reminder set: '+parsed.text + ' at ' + new Date(parsed.ts).toLocaleString(),'assistant'); speak('Reminder set', langTag); } else appendMessage('Could not parse reminder','assistant');
  } else {
    appendMessage("I don't know that locally. Enable LLM for more.", 'assistant'); speak('Enable L L M for more.', langTag);
  }
}

// call backend LLM (Gemini) via /api/chat
async function callLLM(prompt){
  try{
    setStatus('Talking to Gemini...');
    const res = await fetch('/api/chat', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ prompt }) });
    if(!res.ok){ const t = await res.text(); throw new Error('Gemini error: '+res.status + ' ' + t); }
    const j = await res.json();
    return j.reply || 'No reply';
  } catch(e){
    console.error(e); return 'LLM failed: '+ (e.message || e);
  } finally { setStatus('Idle'); }
}

// dispatcher
async function handleCommand(raw){
  appendMessage(raw, 'user');
  const langSel = langSelect.value;
  const langTag = langSel === 'hi-IN' ? 'hi' : (langSel === 'hi-en' ? 'hinglish' : 'en');
  if(useLLM.checked){
    appendMessage('Thinking...','assistant');
    const reply = await callLLM(raw);
    appendMessage(reply,'assistant'); speak(reply, langTag);
  } else {
    localHandle(raw, langTag);
  }
}

// Speech recognition with Hinglish support
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null; let listening = false;
if(SR){
  recognition = new SR();
  recognition.interimResults = false;
  recognition.onstart = ()=>{ listening=true; micBtn.classList.add('on'); setStatus('Listening'); };
  recognition.onend = ()=>{ listening=false; micBtn.classList.remove('on'); setStatus('Idle'); };
  recognition.onerror = (e)=>{ console.error(e); setStatus('Recog error'); };
  recognition.onresult = (ev)=>{ const t = ev.results[0][0].transcript; textInput.value = t; handleCommand(t); };
}
micBtn.addEventListener('click', ()=>{
  if(!recognition){ alert('Speech recognition not supported. Use Chrome.'); return; }
  // set recognition language based on selector
  const langSel = langSelect.value;
  if(langSel === 'hi-IN') recognition.lang = 'hi-IN';
  else if(langSel === 'hi-en') recognition.lang = 'hi-IN'; // Hinglish -> use Hindi model to allow mixed input
  else recognition.lang = 'en-IN';
  if(listening) recognition.stop(); else recognition.start();
});

// UI bindings
sendBtn.addEventListener('click', ()=>{ const v = textInput.value.trim(); if(!v) return; handleCommand(v); textInput.value=''; });
textInput.addEventListener('keydown', e=>{ if(e.key==='Enter') sendBtn.click(); });
quick.forEach(b=>b.addEventListener('click', e=>{ const cmd = e.currentTarget.getAttribute('data-cmd'); handleCommand(cmd); }));
showNotesBtn && showNotesBtn.addEventListener('click', ()=>{ const notes = getNotes(); if(!notes.length) appendMessage('No notes','assistant'); else { appendMessage('Notes:','assistant'); notes.forEach(n=>appendMessage('- '+n.text,'assistant')); }});
showRmdBtn && showRmdBtn.addEventListener('click', ()=>{ const r = getReminders(); if(!r.length) appendMessage('No reminders','assistant'); else { appendMessage('Reminders:','assistant'); r.forEach(n=>appendMessage('- '+new Date(n.ts).toLocaleString()+': '+n.text,'assistant')); }});

// register service worker for PWA
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('/sw.js').then(()=>console.log('sw registered')).catch(()=>console.log('sw failed'));
}

appendMessage('Jarvis ready. Select language (Hinglish works best with "Hinglish" option).','assistant');
setStatus('Idle');
