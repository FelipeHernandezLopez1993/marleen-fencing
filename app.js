/* ═══════════════════════════════════════════════════════════════
   SHARED ENGINE — identical for every athlete.
   Reads all athlete-specific data from config.js (loaded first).
   Never put personal data or plan content in this file.
   ═══════════════════════════════════════════════════════════════ */

// ═══════════════════════════════════════════
//  SUPABASE
// ═══════════════════════════════════════════
let sb;
try {
  const { createClient } = supabase;
  sb = createClient(SUPABASE.url, SUPABASE.key);
} catch (e) {
  console.error('Supabase init failed:', e);
}

// ═══════════════════════════════════════════
//  THEME + BRAND (from config)
// ═══════════════════════════════════════════
function applyTheme() {
  if (typeof THEME === 'object' && THEME.accent) {
    document.documentElement.style.setProperty('--accent', THEME.accent);
  }
}
function injectBrand() {
  const el = document.getElementById('app-brand');
  if (!el) return;
  el.innerHTML = `
    <svg viewBox="0 0 110 130" width="30" height="36" style="flex-shrink:0">
      <path d="M55 6 L102 6 L102 80 Q102 112 55 124 Q8 112 8 80 Z" fill="#14161b" stroke="var(--accent)" stroke-width="1.5"/>
      <line x1="55" y1="18" x2="55" y2="95" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
      <line x1="45" y1="28" x2="65" y2="48" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
      <line x1="55" y1="18" x2="80" y2="38" stroke="white" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
      <circle cx="55" cy="95" r="4" fill="var(--accent)"/>
    </svg>
    <div class="brand-text">
      <span class="brand-title">${BRAND.title}</span>
      <span class="brand-sub">${BRAND.sub}</span>
    </div>`;
}

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
const PANELS = ['today','plan','log','stats','body'];
let activePanel = 'today';
let modalSaveCallback = null;
let planWeekIdx = 0;
let planWeekInitialized = false;
let _logCtx = null;
let _hrvSelected = null;
let _extraExCount = 0;
let _recentLogs = [];
let chartInstances = {};

const POLAR_CFG = {
  clientId: (typeof window.POLAR_CLIENT_ID !== 'undefined') ? window.POLAR_CLIENT_ID : 'POLAR_CLIENT_ID',
  redirectUri: window.location.origin + window.location.pathname,
};

// ═══════════════════════════════════════════
//  UTILITIES
// ═══════════════════════════════════════════
function todayStr() { return new Date().toISOString().slice(0,10); }
function safeParseJSON(s) { try { return s ? JSON.parse(s) : null; } catch(e) { return null; } }

function sessionDate(wIdx, dIdx) {
  const start = new Date(PROGRAM_START+'T12:00:00');
  start.setDate(start.getDate() + wIdx*7 + dIdx);
  return start.toISOString().slice(0,10);
}
function isPastSession(wIdx, dIdx) { return sessionDate(wIdx,dIdx) < todayStr(); }
function isFutureSession(wIdx, dIdx) { return sessionDate(wIdx,dIdx) > todayStr(); }

function getTodayInfo() {
  const start = new Date(PROGRAM_START+'T00:00:00');
  const now = new Date(); now.setHours(0,0,0,0); start.setHours(0,0,0,0);
  const diff = Math.round((now - start) / 86400000);
  if (diff < 0 || diff >= TOTAL_WEEKS * 7) return null;
  return { weekIdx:Math.floor(diff/7), dayIdx:diff%7, weekNum:Math.floor(diff/7)+1, dayNum:(diff%7)+1 };
}

// Weekday (0=Mon … 6=Sun) the program begins on — used to align the plan grid
function programStartDow() {
  const d = new Date(PROGRAM_START+'T12:00:00');
  return (d.getDay()+6)%7;
}

function getDayType(wIdx, dIdx) {
  const am = resolveSession(wIdx, dIdx, 'am');
  const pm = resolveSession(wIdx, dIdx, 'pm');
  const hasAm = am && am.t !== 'rest';
  const hasPm = pm && pm.t !== 'rest';
  if (!hasAm && !hasPm) return 'rest';
  return (hasAm && hasPm) ? 'double' : 'single';
}

function typeColor(t) { return (SESSION_TYPES[t] && SESSION_TYPES[t].color) || 'var(--muted)'; }
function typeLabel(t) { return (SESSION_TYPES[t] && SESSION_TYPES[t].label) || t; }
function typeForm(t)  { return SESSION_TYPES[t] ? SESSION_TYPES[t].form : null; }

function getExercisesForSession(name) {
  for (const key of Object.keys(EXERCISES)) {
    if (name.startsWith(key)) return EXERCISES[key];
  }
  const n = name.toLowerCase();
  if (n.includes('total body') || n.includes('goblet')) return EXERCISES['Total Body Athletic'];
  if (n.includes('lower')) return EXERCISES['Power Lower A'];
  if (n.includes('upper')) return EXERCISES['Athletic Upper A'];
  return Object.values(EXERCISES)[0];
}

function getPhaseForSession() {
  if (!_logCtx) return 1;
  return PLAN[_logCtx.wIdx]?.ph || 1;
}

function getSetsCount(exIdx, phase) {
  if (exIdx === 0) return [3,4,4,3][phase-1] || 3; // main lift
  return [2,3,3,2][phase-1] || 3;                  // accessories
}

function getCondition(score) {
  if (score === null || score === undefined)
    return { level:'unknown', label:'Log Sleep Score', msg:'Enter your Polar Nightly Recharge score to see today\'s readiness.' };
  if (score >= 70) return { level:'peak',    label:'Peak Condition',   msg:'Recovery is excellent. You are primed to perform. Push hard today — your body is ready for it.' };
  if (score >= 50) return { level:'good',    label:'Good to Train',    msg:'Solid recovery. Train as planned. Listen to your body during the heavy sets.' };
  if (score >= 30) return { level:'caution', label:'Reduce Intensity', msg:'Below optimal. Drop the loads ~15%, keep the movement quality high. Technique over weight today.' };
  return             { level:'warning', label:'Prioritise Recovery', msg:'Recovery is low. Swap hard work for mobility, light fencing, or rest. Training hard now risks injury, not gains.' };
}

function updateHeader() {
  const info = getTodayInfo();
  const now = new Date();
  const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  document.getElementById('hdr-date').textContent = days[now.getDay()]+' '+now.getDate()+' '+months[now.getMonth()];
  document.getElementById('hdr-week').textContent = info ? 'Week '+info.weekNum+' · Day '+info.dayNum : 'Off Program';
}

// ═══════════════════════════════════════════
//  NAVIGATION + MODAL
// ═══════════════════════════════════════════
function showPanel(id) {
  PANELS.forEach(p => {
    document.getElementById('p-'+p).classList.toggle('active', p===id);
    document.getElementById('nav-'+p).classList.toggle('active', p===id);
  });
  activePanel = id;
  if (id==='today') renderToday();
  if (id==='plan')  renderPlan();
  if (id==='log')   renderLog();
  if (id==='stats') renderPerformance();
  if (id==='body')  renderBody();
}

function showToast(msg, duration=3000) {
  let t = document.getElementById('app-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'app-toast';
    t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:10px 18px;border-radius:20px;font-size:13px;z-index:9999;pointer-events:none;transition:opacity .3s;white-space:nowrap;max-width:90vw;text-align:center';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.style.opacity = '0', duration);
}

function openModal(title, bodyHTML, cb) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  modalSaveCallback = cb || null;
  document.getElementById('modal-bg').classList.add('open');
  document.getElementById('main-modal').classList.add('open');
  const footer = document.getElementById('modal-footer');
  if (footer) footer.style.display = cb ? '' : 'none';
}
function closeModal() {
  document.getElementById('modal-bg').classList.remove('open');
  document.getElementById('main-modal').classList.remove('open');
  modalSaveCallback = null;
  const footer = document.getElementById('modal-footer');
  if (footer) footer.style.display = '';
}
async function saveModal() { if (modalSaveCallback) await modalSaveCallback(); }

// ═══════════════════════════════════════════
//  QUOTE
// ═══════════════════════════════════════════
function getTodayQuote() {
  const dayNum = Math.floor((new Date() - new Date(PROGRAM_START)) / 86400000);
  return QUOTES[((dayNum % QUOTES.length) + QUOTES.length) % QUOTES.length];
}
function buildQuoteBar() {
  const q = getTodayQuote();
  return `<div style="background:var(--card);border-left:3px solid var(--accent);border-radius:0 8px 8px 0;padding:10px 14px;margin-bottom:12px">
    <div style="font-size:12px;color:var(--text);line-height:1.6;font-style:italic">"${q.text}"</div>
    <div style="font-size:10px;color:var(--accent);margin-top:6px;font-weight:500">— ${q.author}</div>
  </div>`;
}

// ═══════════════════════════════════════════
//  COMPETITION COUNTDOWN
// ═══════════════════════════════════════════
function getCompDates() {
  const stored = safeParseJSON(localStorage.getItem('comp_dates')) || {};
  const out = {};
  COMPETITIONS.forEach(c => out[c.key] = stored[c.key] || c.date);
  return out;
}
function openCompDates() {
  const dates = getCompDates();
  const fields = COMPETITIONS.map(c =>
    `<div class="form-field"><div class="form-label">${c.label} date</div><input class="form-input" id="cd-${c.key}" type="date" value="${dates[c.key]}"></div>`
  ).join('');
  openModal('Competition Dates', fields, () => {
    const stored = {};
    COMPETITIONS.forEach(c => { stored[c.key] = document.getElementById('cd-'+c.key)?.value || ''; });
    localStorage.setItem('comp_dates', JSON.stringify(stored));
    closeModal();
    renderToday();
  });
}
function buildCountdown() {
  const dates = getCompDates();
  const today = new Date(); today.setHours(0,0,0,0);
  const block = (c) => {
    const dateStr = dates[c.key];
    if (!dateStr) return `<div style="flex:1;text-align:center;padding:10px 6px;border-right:1px solid var(--border)">
      <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">${c.icon} ${c.label}</div>
      <div style="font-size:12px;color:var(--muted);font-style:italic">Set date →</div></div>`;
    const race = new Date(dateStr); race.setHours(0,0,0,0);
    const days = Math.ceil((race - today) / 86400000);
    if (days < 0) return `<div style="flex:1;text-align:center;padding:10px 6px;border-right:1px solid var(--border)">
      <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:4px">${c.icon} ${c.label}</div>
      <div style="font-size:14px;color:var(--green);font-weight:700">DONE 🏆</div></div>`;
    const weeks = Math.floor(days/7), rem = days%7;
    return `<div style="flex:1;text-align:center;padding:10px 6px;border-right:1px solid var(--border)">
      <div style="font-size:9px;letter-spacing:1px;color:var(--muted);margin-bottom:2px">${c.icon} ${c.label}</div>
      <div style="font-family:'Bebas Neue',sans-serif;font-size:32px;line-height:1;color:${c.color}">${days}</div>
      <div style="font-size:9px;color:var(--muted);margin-top:2px">days · ${weeks}w ${rem}d</div>
      <div style="font-size:9px;color:var(--muted)">${race.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</div>
    </div>`;
  };
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;overflow:hidden;margin-bottom:12px">
    <div style="display:flex;align-items:stretch">
      ${COMPETITIONS.map(block).join('')}
      <div style="display:flex;align-items:center;padding:0 10px;cursor:pointer" onclick="openCompDates()">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#74808f" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
      </div>
    </div></div>`;
}

function buildProgressCard(info) {
  const weekNum = info.weekNum;
  const pct = Math.round((weekNum - 1) / TOTAL_WEEKS * 100);
  const ph = PLAN[info.weekIdx]?.ph || 1;
  const phName = PHASES[ph]?.name || '';
  const phColor = PHASES[ph]?.color || 'var(--accent)';
  const weeksLeft = TOTAL_WEEKS - weekNum + 1;
  return `<div style="background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:12px">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">
      <div>
        <div style="font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1.5px;color:var(--text)">WEEK ${weekNum} <span style="color:${phColor};font-size:16px">· ${phName.toUpperCase()}</span></div>
        <div style="font-size:11px;color:var(--muted);margin-top:2px">Day ${info.dayNum} of 7 · ${weeksLeft} week${weeksLeft!==1?'s':''} left</div>
      </div>
      <div style="text-align:right">
        <div style="font-size:22px;font-family:'Bebas Neue',sans-serif;color:var(--accent)">${pct}%</div>
        <div style="font-size:10px;color:var(--muted)">program done</div>
      </div>
    </div>
    <div style="height:5px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
      <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--green),var(--accent));border-radius:4px;transition:width .4s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;margin-top:6px">
      <span style="font-size:9px;color:var(--muted)">W1 · Start</span>
      <span style="font-size:9px;color:var(--muted)">W${TOTAL_WEEKS} · Done</span>
    </div>
  </div>`;
}

// ═══════════════════════════════════════════
//  HABITS
// ═══════════════════════════════════════════
function getHabitsDone(suppDone, doneLogs, bodyLog) {
  const today = todayStr();
  const waterTarget = getDayType(getTodayInfo()?.weekIdx||0, getTodayInfo()?.dayIdx||0)==='rest' ? 8 : 10;
  const waterCount = parseInt(localStorage.getItem('water_'+today)||'0');
  const pausedSupps = safeParseJSON(localStorage.getItem('supps_paused')) || {};
  const activeSupps = SUPPS.filter(s=>!pausedSupps[s.key]);
  const allSupps = activeSupps.length > 0 && activeSupps.every(s=>suppDone[s.key]);
  const hasSleep = bodyLog?.sleep_score != null || localStorage.getItem('sleep_'+today) !== null;
  const hasTraining = doneLogs?.some(l => l.date === today) || false;
  const manual = safeParseJSON(localStorage.getItem('habits_manual_'+today)) || {};
  const out = {
    training: hasTraining,
    water:    waterCount >= waterTarget,
    supps:    allSupps,
    sleep:    hasSleep,
  };
  HABITS.forEach(h => { if (!h.auto) out[h.key] = !!manual[h.key]; });
  return out;
}

function toggleHabit(key) {
  const today = todayStr();
  const manual = safeParseJSON(localStorage.getItem('habits_manual_'+today)) || {};
  manual[key] = !manual[key];
  localStorage.setItem('habits_manual_'+today, JSON.stringify(manual));
  updateHabitsUI();
}

function getHabitStreak(key) {
  let streak = 0;
  const today = new Date(todayStr()+'T12:00:00');
  for (let i = 0; i < 90; i++) {
    const d = new Date(today); d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0,10);
    const manual = safeParseJSON(localStorage.getItem('habits_manual_'+ds)) || {};
    let wasDone = manual[key];
    if (key==='water') wasDone = wasDone || parseInt(localStorage.getItem('water_'+ds)||'0') >= 8;
    if (key==='sleep') wasDone = wasDone || !!localStorage.getItem('sleep_'+ds);
    if (!wasDone && i > 0) break;
    if (wasDone) streak++;
  }
  return streak;
}

function buildHabitsSection(suppDone, doneLogs, bodyLog) {
  const done = getHabitsDone(suppDone, doneLogs, bodyLog);
  const rings = HABITS.map(h => {
    const isDone = done[h.key];
    const streak = getHabitStreak(h.key);
    const clickAttr = h.auto ? '' : `onclick="toggleHabit('${h.key}')"`;
    const cursor = h.auto ? 'default' : 'pointer';
    return `<div class="habit-ring-wrap" style="cursor:${cursor}" ${clickAttr}>
      <div class="habit-ring" style="width:44px;height:44px;border-radius:50%;border:2.5px solid ${isDone?'var(--green)':'var(--border)'};background:${isDone?'rgba(76,175,130,0.15)':'transparent'};display:flex;align-items:center;justify-content:center;font-size:18px;transition:all .2s">${h.icon}</div>
      <div class="habit-lbl" style="font-size:8px;color:${isDone?'var(--green)':'var(--muted)'};text-align:center;letter-spacing:.3px;max-width:44px;line-height:1.2">${h.label}</div>
      <div class="habit-streak" style="font-size:9px;color:var(--accent);font-weight:500;min-height:13px">${streak>0?streak+'d':''}</div>
    </div>`;
  }).join('');
  const completedCount = HABITS.filter(h=>done[h.key]).length;
  const manualHabits = HABITS.filter(h=>!h.auto);
  return `
  <div class="sec-label" style="margin-top:16px">Daily Habits <span class="habit-count" style="color:var(--muted);font-weight:400;font-size:10px">${completedCount}/${HABITS.length} today</span></div>
  <div class="card" id="habits-card">
    <div style="display:grid;grid-template-columns:repeat(${Math.min(HABITS.length,7)},1fr);gap:8px;padding:4px 0 8px">
      ${rings}
    </div>
    <div style="border-top:1px solid var(--border);padding-top:10px;margin-top:4px">
      ${manualHabits.map(h=>`
        <div class="habit-check-row" style="display:flex;align-items:flex-start;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);cursor:pointer" onclick="toggleHabit('${h.key}')">
          <div class="habit-box" style="width:18px;height:18px;border:1.5px solid ${done[h.key]?'var(--green)':'var(--border)'};border-radius:4px;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:${done[h.key]?'var(--green)':'transparent'};margin-top:1px">
            ${done[h.key]?'<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>':''}
          </div>
          <div style="flex:1">
            <div style="font-size:12px;color:var(--text)">${h.icon} ${h.label}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:1px">${h.desc}</div>
            <div style="font-size:10px;color:var(--muted);margin-top:4px;line-height:1.5;opacity:.8">${h.why}</div>
          </div>
          <div class="habit-row-streak" style="font-size:10px;color:var(--accent);font-weight:500;flex-shrink:0">${getHabitStreak(h.key)>0?getHabitStreak(h.key)+'d 🔥':''}</div>
        </div>`).join('')}
    </div>
    ${buildHabitHeatmap()}
  </div>`;
}

function buildHabitHeatmap() {
  const today = todayStr();
  const days = [];
  for (let i = 20; i >= 0; i--) {
    const d = new Date(today + 'T12:00:00'); d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }
  const dayLabels = days.map((ds, i) => {
    if (i === 20) return '<span style="color:var(--accent)">•</span>';
    if (i % 7 === 0) return `<span>${ds.slice(8)}</span>`;
    return '<span></span>';
  }).join('');
  const rows = HABITS.map(h => {
    const cells = days.map(ds => {
      const manual = safeParseJSON(localStorage.getItem('habits_manual_' + ds)) || {};
      let isDone = !!manual[h.key];
      if (!isDone && h.key === 'water') isDone = parseInt(localStorage.getItem('water_' + ds) || '0') >= 8;
      else if (!isDone && h.key === 'sleep') isDone = !!localStorage.getItem('sleep_' + ds);
      const isToday = ds === today;
      const bg = isDone ? 'var(--green)' : isToday ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)';
      const border = isToday ? '1px solid var(--accent)' : '1px solid transparent';
      return `<div style="width:100%;aspect-ratio:1;border-radius:3px;background:${bg};border:${border}"></div>`;
    }).join('');
    return `<div style="display:contents"><div style="font-size:16px;line-height:1;display:flex;align-items:center">${h.icon}</div>${cells}</div>`;
  }).join('');
  return `<div style="border-top:1px solid var(--border);padding-top:12px;margin-top:4px">
    <div style="font-size:10px;color:var(--muted);margin-bottom:8px;letter-spacing:.5px">21-DAY HEATMAP</div>
    <div style="display:grid;grid-template-columns:20px repeat(21,1fr);gap:3px;align-items:center"><div></div>${dayLabels}${rows}</div>
    <div style="display:flex;align-items:center;gap:6px;margin-top:8px;justify-content:flex-end">
      <div style="width:8px;height:8px;border-radius:2px;background:rgba(255,255,255,0.04)"></div><span style="font-size:9px;color:var(--muted)">missed</span>
      <div style="width:8px;height:8px;border-radius:2px;background:var(--green)"></div><span style="font-size:9px;color:var(--muted)">done</span>
    </div></div>`;
}

function updateHabitsUI() {
  const card = document.getElementById('habits-card');
  if (!card) return;
  const suppDone = safeParseJSON(localStorage.getItem('supps_'+todayStr())) || {};
  const done = getHabitsDone(suppDone, null, null);
  const ringDivs = card.querySelectorAll('.habit-ring-wrap');
  HABITS.forEach((h, i) => {
    const wrap = ringDivs[i]; if (!wrap) return;
    const isDone = done[h.key]; const streak = getHabitStreak(h.key);
    const ring = wrap.querySelector('.habit-ring'); const lbl = wrap.querySelector('.habit-lbl'); const streakEl = wrap.querySelector('.habit-streak');
    if (ring) { ring.style.borderColor = isDone?'var(--green)':'var(--border)'; ring.style.background = isDone?'rgba(76,175,130,0.15)':'transparent'; }
    if (lbl) lbl.style.color = isDone?'var(--green)':'var(--muted)';
    if (streakEl) streakEl.textContent = streak>0?streak+'d':'';
  });
  const rows = card.querySelectorAll('.habit-check-row');
  HABITS.filter(h=>!h.auto).forEach((h, i) => {
    const row = rows[i]; if (!row) return;
    const isDone = done[h.key]; const streak = getHabitStreak(h.key);
    const box = row.querySelector('.habit-box'); const streakEl = row.querySelector('.habit-row-streak');
    if (box) { box.style.borderColor = isDone?'var(--green)':'var(--border)'; box.style.background = isDone?'var(--green)':'transparent'; box.innerHTML = isDone?'<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="2,6 5,9 10,3"/></svg>':''; }
    if (streakEl) streakEl.textContent = streak>0?streak+'d 🔥':'';
  });
  const countEl = card.previousElementSibling?.querySelector?.('.habit-count');
  if (countEl) countEl.textContent = `${HABITS.filter(h=>done[h.key]).length}/${HABITS.length} today`;
}

// ═══════════════════════════════════════════
//  TODAY TAB
// ═══════════════════════════════════════════
async function renderToday() {
  const info = getTodayInfo();
  const el = document.getElementById('today-content');
  if (!info) { el.innerHTML='<div class="empty-state"><div class="empty-state-title">Program Complete 🏆</div><p>22 weeks of work. You are not the same athlete who started.</p></div>'; return; }
  el.innerHTML = '<div class="loading">Loading…</div>';

  const week = PLAN[info.weekIdx];
  const day  = week.days[info.dayIdx];
  const dayType = getDayType(info.weekIdx, info.dayIdx);

  const [{ data: doneLogs }, { data: bodyRows }] = await Promise.all([
    sb.from('session_logs').select('day_idx,slot,date').eq('week_idx', info.weekIdx),
    sb.from('body_logs').select('*').eq('date', todayStr()).limit(1),
  ]);
  const isDone = (dIdx, slot) => {
    const [,logD,logS] = resolveLogContext(info.weekIdx, dIdx, slot);
    return doneLogs?.some(l => l.day_idx===logD && l.slot===logS) || false;
  };
  const bodyLog = bodyRows?.[0] || null;

  const rawAm = resolveSession(info.weekIdx, info.dayIdx, 'am');
  const rawPm = resolveSession(info.weekIdx, info.dayIdx, 'pm');
  const resolvedAm = rawAm !== null ? rawAm : day.am;
  const resolvedPm = rawPm !== null ? rawPm : day.pm;
  const hasAmToday = resolvedAm && resolvedAm.t !== 'rest' && rawAm !== null;
  const hasPmToday = resolvedPm && resolvedPm.t !== 'rest' && rawPm !== null;

  const sleepScore = bodyLog?.sleep_score ?? (localStorage.getItem('sleep_'+todayStr()) !== null ? parseInt(localStorage.getItem('sleep_'+todayStr())) : null);
  const cond = getCondition(sleepScore);
  const ph = week.ph;
  const phName = PHASES[ph]?.name || '';
  const phColor = PHASES[ph]?.color || 'var(--accent)';

  const isDouble = hasAmToday && hasPmToday;
  let sessionHTML = buildSessionCard(day.am, info.weekIdx, info.dayIdx, 'am', isDone(info.dayIdx,'am'), isDouble);
  if (hasPmToday || day.pm) sessionHTML += buildSessionCard(day.pm || resolvedPm, info.weekIdx, info.dayIdx, 'pm', isDone(info.dayIdx,'pm'), true);

  const waterTarget = dayType==='rest' ? 8 : 10;
  const waterCount  = parseInt(localStorage.getItem('water_'+todayStr())||'0');
  const suppDone    = safeParseJSON(localStorage.getItem('supps_'+todayStr())) || {};

  const ironDismissed = parseInt(localStorage.getItem('iron_alert_dismissed')||'0');
  const ironAlert = ironDismissed < 3 ? `
    <div class="alert yellow" style="margin-bottom:12px">
      <div class="alert-title">⚡ Energy & Fatigue</div>
      If you still feel consistently tired, ask your doctor for a blood panel: iron, ferritin, B12, and D3. Low iron is common in female athletes and causes fatigue, breathlessness, and low focus. It is 100% treatable — but only if you know about it.
      <div style="margin-top:6px"><button onclick="localStorage.setItem('iron_alert_dismissed',${ironDismissed+1});this.closest('.alert').style.display='none'" style="background:none;border:none;color:var(--yellow);font-size:11px;cursor:pointer;text-decoration:underline;padding:0">Dismiss</button></div>
    </div>` : '';

  el.innerHTML = `
    ${buildQuoteBar()}
    ${buildCountdown()}
    <div class="condition-card ${cond.level}">
      <div class="condition-status">${cond.label}</div>
      <div class="condition-msg">${cond.msg}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <span class="sleep-label">Sleep score</span>
        <span style="font-size:20px;font-weight:700;color:var(--text)">${sleepScore!==null?sleepScore:'—'}</span>
        ${sleepScore===null?`<span style="font-size:10px;color:var(--muted)">· Log in Body tab</span>`:''}
      </div>
    </div>
    ${ironAlert}
    <div class="sec-label">Today's Sessions</div>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap">
      <span class="chip"><span class="chip-dot" style="background:${phColor}"></span>Phase ${ph} · ${phName}</span>
      <span class="chip"><span class="chip-dot" style="background:var(--accent)"></span>${week.lbl} · Day ${info.dayNum}</span>
    </div>
    ${sessionHTML}
    <button class="add-btn" onclick="openAddCustom()">+ Add unplanned session (extra fencing, walk, yoga, other…)</button>
    ${buildHabitsSection(suppDone, doneLogs, bodyLog)}
    <div class="sec-label">Hydration</div>
    <div class="water-card" data-target="${waterTarget}">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div class="water-total">${waterCount*250} ml</div>
        <div style="font-size:11px;color:var(--muted)">Target ${waterTarget*250} ml</div>
      </div>
      <div class="water-glasses">
        ${Array.from({length:waterTarget},(_,i)=>`<div class="glass ${i<waterCount?'filled':''}" onclick="logWater(${i<waterCount?i:i+1})"></div>`).join('')}
      </div>
      <div class="pbar-wrap"><div class="pbar-fill water-pbar" style="width:${Math.min(100,waterCount/waterTarget*100)}%;background:var(--blue)"></div></div>
    </div>
    <div class="sec-label">Supplements</div>
    <div class="card">
      <div style="font-size:10px;color:var(--muted);background:var(--card2);border-radius:6px;padding:7px 10px;margin-bottom:10px;line-height:1.5">
        💡 <strong style="color:var(--text)">Tip:</strong> Hold any supplement for 1 second to pause it if you don't currently have it. It stays out of your tracking until you reactivate it.
      </div>
      ${SUPPS.map(s=>{
        const paused = getSuppPaused(s.key);
        return `<div class="supp-item ${suppDone[s.key]&&!paused?'done':''}" data-supp-key="${s.key}"
          onclick="${paused?'':'toggleSupp(\''+s.key+'\')'}"
          oncontextmenu="event.preventDefault();toggleSuppPause('${s.key}')"
          ontouchstart="startSuppHold('${s.key}')" ontouchend="clearSuppHold()" ontouchmove="clearSuppHold()"
          style="${paused?'opacity:.45;':''}">
          <div class="supp-check" style="${paused?'border-color:var(--muted)':''}">
            ${paused?`<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><line x1="4" y1="3" x2="4" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>`:`<svg class="supp-check-mark" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3"/></svg>`}
          </div>
          <div style="flex:1;min-width:0">
            <div style="display:flex;justify-content:space-between;align-items:center">
              <span class="supp-name">${s.name}${paused?` <span style="font-size:9px;color:var(--muted);background:var(--card2);padding:1px 5px;border-radius:4px;margin-left:4px">paused</span>`:''}</span>
              <span class="supp-time">${s.time}</span>
            </div>
            <div style="font-size:10px;color:var(--muted);line-height:1.4;margin-top:2px">${s.why}</div>
          </div>
        </div>`;
      }).join('')}
    </div>
    ${buildMacroSection(dayType)}
    <div style="height:16px"></div>
  `;
}

// ═══════════════════════════════════════════
//  MACROS
// ═══════════════════════════════════════════
function getMacroLog(date) { return safeParseJSON(localStorage.getItem('macros_'+(date||todayStr()))); }
function saveMacroLog(data) {
  localStorage.setItem('macros_'+todayStr(), JSON.stringify(data));
  sb.from('body_logs').upsert({date:todayStr(), macros:data},{onConflict:'date'}).then(()=>{});
}

function getMacroFeedback(actual, target, dayType) {
  const msgs = [];
  const kcalPct = actual.kcal / target.kcal;
  const proteinDiff = actual.protein - target.protein;
  const isTraining = dayType !== 'rest';
  if (kcalPct < 0.75) msgs.push({color:'var(--red)', icon:'⚠️', text:`Significantly under-fuelled (${actual.kcal} vs ${target.kcal} kcal). You're in a build phase — under-eating stalls muscle gain and recovery. Eat more, especially carbs.`});
  else if (kcalPct < 0.9) msgs.push({color:'var(--yellow)', icon:'⚡', text:`A little under target. To gain muscle you need to be at or slightly above. Add a snack tonight.`});
  else if (kcalPct <= 1.15) msgs.push({color:'var(--green)', icon:'✅', text:`Calories on point for building. Keep this consistent — growth happens in the surplus.`});
  else msgs.push({color:'var(--yellow)', icon:'📈', text:`Above target (+${actual.kcal-target.kcal} kcal). Fine on a heavy day; keep it tighter on rest days.`});
  if (proteinDiff < -25) msgs.push({color:'var(--red)', icon:'💪', text:`Protein too low (${actual.protein}g vs ${target.protein}g). Below the build threshold — hit a protein source every meal + a shake.`});
  else if (proteinDiff < -10) msgs.push({color:'var(--yellow)', icon:'💪', text:`Protein slightly low. Add a shake or extra portion tonight.`});
  else msgs.push({color:'var(--green)', icon:'💪', text:`Protein nailed — muscle is fuelled to grow.`});
  if (isTraining && actual.carbs < target.carbs * 0.7) msgs.push({color:'var(--red)', icon:'🏃', text:`Carbs low for a training day (${actual.carbs}g vs ${target.carbs}g). Carbs power your fencing and your lifts — top them up.`});
  return msgs;
}

function buildMacroSection(dayType) {
  const target = NUTRITION[dayType] || NUTRITION.single;
  const actual = getMacroLog(todayStr());
  const dayLabel = dayType==='double'?'Double Session':dayType==='single'?'Single Session':'Rest Day';
  const macroBar = (label, val, tgt, color) => {
    const pct = Math.min(100, Math.round((val/tgt)*100)); const over = val > tgt;
    return `<div style="margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;font-size:11px;margin-bottom:4px">
        <span style="color:var(--muted)">${label}</span>
        <span style="color:${over?'var(--orange)':'var(--text)'}">${val}<span style="color:var(--muted)"> / ${tgt}${label==='Kcal'?'':' g'}</span></span>
      </div>
      <div style="height:5px;background:var(--card2);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${over?'var(--orange)':color};border-radius:3px;transition:width .3s"></div></div>
    </div>`;
  };
  const feedback = actual ? getMacroFeedback(actual, target, dayType) : [];
  return `
  <div class="sec-label" style="margin-top:16px">Nutrition <span style="color:var(--muted);font-weight:400;font-size:10px">${dayLabel} targets</span></div>
  <div class="card" id="macro-card">
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;margin-bottom:14px">
      ${[{label:'Kcal',val:target.kcal,unit:'',color:'var(--orange)'},{label:'Protein',val:target.protein,unit:'g',color:'var(--blue)'},{label:'Carbs',val:target.carbs,unit:'g',color:'var(--yellow)'},{label:'Fat',val:target.fat,unit:'g',color:'var(--purple)'}].map(m=>`<div style="background:var(--card2);border-radius:8px;padding:8px 6px;text-align:center"><div style="font-size:15px;font-weight:500;color:${m.color}">${m.val}</div><div style="font-size:9px;color:var(--muted);margin-top:1px">${m.label}${m.unit?'·'+m.unit:''}</div></div>`).join('')}
    </div>
    ${actual ? `
      <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--muted);margin-bottom:10px;display:flex;justify-content:space-between"><span>Logged today</span><div style="display:flex;gap:10px"><button onclick="openMacroModal('add')" style="background:none;border:none;color:var(--green);font-size:11px;cursor:pointer;padding:0">＋ Add meal</button><button onclick="openMacroModal('edit')" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;padding:0">Edit</button></div></div>
        ${macroBar('Kcal',actual.kcal,target.kcal,'var(--orange)')}${macroBar('Protein',actual.protein,target.protein,'var(--blue)')}${macroBar('Carbs',actual.carbs,target.carbs,'var(--yellow)')}${macroBar('Fat',actual.fat,target.fat,'var(--purple)')}
      </div>
      ${feedback.map(f=>`<div style="background:var(--card2);border-left:3px solid ${f.color};border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:11px;color:var(--text);line-height:1.5">${f.icon} ${f.text}</div>`).join('')}
    ` : `
      <button onclick="openMacroModal('add')" style="width:100%;padding:10px;background:none;border:1px dashed var(--border);border-radius:8px;color:var(--accent);cursor:pointer;font-size:12px;letter-spacing:.5px">＋ Log today's nutrition</button>
      <div style="font-size:10px;color:var(--muted);text-align:center;margin-top:8px;line-height:1.5">${typeof NUTRITION_NOTE!=='undefined'?NUTRITION_NOTE:''}</div>
    `}
  </div>`;
}

function openMacroModal(mode) {
  const info = getTodayInfo();
  const dayType = getDayType(info?.weekIdx||0, info?.dayIdx||0);
  const target = NUTRITION[dayType] || NUTRITION.single;
  const existing = getMacroLog(todayStr()) || {kcal:0,protein:0,carbs:0,fat:0};
  const isAdd = mode === 'add' || !existing.kcal;
  const dayLabel = dayType==='double'?'Double Session':dayType==='single'?'Single Session':'Rest Day';
  const remaining = {kcal:Math.max(0,target.kcal-existing.kcal),protein:Math.max(0,target.protein-existing.protein),carbs:Math.max(0,target.carbs-existing.carbs),fat:Math.max(0,target.fat-existing.fat)};
  openModal(isAdd ? '＋ Add meal' : 'Edit totals', `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
      <div style="font-size:11px;color:var(--muted)">${dayLabel} · target ${target.kcal} kcal</div>
      <button onclick="openMacroModal('${isAdd?'edit':'add'}')" style="background:none;border:none;color:var(--accent);font-size:11px;cursor:pointer;padding:0">Switch to ${isAdd?'edit totals':'add meal'}</button>
    </div>
    ${existing.kcal && isAdd ? `<div style="background:var(--card2);border-radius:8px;padding:8px 10px;margin-bottom:12px;font-size:11px;color:var(--muted)">Current: <strong style="color:var(--text)">${existing.kcal} kcal · ${existing.protein}P · ${existing.carbs}C · ${existing.fat}F</strong><br><span style="color:var(--green)">Remaining: ${remaining.kcal} kcal · ${remaining.protein}P · ${remaining.carbs}C · ${remaining.fat}F</span></div>` : ''}
    ${[{id:'f-kcal',label:'Calories (kcal)'},{id:'f-protein',label:'Protein (g)'},{id:'f-carbs',label:'Carbs (g)'},{id:'f-fat',label:'Fat (g)'}].map(f=>`<div class="form-field"><div class="form-label">${f.label}</div><input class="form-input" id="${f.id}" type="number" placeholder="0"></div>`).join('')}
    <input type="hidden" id="f-macro-mode" value="${isAdd?'add':'edit'}">
  `, saveMacroModal);
}

function saveMacroModal() {
  const mode = document.getElementById('f-macro-mode')?.value || 'add';
  const existing = getMacroLog(todayStr()) || {kcal:0,protein:0,carbs:0,fat:0};
  const input = {kcal:parseInt(document.getElementById('f-kcal')?.value)||0,protein:parseInt(document.getElementById('f-protein')?.value)||0,carbs:parseInt(document.getElementById('f-carbs')?.value)||0,fat:parseInt(document.getElementById('f-fat')?.value)||0};
  const data = mode==='add' ? {kcal:existing.kcal+input.kcal,protein:existing.protein+input.protein,carbs:existing.carbs+input.carbs,fat:existing.fat+input.fat} : input;
  saveMacroLog(data);
  closeModal();
  renderToday();
}

// ═══════════════════════════════════════════
//  SWAP / MOVE SYSTEM
// ═══════════════════════════════════════════
function getSwaps() { return safeParseJSON(localStorage.getItem('session_swaps')) || {}; }
function saveSwaps(s) { localStorage.setItem('session_swaps', JSON.stringify(s)); }
function swapKey(wIdx,dIdx,slot) { return `${wIdx}-${dIdx}-${slot}`; }

function resolveSession(wIdx, dIdx, slot) {
  const swaps = getSwaps();
  const key = swapKey(wIdx,dIdx,slot);
  for (const [from, to] of Object.entries(swaps)) {
    if (to === key) { const [fw,fd,fs] = from.split('-'); const orig = PLAN[+fw]?.days[+fd]; return orig ? (fs==='pm'?orig.pm:orig.am) : null; }
  }
  if (swaps[key]) return null;
  return slot==='pm' ? PLAN[wIdx]?.days[dIdx]?.pm : PLAN[wIdx]?.days[dIdx]?.am;
}
function isMovedOut(wIdx, dIdx, slot) { return !!getSwaps()[swapKey(wIdx,dIdx,slot)]; }
function resolveLogContext(wIdx, dIdx, slot) {
  const swaps = getSwaps(); const key = swapKey(wIdx, dIdx, slot);
  for (const [from, to] of Object.entries(swaps)) { if (to === key) { const p = from.split('-'); return [+p[0], +p[1], p[2]]; } }
  return [wIdx, dIdx, slot];
}

function openMoveModal(wIdx, dIdx, slot) {
  const s = resolveSession(wIdx, dIdx, slot); if (!s) return;
  const today = getTodayInfo();
  const todayAbs = today ? today.weekIdx*7 + today.dayIdx : 0;
  const dow = programStartDow();
  const dayNames = Array.from({length:7},(_,i)=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(dow+i)%7]);
  const slotColors = { 'am':'var(--yellow)', 'pm':'var(--accent)' };
  let rows = '';
  PLAN.forEach((week, wi) => {
    week.days.forEach((day, di) => {
      const abs = wi*7+di;
      if (abs < todayAbs) return;
      if (wi===wIdx && di===dIdx && slot==='am') return;
      const dateStr = sessionDate(wi, di);
      ['am','pm'].forEach(targetSlot => {
        if (wi===wIdx && di===dIdx && targetSlot===slot) return;
        const existing = resolveSession(wi, di, targetSlot);
        const existingName = existing && existing.t !== 'rest' ? existing.n : null;
        const slotBadge = `<span style="font-size:8px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:${slotColors[targetSlot]};background:rgba(255,255,255,.06);border-radius:3px;padding:1px 5px">${targetSlot.toUpperCase()}</span>`;
        const targetDesc = existingName ? `<span style="font-size:11px;color:var(--muted)">↔ swap with ${existingName}</span>` : `<span style="font-size:11px;color:var(--green)">Empty slot</span>`;
        rows += `<div onclick="confirmSwap(${wIdx},${dIdx},'${slot}',${wi},${di},'${targetSlot}')" style="padding:9px 10px;border-bottom:1px solid var(--border);cursor:pointer;display:flex;justify-content:space-between;align-items:center;gap:8px">
          <div style="flex:1"><div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="font-size:12px;color:var(--text);font-weight:600">${week.lbl} ${dayNames[di]}</span>${slotBadge}<span style="font-size:10px;color:var(--muted)">${dateStr}</span></div>${targetDesc}</div>
          <span style="color:var(--accent);font-size:16px;flex-shrink:0">→</span></div>`;
      });
    });
  });
  openModal(`Move · ${s.n}`, `<div style="font-size:11px;color:var(--muted);margin-bottom:10px;line-height:1.5">Choose any future day and slot. Sessions swap if the target is occupied.</div><div style="background:var(--card2);border:1px solid var(--border);border-radius:10px;overflow:hidden;max-height:360px;overflow-y:auto">${rows}</div>`, null);
}

function confirmSwap(fromW, fromD, fromSlot, toW, toD, toSlot) {
  const tSlot = toSlot || fromSlot;
  const swaps = getSwaps();
  const fromK = swapKey(fromW, fromD, fromSlot);
  const toK = swapKey(toW, toD, tSlot);
  for (const k of Object.keys(swaps)) { if (swaps[k]===toK || k===toK) delete swaps[k]; }
  delete swaps[fromK];
  let targetOrigFrom = null;
  for (const [k,v] of Object.entries(swaps)) { if(v===toK){targetOrigFrom=k; break;} }
  if (targetOrigFrom) delete swaps[targetOrigFrom];
  const targetNative = PLAN[toW]?.days[toD]?.[tSlot];
  if (targetNative && targetNative.t !== 'rest') swaps[toK] = fromK;
  swaps[fromK] = toK;
  saveSwaps(swaps);
  closeModal();
  if (activePanel==='today') renderToday();
  if (activePanel==='plan')  renderPlan();
}

function undoSwap(wIdx, dIdx, slot) {
  const swaps = getSwaps(); const key = swapKey(wIdx,dIdx,slot);
  for (const [k,v] of Object.entries(swaps)) { if (v===key) { delete swaps[k]; delete swaps[key]; saveSwaps(swaps); break; } }
  if (swaps[key]) { delete swaps[key]; saveSwaps(swaps); }
  if (activePanel==='today') renderToday();
  if (activePanel==='plan')  renderPlan();
}

function buildSessionCard(s, wIdx, dIdx, slot, done, isDouble) {
  const resolved = resolveSession(wIdx, dIdx, slot);
  if (resolved === null) {
    return `<div class="sblock rest" style="opacity:.5;border-style:dashed">
      <div class="sblock-tag" style="color:var(--muted)">Moved</div>
      <div class="sblock-name" style="color:var(--muted)">${s?.n||''}</div>
      <div class="sblock-detail" style="font-size:10px">This session was moved to another day</div>
      <div class="sblock-actions"><button class="btn-done" style="background:var(--card2)" onclick="undoSwap(${wIdx},${dIdx},'${slot}')">Undo Move</button></div>
    </div>`;
  }
  if (resolved.t==='rest') return `<div class="sblock rest"><div class="sblock-tag">Rest</div><div class="sblock-name">${resolved.n}</div><div class="sblock-detail">${resolved.d}</div></div>`;
  const [logW, logD, logS] = resolveLogContext(wIdx, dIdx, slot);
  const badge = isDouble&&slot==='am' ? '<span class="double-badge">AM</span> ' : isDouble&&slot==='pm' ? '<span class="pm-badge">PM</span> ' : '';
  const isFuture = isFutureSession(wIdx, dIdx);
  const isToday = sessionDate(wIdx, dIdx) === todayStr();
  const canMove = (isFuture || isToday) && !done;
  const canLog = typeForm(resolved.t) !== null;
  return `<div class="sblock ${resolved.t} ${done?'done':''}">
    ${badge}<div class="sblock-tag">${typeLabel(resolved.t)}</div>
    <div class="sblock-name">${resolved.n}</div>
    <div class="sblock-detail">${resolved.d}</div>
    ${resolved.dur?`<div class="sblock-dur">${resolved.dur}</div>`:''}
    <div class="sblock-actions">
      ${canLog?`<button class="btn-log" onclick="openLogModal(${logW},${logD},'${logS}','${sessionDate(wIdx,dIdx)}')">${done?'✓ Edit Log':'Save Session'}</button>`:''}
      ${canMove?`<button class="btn-done" style="background:var(--card2);color:var(--accent)" onclick="openMoveModal(${wIdx},${dIdx},'${slot}')">↔ Move</button>`:''}
    </div>
  </div>`;
}

async function saveSleepScore(val) {
  localStorage.setItem('sleep_'+todayStr(), val);
  const { data: existing } = await sb.from('body_logs').select('id').eq('date',todayStr()).limit(1);
  if (existing?.[0]) await sb.from('body_logs').update({sleep_score:parseInt(val)}).eq('id',existing[0].id);
  else await sb.from('body_logs').insert({date:todayStr(),sleep_score:parseInt(val)});
  renderToday();
}

async function markDone(wIdx, dIdx, slot) {
  const week = PLAN[wIdx]; const s = slot==='pm' ? week.days[dIdx].pm : week.days[dIdx].am;
  if (!s) return;
  const sDate = sessionDate(wIdx, dIdx);
  if (isPastSession(wIdx, dIdx)) { if (!confirm(`This session was on ${sDate}. Mark done in historical log?`)) return; }
  const { error } = await sb.from('session_logs').insert({date:sDate,week_idx:wIdx,day_idx:dIdx,slot,type:s.t,name:s.n,data:{completed:true}});
  if (error) { showToast('Error: '+(error.message||'check Supabase')); return; }
  showToast('Marked done ✓');
  if (activePanel==='today') renderToday();
  if (activePanel==='plan')  renderPlan();
}

function logWater(count) {
  localStorage.setItem('water_'+todayStr(), count);
  const card = document.querySelector('.water-card'); if (!card) return;
  const target = parseInt(card.dataset.target || 10);
  const totalEl = card.querySelector('.water-total'); if (totalEl) totalEl.textContent = (count*250)+' ml';
  card.querySelectorAll('.glass').forEach((g,i) => { g.classList.toggle('filled', i<count); g.onclick = () => logWater(i<count?i:i+1); });
  const pbar = card.querySelector('.water-pbar'); if (pbar) pbar.style.width = Math.min(100,count/target*100)+'%';
  sb.from('body_logs').upsert({date:todayStr(), water_glasses:count},{onConflict:'date'}).then(()=>{});
  updateHabitsUI();
}
function getSuppPaused(key) { const p = safeParseJSON(localStorage.getItem('supps_paused'))||{}; return !!p[key]; }
function toggleSuppPause(key) {
  const paused = safeParseJSON(localStorage.getItem('supps_paused'))||{};
  paused[key] = !paused[key];
  localStorage.setItem('supps_paused', JSON.stringify(paused));
  const el = document.querySelector(`[data-supp-key="${key}"]`); if (!el) return;
  const isPaused = !!paused[key];
  el.style.opacity = isPaused ? '0.45' : '';
  const check = el.querySelector('.supp-check');
  if (check) { check.style.borderColor = isPaused?'var(--muted)':''; check.innerHTML = isPaused?`<svg viewBox="0 0 12 12" width="10" height="10" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linecap="round"><line x1="4" y1="3" x2="4" y2="9"/><line x1="8" y1="3" x2="8" y2="9"/></svg>`:`<svg class="supp-check-mark" viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3"/></svg>`; }
  const nameEl = el.querySelector('.supp-name');
  if (nameEl) { const supp = SUPPS.find(s=>s.key===key); nameEl.innerHTML = supp ? supp.name + (isPaused?` <span style="font-size:9px;color:var(--muted);background:var(--card2);padding:1px 5px;border-radius:4px;margin-left:4px">paused</span>`:'') : nameEl.textContent; }
  el.onclick = isPaused ? null : ()=>toggleSupp(key);
}
let _suppHoldTimer = null;
function startSuppHold(key) { _suppHoldTimer = setTimeout(()=>{ toggleSuppPause(key); }, 600); }
function clearSuppHold() { clearTimeout(_suppHoldTimer); }
function toggleSupp(key) {
  const d = safeParseJSON(localStorage.getItem('supps_'+todayStr()))||{};
  d[key] = !d[key];
  localStorage.setItem('supps_'+todayStr(), JSON.stringify(d));
  const el = document.querySelector(`[data-supp-key="${key}"]`); if (el) el.classList.toggle('done', !!d[key]);
  updateHabitsUI();
  sb.from('body_logs').upsert({date:todayStr(), supps_done:d},{onConflict:'date'}).then(()=>{});
}
function openAddCustom() { openModal('Add Unplanned Session', buildCustomForm(), saveCustomSession); }

// ═══════════════════════════════════════════
//  PLAN TAB
// ═══════════════════════════════════════════
async function renderPlan() {
  const info = getTodayInfo();
  if (info && !planWeekInitialized) { planWeekIdx = info.weekIdx; planWeekInitialized = true; }
  const el = document.getElementById('plan-content');
  if (!el.innerHTML || el.innerHTML.includes('Loading')) el.innerHTML = '<div class="loading">Loading…</div>';

  const [{ data: doneLogs }, { data: allLogs }] = await Promise.all([
    sb.from('session_logs').select('week_idx,day_idx,slot,data,type').eq('week_idx', planWeekIdx),
    sb.from('session_logs').select('week_idx,slot,data,type'),
  ]);
  const isDone = (dIdx, slot) => { const [, logD, logS] = resolveLogContext(planWeekIdx, dIdx, slot); return doneLogs?.some(l => l.day_idx===logD && l.slot===logS) || false; };

  const week = PLAN[planWeekIdx];
  const isCurrentWeek = info && info.weekIdx===planWeekIdx;
  const dow = programStartDow();
  const dayNames = Array.from({length:7},(_,i)=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(dow+i)%7]);
  const isPlanned = l => l.slot && l.slot !== 'custom';

  const plannedWeekLogs = (doneLogs||[]).filter(isPlanned);
  const extraWeekLogs   = (doneLogs||[]).filter(l => !isPlanned(l));
  const sessionsDone = plannedWeekLogs.length;
  const sessionsPlanned = week.sessions;
  const weekAdherencePct = sessionsPlanned > 0 ? Math.min(100, Math.round(sessionsDone / sessionsPlanned * 100)) : 0;
  const isPastOrCurrent = !info || planWeekIdx <= info.weekIdx;

  const weeksComplete = info ? info.weekIdx : 0;
  let scheduledUntilToday = 0;
  if (info) {
    PLAN.forEach((w, wi) => {
      if (wi < info.weekIdx) scheduledUntilToday += w.sessions;
      else if (wi === info.weekIdx) w.days.forEach((day, di) => { if (di <= info.dayIdx) { if (day.am && day.am.t !== 'rest') scheduledUntilToday++; if (day.pm && day.pm.t !== 'rest') scheduledUntilToday++; } });
    });
  }
  const totalDonePlanned = (allLogs||[]).filter(isPlanned).length;
  const totalDoneExtra   = (allLogs||[]).filter(l => !isPlanned(l)).length;
  const overallPct = Math.round(weeksComplete / TOTAL_WEEKS * 100);

  let navHTML=''; let lastPh=0;
  PLAN.forEach((w,i)=>{ if(w.ph!==lastPh){navHTML+=`<span class="phase-sep" style="color:${PHASES[w.ph]?.color}">P${w.ph}</span>`;lastPh=w.ph;} const isPast = info && i < info.weekIdx; navHTML+=`<button class="wbtn ${i===planWeekIdx?'active':''}" onclick="selectPlanWeek(${i})"><span style="${isPast?'color:var(--green)':''}"> ${isPast?'✓':''}</span>${w.lbl}</button>`; });

  // Day grid — columns aligned to the program's start weekday (no off-by-one)
  const gridHTML = dayNames.map((d,i)=>{
    const day=week.days[i]; const isToday=isCurrentWeek&&info&&info.dayIdx===i;
    const isPastDay = info && (planWeekIdx < info.weekIdx || (planWeekIdx === info.weekIdx && i < info.dayIdx));
    const rawAm = resolveSession(planWeekIdx,i,'am'); const rawPm = resolveSession(planWeekIdx,i,'pm');
    const movedOutAm = rawAm === null && isMovedOut(planWeekIdx,i,'am');
    const movedOutPm = rawPm === null && isMovedOut(planWeekIdx,i,'pm');
    const resolvedAm = rawAm ?? day.am; const resolvedPm = rawPm ?? day.pm;
    const [logWAm,logDAm,logSAm] = resolveLogContext(planWeekIdx,i,'am');
    const [logWPm,logDPm,logSPm] = resolveLogContext(planWeekIdx,i,'pm');
    const amBlock=buildSmallBlock(resolvedAm,planWeekIdx,i,'am',isDone(i,'am'),!!day.pm,movedOutAm,isPastDay,logWAm,logDAm,logSAm);
    const pmBlock=(resolvedPm||movedOutPm)?buildSmallBlock(resolvedPm||{t:'rest',n:'Moved'},planWeekIdx,i,'pm',isDone(i,'pm'),true,movedOutPm,isPastDay,logWPm,logDPm,logSPm):'';
    return `<div class="dcol ${isToday?'today-col':''}"><div class="dhead">${d}</div>${amBlock}${pmBlock}</div>`;
  }).join('');

  const weekTrackerHTML = isPastOrCurrent ? `
    <div class="card" style="margin-bottom:12px;padding:12px 14px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
        <div style="font-size:11px;letter-spacing:.8px;color:var(--muted);font-weight:600">WEEK TRACKER</div>
        <div style="font-size:13px;font-weight:700;color:${weekAdherencePct>=80?'var(--green)':weekAdherencePct>=50?'var(--yellow)':'var(--orange)'}">${weekAdherencePct}% plan done</div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px">
        <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--text)">${sessionsDone}<span style="font-size:12px;color:var(--muted)">/${sessionsPlanned}</span></div><div style="font-size:10px;color:var(--muted)">Plan sessions</div>${extraWeekLogs.length>0?`<div style="font-size:10px;color:var(--accent);margin-top:2px">+${extraWeekLogs.length} extra</div>`:''}</div>
        <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--accent)">${week.fencing}</div><div style="font-size:10px;color:var(--muted)">fencing days</div></div>
        <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:${PHASES[week.ph]?.color}">${(PHASES[week.ph]?.name||'').split(' ')[0]}</div><div style="font-size:10px;color:var(--muted)">Phase ${week.ph}</div></div>
      </div>
      <div style="display:flex;gap:4px">${Array.from({length:sessionsPlanned},(_,i)=>`<div style="flex:1;height:4px;border-radius:2px;background:${i<sessionsDone?'var(--green)':'rgba(255,255,255,0.08)'}"></div>`).join('')}</div>
    </div>` : '';

  el.innerHTML = `
    <div style="position:relative;background:linear-gradient(135deg,#0c0d10 0%,#151a22 100%);border:1px solid rgba(61,155,233,.25);border-radius:12px;padding:18px 16px;margin-bottom:12px;overflow:hidden;display:flex;align-items:center;gap:14px">
      <svg viewBox="0 0 110 130" width="50" height="60" style="flex-shrink:0;opacity:0.95">
        <path d="M55 6 L102 6 L102 80 Q102 112 55 124 Q8 112 8 80 Z" fill="#14161b" stroke="var(--accent)" stroke-width="1.5"/>
        <line x1="55" y1="18" x2="55" y2="95" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
        <line x1="45" y1="28" x2="65" y2="48" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round"/>
        <circle cx="55" cy="95" r="4" fill="var(--accent)"/>
        <text x="55" y="115" fill="white" font-family="Arial,sans-serif" font-size="8" font-weight="900" letter-spacing="1" text-anchor="middle">${BRAND.sub}</text>
      </svg>
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;letter-spacing:2px;color:var(--accent);font-weight:700;margin-bottom:2px">${BRAND.programLabel}</div>
        <div style="font-size:17px;font-weight:900;color:white;letter-spacing:-.3px;line-height:1.1">${info ? `Week ${info.weekNum} · ${PHASES[week?.ph||1]?.name}` : 'Loading…'}</div>
        <div style="font-size:11px;color:#6e7a8a;margin-top:3px">${totalDonePlanned} of ${scheduledUntilToday} sessions done${totalDoneExtra>0?` · +${totalDoneExtra} extra`:''}</div>
        <div style="height:4px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden;margin-top:8px"><div style="height:100%;width:${Math.min(100,Math.round(totalDonePlanned/Math.max(1,scheduledUntilToday)*100))}%;background:linear-gradient(90deg,var(--accent),#7EC8F0);border-radius:3px;transition:width .4s"></div></div>
      </div>
    </div>
    <div class="week-nav">${navHTML}</div>
    ${weekTrackerHTML}
    <div class="wstats">
      ${WEEK_STATS.map(ws=>`<div class="wstat"><div class="wstat-val">${week[ws.key]??'—'}</div><div class="wstat-lbl">${ws.label}</div></div>`).join('')}
      <div class="wstat"><div class="wstat-val" style="color:${PHASES[week.ph]?.color};font-size:11px;padding-top:5px">${PHASES[week.ph]?.name}</div><div class="wstat-lbl">Phase ${week.ph}</div></div>
    </div>
    <div class="legend">
      ${Object.keys(SESSION_TYPES).filter(t=>t!=='rest'&&t!=='custom').map(t=>`<div class="legend-item"><div class="legend-dot" style="background:${SESSION_TYPES[t].color}"></div>${SESSION_TYPES[t].label}</div>`).join('')}
    </div>
    <div class="day-grid">${gridHTML}</div>
    <button class="add-btn" onclick="openAddCustom()">+ Add unplanned session</button>
    <div style="height:16px"></div>
  `;
}

function buildSmallBlock(s,wIdx,dIdx,slot,done,isDouble,movedOut,isPastDay,logW,logD,logS) {
  const slotLabel=isDouble&&slot==='am'?' AM':isDouble&&slot==='pm'?' PM':'';
  if (movedOut) return `<div class="sblock-sm rest" style="opacity:.45;border-style:dashed"><div class="sm-tag" style="color:var(--muted)">moved${slotLabel}</div><div class="sm-name" style="color:var(--muted)">—</div></div>`;
  const lw=logW??wIdx, ld=logD??dIdx, ls=logS??slot;
  const canMove = s.t!=='rest' && !done && !isPastDay;
  const moveBtn = canMove ? `<button onclick="event.stopPropagation();openMoveModal(${wIdx},${dIdx},'${slot}')" style="position:absolute;top:4px;right:4px;background:rgba(61,155,233,0.12);border:none;border-radius:4px;width:18px;height:18px;display:flex;align-items:center;justify-content:center;cursor:pointer;padding:0"><svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="var(--accent)" stroke-width="1.8" stroke-linecap="round"><line x1="6" y1="1" x2="6" y2="11"/><line x1="1" y1="6" x2="11" y2="6"/></svg></button>` : '';
  const canLog = s.t!=='rest' && typeForm(s.t)!==null && !isPastDay;
  const clickAction = canLog ? `openLogModal(${lw},${ld},'${ls}','${sessionDate(wIdx,dIdx)}')` : '';
  const pastStyle = isPastDay && !done ? 'opacity:0.5;' : '';
  return `<div class="sblock-sm ${s.t} ${done?'done-sm':''}" style="position:relative;${pastStyle}" ${clickAction?`onclick="${clickAction}"`:''}>
    <div class="sm-tag" style="color:${typeColor(s.t)}">${typeLabel(s.t)}${slotLabel}</div>
    <div class="sm-name">${s.n}</div>
    ${s.dur?`<div class="sm-dur">${s.dur}</div>`:''}
    ${moveBtn}
  </div>`;
}
function selectPlanWeek(idx) { planWeekIdx=idx; planWeekInitialized=true; renderPlan(); }

// ═══════════════════════════════════════════
//  LOG MODAL + FORMS
// ═══════════════════════════════════════════
async function openLogModal(wIdx, dIdx, slot, displayDate=null) {
  const s = slot==='pm' ? PLAN[wIdx]?.days[dIdx]?.pm : PLAN[wIdx]?.days[dIdx]?.am;
  if (!s || s.t==='rest') { showToast('Session not found'); return; }
  const sDate = displayDate || sessionDate(wIdx, dIdx);
  const past = sDate < todayStr();
  _logCtx = {wIdx, dIdx, slot, session:s, date:sDate, isPast:past};
  _extraExCount = 0;

  if (s.t === 'strength') {
    const {data: latestLogs} = await sb.from('session_logs').select('data,created_at').eq('type','strength').order('created_at',{ascending:false}).limit(30);
    if (latestLogs) { const seen={}; for (const log of latestLogs) for (const ex of log.data?.exercises||[]) { if (!seen[ex.name] && ex.sets?.length) { const maxKg=Math.max(...ex.sets.map(s=>s.kg||0)); if (maxKg>0) { seen[ex.name]=true; USER.lifts[ex.name]={w:maxKg,r:ex.sets.at(-1)?.reps||5}; } } } }
  }

  const forms = { strength:buildStrengthForm, fencing:buildFencingForm, run:buildRunForm, yoga:buildYogaForm };
  const builder = forms[s.t] || buildFencingForm;
  const warning = past ? `<div class="alert yellow" style="margin-bottom:14px"><div class="alert-title">Past Session</div>Logging for <strong>${sDate}</strong> — updates your historical record.</div>` : '';
  openModal('Log · '+s.n, warning + builder(s), saveLogSession);
}

function buildStrengthForm(s) {
  const phase = getPhaseForSession();
  const exList = getExercisesForSession(s.n);
  return exList.map((ex,ei)=>{
    const sets = getSetsCount(ei, phase);
    const lift = USER.lifts[ex.name];
    const lastKg = lift ? lift.w : null;
    const rows = Array.from({length:sets},(_,si)=>`
      <div class="set-row" id="set-${ei}-${si}">
        <span class="set-num">${si+1}</span>
        <input class="set-input" id="reps-${ei}-${si}" type="number" value="${ex.reps}" placeholder="${ex.reps}">
        <input class="set-input" id="kg-${ei}-${si}" type="number" placeholder="${lastKg!==null?lastKg:'kg'}">
        <span style="width:18px"></span>
      </div>`).join('');
    return `<div class="exercise-block" id="ex-block-${ei}">
      <div class="exercise-name-row"><span class="exercise-name">${ex.name}</span><span style="display:flex;align-items:center;gap:10px"><span class="exercise-hint">${sets}×${ex.reps}${lastKg!==null?' · Last: '+lastKg+'kg':''}</span><button onclick="removeExercise(${ei})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;padding:0">✕</button></span></div>
      <div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-style:italic">${ex.note||''}</div>
      <div class="sets-header"><span class="sets-hdr-lbl">Set</span><span class="sets-hdr-lbl">Reps</span><span class="sets-hdr-lbl">kg</span><span></span></div>
      <div id="sets-${ei}">${rows}</div>
      <button class="btn-add-set" onclick="addSet(${ei})">+ add set</button>
      <div class="divider"></div>
    </div>`;
  }).join('') + `
  <div id="extra-exercises"></div>
  <button class="btn-add-set" style="width:100%;margin-bottom:12px;font-size:12px;padding:10px 0;border-radius:8px;border:1px dashed var(--border);background:none;color:var(--accent);cursor:pointer;letter-spacing:.5px" onclick="showExercisePicker()">＋ Add exercise</button>
  <div id="ex-picker" style="display:none;background:var(--card2);border:1px solid var(--border);border-radius:10px;padding:10px;margin-bottom:12px;max-height:200px;overflow-y:auto"></div>
  <div class="form-row"><div class="form-field"><div class="form-label">Duration</div><input class="form-input" id="f-dur" type="text" placeholder="60m"></div><div class="form-field"><div class="form-label">Avg HR</div><input class="form-input" id="f-hr" type="number" placeholder="128"></div></div>
  <div class="form-field"><div class="form-label">Notes</div><input class="form-input" id="f-notes" type="text" placeholder="Energy, PRs, how did it feel?"></div>`;
}

function buildFencingForm(s) {
  const slider = (id,lbl,val) => `<div class="form-field"><div class="form-label">${lbl}</div><div style="display:flex;align-items:center;gap:8px"><input class="sleep-range" id="${id}" type="range" min="1" max="10" value="${val}" oninput="document.getElementById('${id}-v').textContent=this.value" style="flex:1"><span id="${id}-v" style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--accent);min-width:20px">${val}</span></div></div>`;
  return `${slider('f-energy','Energy (1–10)',7)}${slider('f-focus','Focus (1–10)',7)}${slider('f-technique','Technique feel (1–10)',7)}
  <div class="form-field"><div class="form-label">Notes</div><input class="form-input" id="f-notes" type="text" placeholder="What worked, what to fix…"></div>`;
}

function buildRunForm(s) { return `
  <div class="form-field"><div class="form-label">Distance (km)</div><input class="form-input" id="f-dist" type="number" step="0.1" placeholder="4.0"></div>
  <div class="form-row"><div class="form-field"><div class="form-label">Duration (mm:ss)</div><input class="form-input" id="f-dur" type="text" placeholder="25:00"></div><div class="form-field"><div class="form-label">Avg HR</div><input class="form-input" id="f-hr" type="number" placeholder="138"></div></div>
  <div class="form-field"><div class="form-label">Hip feel after</div><select class="form-select" id="f-hip-ok"><option value="fine">Fine — no issues</option><option value="tight">A little tight</option><option value="sore">Sore — monitor it</option></select></div>
  <div class="form-field"><div class="form-label">Notes</div><input class="form-input" id="f-notes" type="text" placeholder="How did it feel?"></div>`; }

function buildYogaForm(s) {
  return `<div class="form-field"><div class="form-label">Duration (min)</div><input class="form-input" id="f-duration" type="number" placeholder="60"></div>
  <div class="form-field"><div class="form-label">Hip mobility feel (1–10)</div><div style="display:flex;align-items:center;gap:8px"><input class="sleep-range" id="f-hip" type="range" min="1" max="10" value="6" oninput="document.getElementById('f-hip-v').textContent=this.value" style="flex:1"><span id="f-hip-v" style="font-family:'Bebas Neue',sans-serif;font-size:20px;color:var(--accent);min-width:20px">6</span></div></div>
  <div class="form-field"><div class="form-label">Notes</div><input class="form-input" id="f-notes" type="text" placeholder="Tight areas, what felt good…"></div>`;
}

function buildCustomForm() { return `
  <div class="form-field"><div class="form-label">Type</div><select class="form-select" id="f-custom-type"><option value="fencing">Extra Fencing</option><option value="run">Run / Walk</option><option value="yoga">Yoga / Mobility</option><option value="strength">Extra Gym</option><option value="custom">Other</option></select></div>
  <div class="form-field"><div class="form-label">Session name</div><input class="form-input" id="f-custom-name" type="text" placeholder="e.g. Extra club night, Swim…"></div>
  <div class="form-row"><div class="form-field"><div class="form-label">Duration (min)</div><input class="form-input" id="f-dur" type="number" placeholder="60"></div><div class="form-field"><div class="form-label">Avg HR</div><input class="form-input" id="f-hr" type="number" placeholder=""></div></div>
  <div class="form-field"><div class="form-label">Notes</div><input class="form-input" id="f-notes" type="text" placeholder="How did it go?"></div>`; }

function showExercisePicker() {
  const picker = document.getElementById('ex-picker'); if (!picker) return;
  if (picker.style.display !== 'none') { picker.style.display = 'none'; return; }
  const allEx = []; const seen = new Set();
  Object.values(EXERCISES).forEach(arr => arr.forEach(ex => { if (!seen.has(ex.name)) { seen.add(ex.name); allEx.push(ex); } }));
  picker.innerHTML = allEx.map(ex => `<div onclick="addExerciseBlock('${ex.name.replace(/'/g,"\\'")}',${ex.reps},'${(ex.note||'').replace(/'/g,"\\'")}');document.getElementById('ex-picker').style.display='none'" style="padding:8px 6px;border-bottom:1px solid var(--border);cursor:pointer;font-size:13px;color:var(--text)">${ex.name} <span style="color:var(--muted);font-size:11px">· ${ex.reps} reps</span></div>`).join('');
  picker.style.display = 'block';
}
function addExerciseBlock(exName, targetReps, exNote) {
  const container = document.getElementById('extra-exercises'); if (!container) return;
  const ei = 1000 + _extraExCount++;
  const lift = USER.lifts[exName]; const lastKg = lift ? lift.w : null; const sets = 3;
  const rows = Array.from({length:sets},(_,si)=>`<div class="set-row"><span class="set-num">${si+1}</span><input class="set-input" id="reps-${ei}-${si}" type="number" value="${targetReps}" placeholder="${targetReps}"><input class="set-input" id="kg-${ei}-${si}" type="number" placeholder="${lastKg!==null?lastKg:'kg'}"><span style="width:18px"></span></div>`).join('');
  container.insertAdjacentHTML('beforeend', `<div class="exercise-block" id="ex-block-${ei}"><div class="exercise-name-row"><span class="exercise-name">${exName}</span><span style="display:flex;align-items:center;gap:10px"><span class="exercise-hint">${sets}×${targetReps}${lastKg!==null?' · Last: '+lastKg+'kg':''}</span><button onclick="removeExercise(${ei})" style="background:none;border:none;color:var(--muted);cursor:pointer;font-size:16px;line-height:1;padding:0">✕</button></span></div><div style="font-size:10px;color:var(--muted);margin-bottom:6px;font-style:italic">${exNote}</div><div class="sets-header"><span class="sets-hdr-lbl">Set</span><span class="sets-hdr-lbl">Reps</span><span class="sets-hdr-lbl">kg</span><span></span></div><div id="sets-${ei}">${rows}</div><button class="btn-add-set" onclick="addSet(${ei})">+ add set</button><div class="divider"></div></div>`);
}
function addSet(ei) { const c=document.getElementById('sets-'+ei); const si=c.children.length; c.insertAdjacentHTML('beforeend',`<div class="set-row"><span class="set-num">${si+1}</span><input class="set-input" id="reps-${ei}-${si}" type="number" placeholder="—"><input class="set-input" id="kg-${ei}-${si}" type="number" placeholder="—"><span style="width:18px"></span></div>`); }
function removeExercise(ei) { const block = document.getElementById('ex-block-'+ei); if (block) block.style.display = 'none'; }

async function saveLogSession() {
  if (!_logCtx) { closeModal(); return; }
  const {wIdx,dIdx,slot,session:s} = _logCtx;
  let data = { notes: document.getElementById('f-notes')?.value||'' };

  if (s.t==='strength') {
    const exList = getExercisesForSession(s.n);
    const collect = (ei, exName) => {
      const block = document.getElementById('ex-block-'+ei);
      if (block && block.style.display === 'none') return null;
      const c = document.getElementById('sets-'+ei); const count = c ? c.children.length : 0;
      const sets = [];
      for(let si=0;si<count;si++){const r=document.getElementById('reps-'+ei+'-'+si)?.value; const k=document.getElementById('kg-'+ei+'-'+si)?.value; if(r||k)sets.push({reps:parseInt(r)||0,kg:parseFloat(k)||0});}
      return sets.length ? {name:exName, sets} : null;
    };
    data.exercises = [
      ...exList.map((ex,ei) => collect(ei, ex.name)),
      ...Array.from({length:_extraExCount},(_,i) => { const ei=1000+i; const block=document.getElementById('ex-block-'+ei); if (!block||block.style.display==='none') return null; const nameEl=block.querySelector('.exercise-name'); return collect(ei, nameEl?.textContent||'Unknown'); })
    ].filter(Boolean);
    data.duration = document.getElementById('f-dur')?.value||'';
    data.hr = parseInt(document.getElementById('f-hr')?.value)||0;
  } else if (s.t==='fencing') {
    data.energy = parseInt(document.getElementById('f-energy')?.value)||null;
    data.focus = parseInt(document.getElementById('f-focus')?.value)||null;
    data.technique = parseInt(document.getElementById('f-technique')?.value)||null;
  } else if (s.t==='run') {
    data.distance = parseFloat(document.getElementById('f-dist')?.value)||0;
    data.duration = document.getElementById('f-dur')?.value||'';
    data.hr = parseInt(document.getElementById('f-hr')?.value)||0;
    data.hip_ok = document.getElementById('f-hip-ok')?.value||'fine';
  } else if (s.t==='yoga') {
    data.duration = parseInt(document.getElementById('f-duration')?.value)||null;
    data.hip_feel = parseInt(document.getElementById('f-hip')?.value)||null;
  }

  await sb.from('session_logs').delete().eq('week_idx',wIdx).eq('day_idx',dIdx).eq('slot',slot);
  const { error } = await sb.from('session_logs').insert({date:_logCtx.date||todayStr(),week_idx:wIdx,day_idx:dIdx,slot,type:s.t,name:s.n,data});
  if (error) { showToast('Save failed: '+(error.message||'check connection')); console.error('saveLogSession:', error); return; }
  closeModal();
  showToast('✓ Session saved');
  if (activePanel==='today') renderToday();
  if (activePanel==='plan')  renderPlan();
  if (activePanel==='log')   renderLog();
}

async function saveCustomSession() {
  const type = document.getElementById('f-custom-type')?.value||'custom';
  const name = document.getElementById('f-custom-name')?.value||typeLabel(type);
  const info = getTodayInfo();
  const { error } = await sb.from('session_logs').insert({
    date:todayStr(), week_idx:info?.weekIdx??0, day_idx:info?.dayIdx??0, slot:'custom',
    type, name, data:{duration:parseInt(document.getElementById('f-dur')?.value)||0, hr:parseInt(document.getElementById('f-hr')?.value)||0, notes:document.getElementById('f-notes')?.value||''}
  });
  if (error) { showToast('Error: '+(error.message||'check Supabase')); return; }
  showToast('Session logged ✓');
  closeModal();
  if (activePanel==='today') renderToday();
  if (activePanel==='log')   renderLog();
}

// ═══════════════════════════════════════════
//  LOG TAB
// ═══════════════════════════════════════════
async function renderLog() {
  const el = document.getElementById('log-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  const { data: logs } = await sb.from('session_logs').select('*').order('created_at',{ascending:false}).limit(250);
  if (!logs?.length) { el.innerHTML='<div class="empty-state"><div class="empty-state-title">No Sessions Logged Yet</div><p>Log sessions from the Today or Plan tab.</p></div>'; return; }
  _recentLogs = logs;

  const byWeek = {};
  logs.forEach((log, idx) => { const wk = log.week_idx ?? -1; (byWeek[wk] = byWeek[wk]||[]).push({log, idx}); });
  let html = '';
  Object.keys(byWeek).sort((a,b)=>b-a).forEach(wk => {
    const wIdx = parseInt(wk); const week = PLAN[wIdx]; const entries = byWeek[wk];
    if (week) {
      html += `<div style="margin:14px 0 8px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div style="font-family:'Bebas Neue',sans-serif;font-size:16px;letter-spacing:1.5px;color:var(--text)">${week.lbl}</div>
          <span style="font-size:10px;color:${PHASES[week.ph]?.color};background:rgba(0,0,0,.3);border:1px solid ${PHASES[week.ph]?.color};border-radius:20px;padding:2px 8px">${PHASES[week.ph]?.name}</span>
        </div>
        <div style="display:flex;gap:12px;font-size:10px;color:var(--muted)"><span>📋 ${week.sessions} planned</span><span style="color:${entries.length>=week.sessions?'var(--green)':'var(--accent)'}">✓ ${entries.length} logged</span></div>
        <div style="height:1px;background:var(--border);margin-top:8px"></div></div>`;
    } else { html += `<div class="sec-label" style="margin-top:14px">Other Sessions</div>`; }
    entries.forEach(({log, idx}) => {
      const color = typeColor(log.type); const sep = (s)=>s?' · ':'';
      let metrics = '';
      if (log.type === 'strength') { if (log.data?.exercises?.length) metrics += `<em>${log.data.exercises.length} ex</em>`; if (log.data?.duration) metrics += `${sep(metrics)}${log.data.duration}`; if (log.data?.hr>0) metrics += `${sep(metrics)}<em>${log.data.hr}bpm</em>`; }
      else if (log.type === 'fencing') { if (log.data?.focus) metrics += `Focus <em>${log.data.focus}</em>`; if (log.data?.technique) metrics += `${sep(metrics)}Tech <em>${log.data.technique}</em>`; }
      else { if (log.data?.distance) metrics += `<em>${log.data.distance}km</em>`; if (log.data?.duration && typeof log.data.duration==='string') metrics += `${sep(metrics)}${log.data.duration}`; if (log.data?.hr) metrics += `${sep(metrics)}<em>${log.data.hr}bpm</em>`; }
      if (log.data?.completed && !metrics) metrics = 'Marked done';
      const dow = programStartDow();
      const dayNames = Array.from({length:7},(_,i)=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][(dow+i)%7]);
      const dayLabel = log.day_idx != null && log.day_idx>=0 ? dayNames[log.day_idx] : '';
      html += `<div class="log-recent-item" style="margin-bottom:6px">
        <div class="log-ri-top" onclick="openLogDetail(${idx})" style="cursor:pointer"><span class="log-ri-name" style="color:${color}">${log.name}</span><span style="display:flex;align-items:center;gap:6px"><span class="log-ri-date">${dayLabel} ${log.date?.slice(5)||''}</span><span style="font-size:10px;color:var(--muted)">›</span></span></div>
        <div style="display:flex;justify-content:space-between;align-items:center"><div class="log-ri-metrics" onclick="openLogDetail(${idx})" style="cursor:pointer;flex:1">${metrics||'Logged'}</div><div style="display:flex;gap:4px;flex-shrink:0;margin-left:8px">${log.week_idx!=null&&log.day_idx!=null&&log.slot&&log.slot!=='custom'?`<button onclick="openLogModal(${log.week_idx},${log.day_idx},'${log.slot}','${log.date}')" style="padding:3px 8px;background:rgba(61,155,233,.1);border:1px solid rgba(61,155,233,.2);border-radius:6px;color:var(--accent);font-size:10px;cursor:pointer;font-family:'DM Sans',sans-serif">Edit</button>`:''}<button onclick="deleteLog('${log.id}')" style="padding:3px 8px;background:rgba(232,84,84,.1);border:1px solid rgba(232,84,84,.2);border-radius:6px;color:var(--red);font-size:10px;cursor:pointer;font-family:'DM Sans',sans-serif">Delete</button></div></div>
      </div>`;
    });
  });
  el.innerHTML = html + '<div style="height:16px"></div>';
}

async function deleteLog(id) {
  if (!confirm('Delete this session log?')) return;
  await sb.from('session_logs').delete().eq('id', id);
  showToast('Session deleted');
  renderLog();
  if (activePanel === 'today') renderToday();
}

function openLogDetail(idx) {
  const log = _recentLogs[idx]; if (!log) return;
  const color = typeColor(log.type);
  let body = `<div style="margin-bottom:14px"><div style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.8px">${log.date} · ${typeLabel(log.type)}</div>${log.data?.notes?`<div style="font-size:12px;color:var(--muted);margin-top:6px;font-style:italic">"${log.data.notes}"</div>`:''}</div>`;
  if (log.data?.exercises?.length) {
    body += log.data.exercises.map(ex=>`<div style="margin-bottom:14px"><div style="font-size:12px;font-weight:500;color:#fff;margin-bottom:6px">${ex.name}</div>${ex.sets?.length?`<div style="display:grid;grid-template-columns:28px 1fr 1fr;gap:4px;margin-bottom:2px"><span style="font-size:9px;color:var(--muted);text-align:center">SET</span><span style="font-size:9px;color:var(--muted);text-align:center">REPS</span><span style="font-size:9px;color:var(--muted);text-align:center">KG</span></div>${ex.sets.map((set,i)=>`<div style="display:grid;grid-template-columns:28px 1fr 1fr;gap:4px;padding:4px 0;border-bottom:1px solid var(--border)"><span style="font-size:11px;color:var(--muted);text-align:center">${i+1}</span><span style="font-size:12px;color:var(--text);text-align:center">${set.reps||'—'}</span><span style="font-size:12px;color:${color};text-align:center;font-weight:500">${set.kg?set.kg+'kg':'—'}</span></div>`).join('')}`:'<div style="font-size:11px;color:var(--muted)">No sets recorded</div>'}</div>`).join('<div class="divider"></div>');
  } else if (log.type==='fencing') {
    if(log.data?.energy) body+=`<div class="card-row"><span class="lbl">Energy</span><span class="val" style="color:${color}">${log.data.energy}/10</span></div>`;
    if(log.data?.focus) body+=`<div class="card-row"><span class="lbl">Focus</span><span class="val" style="color:${color}">${log.data.focus}/10</span></div>`;
    if(log.data?.technique) body+=`<div class="card-row"><span class="lbl">Technique</span><span class="val" style="color:${color}">${log.data.technique}/10</span></div>`;
  } else {
    if(log.data?.distance) body+=`<div class="card-row"><span class="lbl">Distance</span><span class="val" style="color:${color}">${log.data.distance} km</span></div>`;
    if(log.data?.duration) body+=`<div class="card-row"><span class="lbl">Duration</span><span class="val">${log.data.duration}</span></div>`;
    if(log.data?.hr) body+=`<div class="card-row"><span class="lbl">Avg HR</span><span class="val">${log.data.hr} bpm</span></div>`;
    if(log.data?.hip_feel) body+=`<div class="card-row"><span class="lbl">Hip feel</span><span class="val">${log.data.hip_feel}/10</span></div>`;
    if(log.data?.hip_ok) body+=`<div class="card-row"><span class="lbl">Hip after</span><span class="val">${log.data.hip_ok}</span></div>`;
    if(log.data?.completed) body+=`<div style="font-size:12px;color:var(--green);margin-top:8px">✓ Marked as done</div>`;
  }
  openModal(log.name, `<div class="card">${body}</div>`, null);
}

// ═══════════════════════════════════════════
//  PERFORMANCE TAB
// ═══════════════════════════════════════════
function getISOWeek(d) { const date=new Date(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())); const dayNum=date.getUTCDay()||7; date.setUTCDate(date.getUTCDate()+4-dayNum); const yearStart=new Date(Date.UTC(date.getUTCFullYear(),0,1)); return Math.ceil((((date-yearStart)/86400000)+1)/7); }
function getPlanInfoForDate(dateStr) {
  const start = new Date(PROGRAM_START+'T00:00:00'); const d = new Date(dateStr+'T00:00:00');
  const diff = Math.floor((d - start)/86400000);
  if (diff < 0 || diff >= TOTAL_WEEKS*7) return null;
  const wIdx = Math.floor(diff/7), dIdx = diff%7;
  return { wIdx, dIdx, dayType:getDayType(wIdx,dIdx) };
}
function mkLine(id,base,labels,data,color,invertY,targetVal) {
  const ctx=document.getElementById(id)?.getContext('2d'); if(!ctx)return;
  const empty=!data.length;
  const bgMap={'var(--green)':'rgba(76,175,130,0.08)','var(--orange)':'rgba(244,84,29,0.08)','var(--yellow)':'rgba(232,184,75,0.08)','var(--accent)':'rgba(61,155,233,0.08)','var(--purple)':'rgba(155,127,232,0.08)'};
  const datasets=[{data:empty?[0]:data,borderColor:color,backgroundColor:bgMap[color]||'rgba(255,255,255,0.05)',pointBackgroundColor:color,pointRadius:empty?0:3,borderWidth:2,tension:0.3,fill:true}];
  if (targetVal && !empty) datasets.push({data:labels.map(()=>targetVal),borderColor:'rgba(76,175,130,0.5)',borderDash:[5,4],pointRadius:0,borderWidth:1.5,fill:false});
  chartInstances[id]=new Chart(ctx,{type:'line',data:{labels:empty?['Log sessions to see data']:labels,datasets},options:{...base,scales:{...base.scales,y:{...base.scales.y,reverse:!!invertY}}}});
}

async function renderPerformance() {
  const el = document.getElementById('stats-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  const [{ data: logs }, { data: body }] = await Promise.all([
    sb.from('session_logs').select('*').order('date'),
    sb.from('body_logs').select('*').order('date'),
  ]);
  const info = getTodayInfo();
  const allLogs = logs || [];
  const allBody = body || [];
  const isPlanned = l => l.slot && l.slot !== 'custom';
  const plannedLogs = allLogs.filter(isPlanned);
  const weeksComplete = info ? info.weekIdx : 0;
  const fencingCount = allLogs.filter(l=>l.type==='fencing').length;

  let scheduledUntilToday = 0;
  if (info) PLAN.forEach((w, wi) => {
    if (wi < info.weekIdx) scheduledUntilToday += w.sessions;
    else if (wi === info.weekIdx) w.days.forEach((day, di) => { if (di <= info.dayIdx) { if (day.am&&day.am.t!=='rest') scheduledUntilToday++; if (day.pm&&day.pm.t!=='rest') scheduledUntilToday++; } });
  });
  const adherencePct = scheduledUntilToday > 0 ? Math.min(100, Math.round(plannedLogs.length/scheduledUntilToday*100)) : 0;

  // Done-vs-scheduled by type (up to today)
  const today = todayStr();
  const sch = {}, done = {};
  PERF_TYPES.forEach(t => { sch[t]=0; done[t]=0; });
  PLAN.forEach((w,wi) => { if (!info || wi>info.weekIdx) return; w.days.forEach((day,di)=>{ if (sessionDate(wi,di)>today) return; [day.am,day.pm].forEach(s=>{ if (s&&s.t&&sch[s.t]!==undefined) sch[s.t]++; }); }); });
  allLogs.filter(l=>isPlanned(l)&&l.date<=today).forEach(l=>{ if (done[l.type]!==undefined) done[l.type]++; });
  const extraLogs = allLogs.filter(l=>l.slot==='custom');

  const makeRow = (t) => {
    if (sch[t]===0) return '';
    const pct = Math.min(100, Math.round(done[t]/sch[t]*100));
    const c = pct>=80?'var(--green)':pct>=50?'var(--yellow)':'var(--red)';
    return `<div style="margin-bottom:9px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:3px"><span style="font-size:12px;font-weight:600;color:${typeColor(t)}">${typeLabel(t)}</span><span style="font-size:11px;color:var(--muted)">${done[t]}/${sch[t]} · <span style="color:${c}">${pct}%</span></span></div><div style="height:4px;background:rgba(255,255,255,0.07);border-radius:3px;overflow:hidden"><div style="height:100%;width:${pct}%;background:${typeColor(t)};border-radius:3px"></div></div></div>`;
  };

  // Calorie adherence (last 30 days)
  const macroDays=[], macroPct=[];
  for (let i=30;i>=0;i--) { const d=new Date(); d.setDate(d.getDate()-i); const ds=d.toISOString().slice(0,10); const m=safeParseJSON(localStorage.getItem('macros_'+ds)); if(!m)continue; const di=getPlanInfoForDate(ds); if(!di)continue; const target=NUTRITION[di.dayType]||NUTRITION.rest; macroDays.push(ds.slice(5)); macroPct.push(Math.min(Math.round(m.kcal/target.kcal*100),150)); }

  // Bodyweight trend
  const bw = allBody.filter(b=>b.weight>0);
  // Top lift trend (Trap bar deadlift max kg per session)
  const liftName='Trap bar deadlift'; const liftPts=[];
  allLogs.filter(l=>l.type==='strength').forEach(l=>{ const ex=(l.data?.exercises||[]).find(e=>e.name===liftName); if(ex&&ex.sets?.length){ const mx=Math.max(...ex.sets.map(s=>s.kg||0)); if(mx>0) liftPts.push({date:l.date,kg:mx}); } });
  liftPts.sort((a,b)=>a.date.localeCompare(b.date));
  // Fencing quality trend (avg of focus+technique+energy)
  const fq = allLogs.filter(l=>l.type==='fencing'&&(l.data?.focus||l.data?.technique||l.data?.energy)).map(l=>{ const v=[l.data.energy,l.data.focus,l.data.technique].filter(x=>x); return {date:l.date,val:+(v.reduce((a,b)=>a+b,0)/v.length).toFixed(1)}; });
  fq.sort((a,b)=>a.date.localeCompare(b.date));

  el.innerHTML = `
    <div style="position:relative;background:linear-gradient(135deg,#0c0d10 0%,#151a22 100%);border:1px solid rgba(61,155,233,.25);border-radius:12px;padding:16px;margin-bottom:12px;display:flex;align-items:center;gap:14px">
      <div style="flex:1;min-width:0">
        <div style="font-size:10px;letter-spacing:2px;color:var(--accent);font-weight:700;margin-bottom:3px">PERFORMANCE</div>
        <div style="font-size:18px;font-weight:900;color:white">${weeksComplete} <span style="font-size:12px;font-weight:500;color:#6e7a8a">weeks complete</span></div>
        <div style="font-size:11px;color:#6e7a8a;margin-top:2px">${plannedLogs.length} of ${scheduledUntilToday} scheduled · ${adherencePct}% done</div>
      </div>
    </div>
    <div class="sec-label">Program Overview</div>
    <div class="card" style="margin-bottom:14px">
      <div class="stat-grid" style="margin-bottom:10px">
        <div class="stat-tile"><div class="stat-val">${weeksComplete}<span style="font-size:13px;color:#6e7a8a">/${TOTAL_WEEKS}</span></div><div class="stat-lbl">Weeks Done</div></div>
        <div class="stat-tile"><div class="stat-val">${plannedLogs.length}</div><div class="stat-lbl">Sessions Logged</div></div>
        <div class="stat-tile"><div class="stat-val" style="color:var(--accent)">${fencingCount}</div><div class="stat-lbl">Fencing Sessions</div></div>
        <div class="stat-tile"><div class="stat-val" style="color:${adherencePct>=80?'var(--green)':adherencePct>=60?'var(--yellow)':'var(--orange)'}">${adherencePct}%</div><div class="stat-lbl">Adherence</div></div>
      </div>
      <div style="height:6px;background:#1e1e1e;border-radius:4px;overflow:hidden"><div style="height:100%;width:${Math.round(weeksComplete/TOTAL_WEEKS*100)}%;background:var(--accent);border-radius:4px;transition:width .4s"></div></div>
    </div>
    <div class="sec-label">Adherence by Type <span style="font-size:10px;color:#6e7a8a;font-weight:400">(done vs scheduled)</span></div>
    <div class="card" style="margin-bottom:6px;padding:14px">${PERF_TYPES.map(makeRow).join('')||'<div style="color:var(--muted);font-size:12px">Log sessions to see stats</div>'}</div>
    <div style="margin-bottom:14px;padding:0 2px"><div style="font-size:10px;color:#6e7a8a;margin-bottom:4px;letter-spacing:.5px;text-transform:uppercase">Extra / unplanned</div><div style="display:flex;flex-wrap:wrap;gap:6px">${extraLogs.length?`<span style="font-size:11px;color:var(--accent);background:rgba(61,155,233,.1);border:1px solid rgba(61,155,233,.2);border-radius:20px;padding:2px 8px">${extraLogs.length} logged</span>`:'<span style="font-size:11px;color:var(--muted)">None logged yet</span>'}</div></div>

    <div class="sec-label">Bodyweight <span style="font-size:10px;color:#6e7a8a;font-weight:400">(kg · target ${USER.targetWeight})</span></div>
    <div class="chart-wrap"><div class="chart-canvas-wrap"><canvas id="c-bw"></canvas></div><div style="font-size:10px;color:#6e7a8a;margin-top:8px;line-height:1.5">📈 Green dashed line = ${USER.targetWeight}kg goal. Muscle gain is slow and steady — aim for a gradual climb, not spikes.</div></div>

    <div class="sec-label">Trap Bar Deadlift <span style="font-size:10px;color:#6e7a8a;font-weight:400">(top set, kg)</span></div>
    <div class="chart-wrap"><div class="chart-canvas-wrap"><canvas id="c-lift"></canvas></div><div style="font-size:10px;color:#6e7a8a;margin-top:8px;line-height:1.5">💪 Your strongest indicator of lower-body power. Should climb steadily through the summer build.</div></div>

    <div class="sec-label">Fencing Quality <span style="font-size:10px;color:#6e7a8a;font-weight:400">(avg energy/focus/technique)</span></div>
    <div class="chart-wrap"><div class="chart-canvas-wrap"><canvas id="c-fq"></canvas></div><div style="font-size:10px;color:#6e7a8a;margin-top:8px;line-height:1.5">🗡️ How your sessions feel over time. Rate honestly after each one — patterns reveal when you're fresh vs fatigued.</div></div>

    <div class="sec-label">Calorie Adherence <span style="font-size:10px;color:#6e7a8a;font-weight:400">(% of target, last 30 days)</span></div>
    <div class="chart-wrap"><div class="chart-canvas-wrap"><canvas id="c-macros"></canvas></div><div style="font-size:10px;color:#6e7a8a;margin-top:8px;line-height:1.5">🥗 Bars near 100% = fuelling the build. Consistently under 90% → you won't gain the muscle you're training for.</div></div>
    <div style="height:16px"></div>
  `;

  Object.values(chartInstances).forEach(c => c.destroy()); chartInstances = {};
  const base = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#6e7a8a',font:{size:9}},grid:{color:'rgba(255,255,255,0.04)'}}, y:{ticks:{color:'#6e7a8a',font:{size:9}},grid:{color:'rgba(255,255,255,0.06)'}} } };
  mkLine('c-bw', base, bw.map(b=>b.date.slice(5)), bw.map(b=>b.weight), 'var(--accent)', false, USER.targetWeight);
  mkLine('c-lift', base, liftPts.map(p=>p.date.slice(5)), liftPts.map(p=>p.kg), 'var(--orange)', false);
  mkLine('c-fq', base, fq.map(p=>p.date.slice(5)), fq.map(p=>p.val), 'var(--accent)', false);
  mkLine('c-macros', base, macroDays, macroPct, 'var(--yellow)', false);
}

// ═══════════════════════════════════════════
//  BODY TAB
// ═══════════════════════════════════════════
async function renderBody() {
  const el = document.getElementById('body-content');
  el.innerHTML = '<div class="loading">Loading…</div>';
  const [{ data: bodyRows }, { data: injuries }] = await Promise.all([
    sb.from('body_logs').select('*').order('date',{ascending:false}).limit(130),
    sb.from('injuries').select('*').order('created_at',{ascending:false}),
  ]);
  const todayLog = bodyRows?.find(b=>b.date===todayStr()) || null;
  _hrvSelected = todayLog?.hrv || null;
  const recent = (bodyRows||[]).slice(0,7);
  const active = (injuries||[]).filter(i=>i.status!=='resolved');
  const resolved = (injuries||[]).filter(i=>i.status==='resolved');

  el.innerHTML = `
    <div class="sec-label">Today's Body Log</div>
    <div class="card">
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-field"><div class="form-label">Weight (kg)</div><input class="form-input" id="b-weight" type="number" step="0.1" placeholder="${USER.weight}" value="${todayLog?.weight||''}"></div>
        <div class="form-field"><div class="form-label">Resting HR</div><input class="form-input" id="b-rhr" type="number" placeholder="58" value="${todayLog?.resting_hr||''}"></div>
      </div>
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-field"><div class="form-label">Sleep Hours</div><input class="form-input" id="b-sleeph" type="number" step="0.5" placeholder="8" value="${todayLog?.sleep_hours||''}"></div>
        <div class="form-field"><div class="form-label">Sleep Score (Polar)</div><input class="form-input" id="b-sleeps" type="number" placeholder="0–100" value="${todayLog?.sleep_score??''}"></div>
      </div>
      <div class="form-row" style="margin-bottom:10px">
        <div class="form-field"><div class="form-label">HRV (ms)</div><input class="form-input" id="b-hrv-val" type="number" placeholder="e.g. 62" value="${todayLog?.hrv_value||''}"></div>
        <div class="form-field"><div class="form-label">HRV Status</div><div class="hrv-btns" style="margin-top:6px"><button class="hrv-btn ${_hrvSelected==='green'?'active-green':''}" onclick="selectHRV('green')">Green</button><button class="hrv-btn ${_hrvSelected==='orange'?'active-orange':''}" onclick="selectHRV('orange')">Orange</button><button class="hrv-btn ${_hrvSelected==='red'?'active-red':''}" onclick="selectHRV('red')">Red</button></div></div>
      </div>
      <div class="form-field"><div class="form-label">Notes</div><input class="form-input" id="b-notes" type="text" placeholder="How do you feel today?" value="${todayLog?.notes||''}"></div>
      <button class="btn-primary" style="margin-top:4px" onclick="saveBodyLog()">Save Body Log</button>
    </div>
    <div class="sec-label">Last 7 Days</div>
    ${recent.length ? recent.map(b=>`<div class="log-recent-item"><div class="log-ri-top"><span class="log-ri-name">${b.date}</span><span class="log-ri-date" style="color:var(--yellow)">${b.weight?b.weight+' kg':''}</span></div><div class="log-ri-metrics">${b.sleep_score!=null?`Sleep <em>${b.sleep_score}</em>`:''}${b.sleep_hours?` · ${b.sleep_hours}h`:''}${b.hrv?` · HRV <em style="color:${b.hrv==='green'?'var(--green)':b.hrv==='orange'?'var(--yellow)':'var(--red)'}">${b.hrv}</em>`:''}${b.resting_hr?` · RHR <em>${b.resting_hr}bpm</em>`:''}</div></div>`).join('') : '<div class="empty-state" style="padding:16px"><p>No body logs yet.</p></div>'}
    ${buildConnectionsCard()}
    <div class="sec-label">Injuries</div>
    ${active.length ? active.map(inj=>`<div class="injury-item"><div class="injury-top"><span class="injury-part">${inj.body_part}</span><span class="injury-badge badge-${inj.status}">${inj.status}</span></div><div class="injury-desc">${inj.description||''}</div><div style="display:flex;gap:6px;margin-top:8px"><button style="flex:1;padding:6px;background:rgba(76,175,130,.1);border:1px solid rgba(76,175,130,.25);border-radius:7px;color:var(--green);font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif" onclick="resolveInjury('${inj.id}')">Resolved</button><button style="flex:1;padding:6px;background:rgba(232,184,75,.1);border:1px solid rgba(232,184,75,.25);border-radius:7px;color:var(--yellow);font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif" onclick="monitorInjury('${inj.id}')">Monitoring</button></div></div>`).join('') : '<div style="font-size:12px;color:var(--green);padding:8px 0">No active injuries.</div>'}
    <button class="add-btn" style="margin-top:8px" onclick="openAddInjury()">+ Log new injury</button>
    ${resolved.length?`<div class="sec-label">Resolved</div>${resolved.map(inj=>`<div class="injury-item" style="opacity:.45"><div class="injury-top"><span class="injury-part">${inj.body_part}</span><span class="injury-badge badge-resolved">resolved</span></div><div class="injury-desc">${inj.description||''}</div></div>`).join('')}`:''}
    <div class="sec-label">Sleep Score Trend</div>
    <div class="chart-wrap"><div class="chart-canvas-wrap"><canvas id="b-c-sleep"></canvas></div></div>
    <div class="sec-label">HRV Trend <span style="font-size:10px;color:#6e7a8a;font-weight:400">(ms)</span></div>
    <div class="chart-wrap"><div class="chart-canvas-wrap"><canvas id="b-c-hrv"></canvas></div></div>
    <div style="height:16px"></div>
  `;

  const chronoBody = [...(bodyRows||[])].reverse();
  const base = { responsive:true, maintainAspectRatio:false, plugins:{legend:{display:false}}, scales:{ x:{ticks:{color:'#6e7a8a',font:{size:9}},grid:{color:'rgba(255,255,255,0.04)'}}, y:{ticks:{color:'#6e7a8a',font:{size:9}},grid:{color:'rgba(255,255,255,0.06)'}} } };
  const sl = chronoBody.filter(b=>b.sleep_score>0);
  mkLine('b-c-sleep', base, sl.map(b=>b.date.slice(5)), sl.map(b=>b.sleep_score), 'var(--accent)', false);
  const hrv = chronoBody.filter(b=>b.hrv_value>0);
  mkLine('b-c-hrv', base, hrv.map(b=>b.date.slice(5)), hrv.map(b=>b.hrv_value), 'var(--green)', false);
}

function selectHRV(val) {
  _hrvSelected=val;
  document.querySelectorAll('.hrv-btn').forEach(b=>{ b.className='hrv-btn'; if(b.textContent.toLowerCase()===val) b.classList.add('active-'+val); });
}

async function saveBodyLog() {
  const entry={date:todayStr(),weight:parseFloat(document.getElementById('b-weight')?.value)||null,resting_hr:parseInt(document.getElementById('b-rhr')?.value)||null,sleep_hours:parseFloat(document.getElementById('b-sleeph')?.value)||null,sleep_score:parseInt(document.getElementById('b-sleeps')?.value)||null,hrv_value:parseInt(document.getElementById('b-hrv-val')?.value)||null,hrv:_hrvSelected,notes:document.getElementById('b-notes')?.value||''};
  const { error } = await sb.from('body_logs').upsert(entry,{onConflict:'date'});
  if (error) { showToast('Error: '+(error.message||'check Supabase')); return; }
  if (entry.sleep_score) localStorage.setItem('sleep_'+todayStr(), entry.sleep_score);
  showToast('Body log saved ✓');
  renderBody();
  if (activePanel==='today') renderToday();
}

function openAddInjury() {
  openModal('Log Injury',`
    <div class="form-field"><div class="form-label">Body Part</div><input class="form-input" id="inj-part" type="text" placeholder="e.g. Left hip"></div>
    <div class="form-field"><div class="form-label">Status</div><select class="form-select" id="inj-status"><option value="active">Active — affects training</option><option value="monitoring">Monitoring — keeping an eye on it</option></select></div>
    <div class="form-field"><div class="form-label">Description</div><input class="form-input" id="inj-desc" type="text" placeholder="Pain level, location, when it started…"></div>
  `, saveInjury);
}
async function saveInjury() {
  const body_part=document.getElementById('inj-part')?.value||''; if(!body_part){closeModal();return;}
  await sb.from('injuries').insert({date_start:todayStr(),body_part,status:document.getElementById('inj-status')?.value||'active',description:document.getElementById('inj-desc')?.value||''});
  closeModal(); renderBody();
}
async function resolveInjury(id) { await sb.from('injuries').update({status:'resolved',date_resolved:todayStr()}).eq('id',id); renderBody(); }
async function monitorInjury(id) { await sb.from('injuries').update({status:'monitoring'}).eq('id',id); renderBody(); }

// ═══════════════════════════════════════════
//  POLAR (sleep + HRV sync)
// ═══════════════════════════════════════════
function connectPolar() {
  const url = `https://flow.polar.com/oauth2/authorization?response_type=code&client_id=${POLAR_CFG.clientId}&redirect_uri=${encodeURIComponent(POLAR_CFG.redirectUri)}&state=polar`;
  window.location.href = url;
}
async function handlePolarCallback(code) {
  try {
    const res = await fetch(`${SUPABASE.url}/functions/v1/polar-token`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ code }) });
    const data = await res.json();
    if (!data.access_token) throw new Error(JSON.stringify(data));
    localStorage.setItem('polar_auth', JSON.stringify({access_token:data.access_token, x_user_id:data.x_user_id}));
    showToast('Polar connected! Tap Import to sync sleep & HRV.');
  } catch(e) { showToast('Polar connection failed: ' + e.message); }
}
async function importPolar() {
  const auth = safeParseJSON(localStorage.getItem('polar_auth'));
  if (!auth?.access_token) { showToast('Connect Polar first'); return; }
  showToast('Importing Polar sleep & HRV…');
  try {
    const headers = {'Authorization':`Bearer ${auth.access_token}`,'Accept':'application/json'};
    const [sleepRes, nrRes] = await Promise.all([
      fetch(`https://www.polaraccesslink.com/v3/users/${auth.x_user_id}/sleep`, {headers}),
      fetch(`https://www.polaraccesslink.com/v3/users/${auth.x_user_id}/nightly-recharge`, {headers})
    ]);
    const sleepData = await sleepRes.json().catch(()=>({}));
    const nrData = await nrRes.json().catch(()=>({}));
    const sleepItems = sleepData?.nights || sleepData?.data || [];
    const nrItems = nrData?.recharges || nrData?.data || [];
    const nrByDate = {}; nrItems.forEach(r => { const d=(r.date||'').slice(0,10); if(d) nrByDate[d]=r; });
    let imported = 0;
    for (const night of sleepItems) {
      const date = (night.date || night.sleep_start_time || '').slice(0,10);
      if (!date || date < PROGRAM_START) continue;
      const sleepScore = night.sleep_score ?? null;
      const nr = nrByDate[date]; const ansCharge = nr?.ans_charge ?? null;
      let hrv = null; if (ansCharge!==null) hrv = ansCharge>=3?'green':ansCharge>=2?'orange':'red';
      const entry = {date, sleep_score:sleepScore, hrv, hrv_value:nr?.heart_rate_avg??null};
      Object.keys(entry).forEach(k => entry[k]===null && delete entry[k]);
      await sb.from('body_logs').upsert({date, ...entry},{onConflict:'date'});
      if (sleepScore) localStorage.setItem('sleep_'+date, sleepScore);
      imported++;
    }
    showToast(`✓ Imported ${imported} night${imported!==1?'s':''}`);
    if (activePanel==='body') renderBody();
  } catch(e) { showToast('Import failed: ' + e.message); }
}
function disconnectPolar() { localStorage.removeItem('polar_auth'); renderBody(); }

function buildConnectionsCard() {
  const polar = safeParseJSON(localStorage.getItem('polar_auth'));
  return `<div class="sec-label">Connections</div>
    <div class="card" style="margin-bottom:12px">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0">
        <div style="display:flex;align-items:center;gap:10px">
          <div style="width:32px;height:32px;background:#D0021B;border-radius:8px;display:flex;align-items:center;justify-content:center"><svg width="18" height="18" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2" stroke="#D0021B" stroke-width="2" stroke-linecap="round"/></svg></div>
          <div><div style="font-size:13px;font-weight:600;color:var(--text)">Polar Flow</div><div style="font-size:11px;color:${polar?'var(--green)':'var(--muted)'}">${polar?'● Connected · Sleep & HRV':'○ Not connected'}</div></div>
        </div>
        <div style="display:flex;gap:6px">${polar?`<button onclick="importPolar()" style="padding:6px 10px;background:rgba(208,2,27,.15);border:1px solid rgba(208,2,27,.3);border-radius:7px;color:#D0021B;font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">Import</button><button onclick="disconnectPolar()" style="padding:6px 10px;background:var(--card);border:1px solid var(--border);border-radius:7px;color:var(--muted);font-size:11px;cursor:pointer;font-family:'DM Sans',sans-serif">Disconnect</button>`:`<button onclick="connectPolar()" style="padding:6px 12px;background:rgba(208,2,27,.15);border:1px solid rgba(208,2,27,.4);border-radius:7px;color:#D0021B;font-size:11px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif">Connect</button>`}</div>
      </div>
    </div>`;
}

// ═══════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════
(function handleOAuthCallback() {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code'); const state = params.get('state');
  if (!code) return;
  history.replaceState({}, '', window.location.pathname);
  if (state === 'polar') handlePolarCallback(code).then(() => showPanel('body'));
})();

document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  injectBrand();
  updateHeader();
  setInterval(updateHeader, 60000);
  renderToday();
});
