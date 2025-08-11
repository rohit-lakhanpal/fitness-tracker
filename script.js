// Fitness Tracker main script (ES Module)
// Data persisted in localStorage under key FT_DATA_KEY

const FT_DATA_KEY = 'ft_data';
const DATA_VERSION = 1;

// ----- Default Workouts (edit to customize) -----
// Supports each exercise defined either as a string (name only) or an object: { name: 'Bench', plan: ['8-12','8-12','5-8','5-8'] }
// The "plan" array is displayed as reference rep ranges / scheme and does not constrain data entry.
export const DEFAULT_WORKOUTS = {
  session1: {
    name: 'Session 1 – Push (Chest/Shoulders/Arms)',
    exercises: [
      { name: 'Bench Press (Bar or DB)', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'DB Incline Press or Chest Fly', plan: ['8-12','8-12','8-12'] },
      { name: 'Seated Shoulder Press', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'Tricep Pushdown', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'Lateral / Front Raise (Alt)', plan: ['10-15 L','10-15 F','10-15 L','10-15 F','10-15 L'] },
      { name: 'Katanas or Overheads', plan: ['10-15','10-15','10-15','10-15'] }
    ]
  },
  session2: {
    name: 'Session 2 – Lower Body',
    exercises: [
      { name: 'Hack Squat', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'Trap Bar Deadlift or Leg Extensions', plan: ['8-12','8-12','8-12'] },
      { name: 'Leg Press', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'Calf Raises (Seated)', plan: ['8-12','8-12','8-12'] },
      { name: 'Box Step Ups', plan: ['8-12','8-12','8-12'] },
      { name: 'Hip Extensions', plan: ['8-12','8-12','8-12'] }
    ]
  },
  session3: {
    name: 'Session 3 – Pull (Back/Arms)',
    exercises: [
      { name: 'T Bar Row or Cable Row', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'EZY Bar Barbell Curl', plan: ['8-12','8-12','8-12'] },
      { name: 'Lat Pulldown', plan: ['8-12','8-12','5-8','5-8'] },
      { name: 'Seated Hammer Curl', plan: ['8-12','8-12','8-12'] },
      { name: 'Single Arm DB Row', plan: ['8-12','8-12','8-12'] },
      { name: 'Rear Delt DB Fly or Pull Up Machine', plan: ['10-15','10-15','10-15'] }
    ]
  }
};

// ----- Utility -----
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));
const uuid = () => crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2,11);
const todayISO = () => new Date().toISOString();
const formatDateTime = iso => new Date(iso).toLocaleString([], { dateStyle:'medium', timeStyle:'short' });

function toast(msg, timeout=2500){
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._timer);
  toast._timer = setTimeout(()=> t.classList.add('hidden'), timeout);
}

// ----- Data Layer -----
function loadData(){
  try { const raw = localStorage.getItem(FT_DATA_KEY); if(!raw) return null; return JSON.parse(raw); } catch { return null; }
}
function saveData(data){ localStorage.setItem(FT_DATA_KEY, JSON.stringify(data)); }
function initData(){
  const existing = loadData();
  if (existing && existing.version === DATA_VERSION) return existing;
  const base = { version: DATA_VERSION, workouts: mapDefaultWorkouts(), sessions: [] };
  saveData(base);
  return base;
}
function mapDefaultWorkouts(){
  const out = {};
  for (const [k,v] of Object.entries(DEFAULT_WORKOUTS)) {
    out[k] = { name: v.name, exercises: v.exercises.map(e => typeof e === 'string' ? ({ name: e }) : ({ name: e.name, plan: e.plan })) };
  }
  return out;
}

let state = initData();

// ----- Current Session (in-memory) -----
let currentSession = null; // { id, date, workoutKey, exercises:[{ name, plan?, sets:[{ n, target?, weight, reps, notes }] }] }
let unsavedChanges = false;
let autoSaveTimer = null;
let lastAutoSavedAt = null;
const AUTOSAVE_DEBOUNCE_MS = 1200;

function newSession(workoutKey){
  const w = state.workouts[workoutKey];
  currentSession = {
    id: uuid(),
    date: todayISO(),
    workoutKey,
    exercises: w.exercises.map(e => ({
      name: e.name,
      plan: e.plan,
      sets: (e.plan ? e.plan.map((p,i)=> ({ n: i+1, target: p, weight: 0, reps: 0, notes: '' })) : [])
    }))
  };
  unsavedChanges = false;
  renderSessionMeta();
  renderExercises();
  toast('New session started');
}

function commitSession(){
  if(!currentSession) return;
  // Remove empty sessions (no sets recorded)
  const hasAnySet = currentSession.exercises.some(e => e.sets.length);
  if(!hasAnySet){ toast('No sets recorded'); return; }
  if(!state.sessions.includes(currentSession)) state.sessions.push(currentSession);
  saveData(state);
  unsavedChanges = false;
  lastAutoSavedAt = new Date();
  toast('Session saved');
  updateAutoSaveStatus();
}

function loadSession(sessionId){
  const s = state.sessions.find(s => s.id === sessionId);
  if(!s) return toast('Session not found');
  // Clone into a new working session (so edits don’t alter history until saved)
  currentSession = {
    id: uuid(),
    date: todayISO(),
    workoutKey: s.workoutKey,
    exercises: s.exercises.map(e => ({ name: e.name, plan: e.plan, sets: e.sets.map(set => ({...set})) }))
  };
  unsavedChanges = false; // treat as clean clone until edited
  renderWorkoutSelectValue(currentSession.workoutKey);
  renderSessionMeta();
  renderExercises();
  toast('Loaded into new session');
  closeHistory();
}

// ----- Export / Import -----
function exportData(){
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  const ts = new Date();
  const name = `fitness-tracker-export-${ts.getFullYear()}${String(ts.getMonth()+1).padStart(2,'0')}${String(ts.getDate()).padStart(2,'0')}.json`;
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  toast('Exported JSON');
}

function importData(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      if(incoming.version !== DATA_VERSION) return toast('Version mismatch');
      // Ask user merge vs replace
      const mode = confirm('OK = Merge (keep existing); Cancel = Replace');
      if(mode) {
        // Merge sessions by id uniqueness
        const existingIds = new Set(state.sessions.map(s => s.id));
        for(const sess of incoming.sessions){ if(!existingIds.has(sess.id)) state.sessions.push(sess); }
        // Merge workouts if new keys
        for(const [k,v] of Object.entries(incoming.workouts)) if(!state.workouts[k]) state.workouts[k]=v;
      } else {
        state = incoming;
      }
      saveData(state);
      toast(mode ? 'Merged data' : 'Replaced data');
      renderWorkoutOptions();
    } catch(err){ console.error(err); toast('Import failed'); }
  };
  reader.readAsText(file);
}

// ----- Rendering -----
function renderWorkoutOptions(){
  const sel = $('#workoutSelect');
  sel.innerHTML = '';
  for(const [k,v] of Object.entries(state.workouts)){
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = v.name; sel.appendChild(opt);
  }
}
function renderWorkoutSelectValue(key){
  const sel = $('#workoutSelect');
  if(sel.value !== key) sel.value = key;
}
function renderSessionMeta(){
  const meta = $('#sessionMeta');
  if(!currentSession){ meta.classList.add('hidden'); meta.innerHTML=''; return; }
  meta.classList.remove('hidden');
  meta.innerHTML = `<strong>${state.workouts[currentSession.workoutKey].name}</strong><br>${formatDateTime(currentSession.date)}<br>` +
    `<div class="session-actions"><button id="saveSessionBtn">Save Session</button><span id="autosaveStatus" class="autosave-status"></span></div>`;
  $('#saveSessionBtn').onclick = () => commitSession();
  updateAutoSaveStatus();
}
function renderExercises(){
  const container = $('#exercisesContainer');
  container.innerHTML='';
  if(!currentSession) return;
  for(const ex of currentSession.exercises){
    const tmpl = document.getElementById('exerciseTemplate');
    const node = tmpl.content.firstElementChild.cloneNode(true);
    const titleEl = node.querySelector('.exercise-title');
    titleEl.textContent = ex.name;
    if(ex.plan){
      const planWrap = document.createElement('div');
      planWrap.className = 'plan-line';
      for(const p of ex.plan){
        const span = document.createElement('span');
        span.className = 'plan-badge';
        span.textContent = p;
        planWrap.appendChild(span);
      }
      titleEl.after(planWrap);
    }
    const tbody = node.querySelector('tbody');
    for(const set of ex.sets){ tbody.appendChild(renderSetRow(ex, set)); }
  // Collapsible behavior
  titleEl.onclick = () => { node.classList.toggle('collapsed'); };
    node.querySelector('.add-set-btn').onclick = () => {
      const set = { n: ex.sets.length+1, target: '', weight: 0, reps: 0, notes: '' };
      ex.sets.push(set);
      tbody.appendChild(renderSetRow(ex, set));
  markDirtyAndScheduleSave();
    };
    container.appendChild(node);
  }
}
function renderSetRow(exercise, set){
  const tmpl = document.getElementById('setRowTemplate');
  const tr = tmpl.content.firstElementChild.cloneNode(true);
  tr.querySelector('.set-number').textContent = set.n;
  const weightInput = tr.querySelector('.weight-input');
  const repsInput = tr.querySelector('.reps-input');
  const notesInput = tr.querySelector('.notes-input');
  const targetCell = tr.querySelector('.target-cell');
  if(targetCell) targetCell.textContent = set.target || '';
  weightInput.value = set.weight || '';
  repsInput.value = set.reps || '';
  notesInput.value = set.notes || '';
  function update(){
    set.weight = parseFloat(weightInput.value)||0;
    set.reps = parseInt(repsInput.value)||0;
    set.notes = notesInput.value.trim();
  markDirtyAndScheduleSave();
  }
  // Contextual placeholders
  weightInput.placeholder = weightInput.placeholder || 'Weight';
  repsInput.placeholder = repsInput.placeholder || 'Reps';
  notesInput.placeholder = notesInput.placeholder || 'Notes';
  weightInput.oninput = update; repsInput.oninput = update; notesInput.oninput = update;
  tr.querySelector('.delete-set-btn').onclick = () => {
    exercise.sets = exercise.sets.filter(s => s !== set);
    // Re-number
    exercise.sets.forEach((s,i)=> s.n = i+1);
    tr.remove();
    renderExercises(); // simpler to re-render exercise block
  markDirtyAndScheduleSave();
  };
  return tr;
}

// Persist unsaved current session in sessionStorage (so accidental reload doesn't lose it)
function persistTemp(){
  if(!currentSession) return sessionStorage.removeItem('ft_current');
  sessionStorage.setItem('ft_current', JSON.stringify(currentSession));
}
function loadTemp(){
  try { const raw = sessionStorage.getItem('ft_current'); if(!raw) return; const obj = JSON.parse(raw); currentSession = obj; } catch {}
}

function markDirtyAndScheduleSave(){
  unsavedChanges = true;
  persistTemp();
  scheduleAutoSave();
}

function scheduleAutoSave(){
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(tryAutoSave, AUTOSAVE_DEBOUNCE_MS);
}

function hasMeaningfulData(){
  if(!currentSession) return false;
  return currentSession.exercises.some(ex => ex.sets.some(s => (s.weight && s.weight>0) || (s.reps && s.reps>0)));
}

function tryAutoSave(){
  if(!currentSession || !unsavedChanges) return; // nothing new
  if(!hasMeaningfulData()) return; // avoid empty sessions
  if(!state.sessions.includes(currentSession)) state.sessions.push(currentSession);
  saveData(state);
  unsavedChanges = false;
  lastAutoSavedAt = new Date();
  updateAutoSaveStatus();
}

function updateAutoSaveStatus(){
  const el = $('#autosaveStatus');
  if(!el) return;
  if(lastAutoSavedAt){
    const t = lastAutoSavedAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    el.textContent = `Auto-saved ${t}`;
  } else {
    el.textContent = unsavedChanges ? 'Editing…' : 'Not yet saved';
  }
}

// History Panel
function openHistory(){
  const panel = $('#historyPanel');
  const list = $('#historyList');
  list.innerHTML='';
  if(!state.sessions.length){ list.innerHTML='<p>No sessions yet.</p>'; }
  const ordered = [...state.sessions].sort((a,b)=> new Date(b.date)-new Date(a.date));
  for(const s of ordered){
    const div = document.createElement('div');
    div.className = 'history-item';
    const w = state.workouts[s.workoutKey];
    const totalSets = s.exercises.reduce((acc,e)=> acc+ e.sets.length,0);
    div.innerHTML = `<strong>${w? w.name : s.workoutKey}</strong> - ${formatDateTime(s.date)}<br>` +
      `${totalSets} sets`;
    const actions = document.createElement('div');
    actions.className = 'history-actions';
    const loadBtn = document.createElement('button'); loadBtn.textContent='Load'; loadBtn.onclick=()=> loadSession(s.id);
    const deleteBtn = document.createElement('button'); deleteBtn.textContent='Delete'; deleteBtn.onclick=()=> { if(confirm('Delete session?')) { state.sessions = state.sessions.filter(x=> x.id!==s.id); saveData(state); openHistory(); toast('Deleted'); } };
    actions.append(loadBtn, deleteBtn);
    div.appendChild(actions);
    list.appendChild(div);
  }
  panel.classList.remove('hidden');
}
function closeHistory(){ $('#historyPanel').classList.add('hidden'); }

// ----- Event Wiring -----
function wire(){
  $('#workoutSelect').onchange = e => { if(confirm('Start new session with selected workout? Unsaved current session lost.')) { newSession(e.target.value); persistTemp(); } else { renderWorkoutSelectValue(currentSession?.workoutKey || Object.keys(state.workouts)[0]); } };
  $('#newSessionBtn').onclick = () => { const key = $('#workoutSelect').value; newSession(key); persistTemp(); };
  $('#historyBtn').onclick = openHistory;
  $('#closeHistory').onclick = closeHistory;
  $('#exportBtn').onclick = exportData;
  $('#importInput').onchange = e => { importData(e.target.files[0]); e.target.value=''; };
  window.addEventListener('beforeunload', () => { persistTemp(); });
  // Periodic safeguard (e.g., if user keeps typing without pause)
  setInterval(()=> { if(unsavedChanges) tryAutoSave(); }, 10000);
}

// ----- Init -----
function init(){
  renderWorkoutOptions();
  loadTemp();
  if(currentSession){ renderWorkoutSelectValue(currentSession.workoutKey); renderSessionMeta(); renderExercises(); }
  else { const firstKey = Object.keys(state.workouts)[0]; renderWorkoutSelectValue(firstKey); }
  wire();
  registerSW();
}

function registerSW(){
  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('./sw.js').catch(err=> console.warn('SW reg failed', err));
  }
}

init();

// Expose for console debugging
window.FT_DEBUG = { state: () => state, current: () => currentSession };
