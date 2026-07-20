// ─── 语块本 ───

const CATS = ['日常对话','商务英语','TED演讲','阅读','其他'];
const CAT_COLORS = { '日常对话':'#10B981', '商务英语':'#6366F1', 'TED演讲':'#F59E0B', '阅读':'#8B5CF6', '其他':'#94A3B8' };
const CAT_CLASS = { '日常对话':'badge-daily', '商务英语':'badge-biz', 'TED演讲':'badge-ted', '阅读':'badge-read', '其他':'badge-other' };
const KEY = 'phrasebook_data';

const $ = id => document.getElementById(id);
const esc = s => { if(!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
const today = () => new Date().toISOString().slice(0,10);
const now = () => Date.now();
const dateCN = ds => { const d = new Date(ds); return (d.getMonth()+1)+'月'+d.getDate()+'日 星期'+['日','一','二','三','四','五','六'][d.getDay()]; };
const weekDays = ['日','一','二','三','四','五','六'];

// ─── State ───
let data = [];
let page = 'today';
let bankFilter = 'all';
let reviewMode = 'due';
let reviewList = [], reviewIdx = 0, reviewRevealed = false;

function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) data = JSON.parse(raw); } catch(e) {}
  if (!Array.isArray(data)) data = [];
}
function save() { localStorage.setItem(KEY, JSON.stringify(data)); }

// ─── Navigation ───
function nav(p) {
  page = p;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === p));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const el = $('p-'+p); if (el) el.classList.add('active');
  window.scrollTo(0,0);
  if (p === 'today') renderToday();
  else if (p === 'bank') renderBank();
  else if (p === 'review') renderReview();
  else if (p === 'stats') renderStats();
}

// ─── Modal ───
function openModal(title, editId) {
  $('modal-title').textContent = title;
  $('edit-id').value = editId || '';
  if (editId) {
    const p = data.find(x => x.id === editId);
    if (!p) return;
    $('f-phrase').value = p.phrase;
    $('f-meaning').value = p.meaning;
    $('f-example').value = p.example || '';
    $('f-example-cn').value = p.exampleCn || '';
    $('f-category').value = p.category || '日常对话';
    $('f-source').value = p.source || '';
  } else {
    $('f-phrase').value = '';
    $('f-meaning').value = '';
    $('f-example').value = '';
    $('f-example-cn').value = '';
    $('f-category').value = '日常对话';
    $('f-source').value = '';
  }
  $('modal').classList.add('open');
  setTimeout(() => $('f-phrase').focus(), 300);
}
function closeModal() { $('modal').classList.remove('open'); }

function saveEntry(e) {
  e.preventDefault();
  const id = $('edit-id').value;
  const phrase = $('f-phrase').value.trim();
  const meaning = $('f-meaning').value.trim();
  if (!phrase || !meaning) return false;

  if (id) {
    const p = data.find(x => x.id === parseInt(id));
    if (p) {
      Object.assign(p, {
        phrase, meaning,
        example: $('f-example').value.trim(),
        exampleCn: $('f-example-cn').value.trim(),
        category: $('f-category').value,
        source: $('f-source').value.trim()
      });
    }
  } else {
    data.unshift({
      id: now(),
      phrase, meaning,
      example: $('f-example').value.trim(),
      exampleCn: $('f-example-cn').value.trim(),
      category: $('f-category').value,
      source: $('f-source').value.trim(),
      date: today(),
      mastery: 0,
      reviewCount: 0,
      lastReview: null
    });
  }
  save();
  closeModal();
  nav(page);
  return false;
}

function deleteEntry(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('删除这个词组？')) return;
  data = data.filter(p => p.id !== id);
  save();
  nav(page);
}

// ─── Search ───

// ─── Voice Input ───
var _recognition = null;
var _recording = false;

function startVoiceInput(){
  // Check browser support
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    showMicStatus('语音识别不支持，请使用Chrome浏览器', 'error');
    return;
  }
  
  if(_recording){
    stopVoiceInput();
    return;
  }
  
  try {
    _recognition = new SpeechRecognition();
    _recognition.lang = 'en-US';
    _recognition.continuous = false;
    _recognition.interimResults = true;
    _recognition.maxAlternatives = 1;
    
    _recording = true;
    var micBtn = document.getElementById('mic-btn');
    var statusEl = document.getElementById('mic-status');
    
    micBtn.classList.add('recording');
    micBtn.textContent = '⏹';
    showMicStatus('正在听...请说出英文词组', 'listening');
    
    _recognition.onresult = function(e){
      var transcript = '';
      for(var i=e.resultIndex; i<e.results.length; i++){
        transcript += e.results[i][0].transcript;
        if(e.results[i].isFinal){
          var finalText = e.results[i][0].transcript.trim();
          var input = document.getElementById('f-phrase');
          input.value = finalText;
          showMicStatus('✅ 识别完成: "' + finalText + '"', 'done');
        }
      }
    };
    
    _recognition.onerror = function(e){
      showMicStatus('识别出错: ' + e.error, 'error');
      stopVoiceInput();
    };
    
    _recognition.onend = function(){
      if(_recording) stopVoiceInput();
    };
    
    _recognition.start();
  } catch(e){
    showMicStatus('启动失败: ' + e.message, 'error');
    stopVoiceInput();
  }
}

function stopVoiceInput(){
  _recording = false;
  var micBtn = document.getElementById('mic-btn');
  if(micBtn){
    micBtn.classList.remove('recording');
    micBtn.textContent = '🎤';
  }
  if(_recognition){
    try { _recognition.stop(); } catch(e) {}
    _recognition = null;
  }
  var statusEl = document.getElementById('mic-status');
  if(statusEl && statusEl.textContent.indexOf('✅') < 0){
    showMicStatus('已取消', '');
  }
}

function showMicStatus(msg, type){
  var el = document.getElementById('mic-status');
  if(!el) return;
  el.textContent = msg;
  el.className = 'mic-status';
  if(type) el.classList.add(type);
}


function toggleSearch() {
  const m = $('modal-search');
  const open = m.classList.contains('open');
  if (open) { m.classList.remove('open'); return; }
  m.classList.add('open');
  $('sq').value = '';
  $('sr').innerHTML = '';
  setTimeout(() => $('sq').focus(), 300);
}

function doSearch() {
  const q = $('sq').value.trim().toLowerCase();
  const el = $('sr');
  if (!q) { el.innerHTML = ''; return; }
  const res = data.filter(p =>
    p.phrase.toLowerCase().includes(q) ||
    p.meaning.includes(q) ||
    (p.example && p.example.toLowerCase().includes(q))
  );
  if (!res.length) { el.innerHTML = '<div class="empty-state" style="padding:20px"><div class="muted">无匹配</div></div>'; return; }
  el.innerHTML = res.map(p => entryHTML(p, true)).join('');
}

// ─── Today ───
function renderToday() {
  const td = today();
  const todayItems = data.filter(p => p.date === td);
  const dueItems = getDue();
  const weekData = getWeekData();

  let h = `<div class="today-hdr"><div class="td">${dateCN(td)}</div><div class="tt">今天学了吗？</div><div class="ts">已记录 ${todayItems.length} 个词组</div></div>`;
  h += `<button class="btn btn-primary btn-block" onclick="openModal('添加词组')">＋ 记录新词组</button>`;

  // 待复习
  if (dueItems.length) {
    h += `<div class="card" style="border-color:var(--warning)"><div class="fw-6 mb-8">🔄 待复习 (${dueItems.length})</div>`;
    dueItems.slice(0, 4).forEach(p => {
      h += `<div class="flex" style="justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">`;
      h += `<div><div class="fw-6" style="font-size:.875rem">${esc(p.phrase)}</div><div class="muted" style="font-size:.75rem">${esc(p.meaning)}</div></div>`;
      h += `<button class="btn btn-sm btn-outline" onclick="nav('review')">复习</button></div>`;
    });
    if (dueItems.length > 4) h += `<button class="btn btn-sm btn-ghost mt-8 btn-block" onclick="nav('review')">查看全部 →</button>`;
    h += `</div>`;
  }

  // 今日记录
  h += `<div class="card"><div class="fw-6 mb-8">📝 今日记录</div>`;
  if (!todayItems.length) {
    h += `<div class="empty-state" style="padding:16px"><div class="muted">还没有记录</div></div>`;
  } else {
    todayItems.forEach(p => h += entryHTML(p));
  }
  h += `</div>`;

  // 本周趋势
  h += `<div class="card"><div class="fw-6 mb-8">本周趋势</div>`;
  h += `<div class="week-chart">`;
  const maxVal = Math.max(...weekData.map(d => d.c), 1);
  weekData.forEach(d => {
    const barH = Math.max(4, d.c / maxVal * 48);
    h += `<div class="week-bar">`;
    h += `<div class="cnt">${d.c}</div>`;
    h += `<div class="bar" style="height:${barH}px;background:${d.c > 0 ? 'var(--primary)' : 'var(--border)'}"></div>`;
    h += `<div class="day">${weekDays[d.d.getDay()]}</div></div>`;
  });
  h += `</div></div>`;

  $('p-today').innerHTML = h;
}

// ─── Bank ───
function renderBank() {
  let h = `<div class="action-bar"><button class="btn btn-primary" onclick="openModal('添加词组')">＋ 添加</button><button class="btn btn-outline" onclick="toggleSearch()">🔍 搜索</button></div>`;
  
  h += `<div class="tags" id="bank-tags">`;
  h += `<button class="tag ${bankFilter==='all'?'active':''}" onclick="setBankFilter('all')">全部</button>`;
  CATS.forEach(c => {
    h += `<button class="tag ${c===bankFilter?'active':''}" onclick="setBankFilter('${c}')">${c}</button>`;
  });
  h += `</div>`;

  const filtered = bankFilter === 'all' ? data : data.filter(p => p.category === bankFilter);
  h += `<div class="muted" style="font-size:.8125rem;margin-bottom:10px">共 ${data.length} 个${bankFilter!=='all'?' · '+bankFilter+' '+filtered.length+' 个':''}</div>`;

  if (!filtered.length) {
    h += `<div class="empty-state"><div class="icon">📚</div><div class="title">还没有词组</div><div class="desc">点击"添加"开始记录你学到的语块</div></div>`;
  } else {
    filtered.forEach(p => h += entryHTML(p));
  }
  $('p-bank').innerHTML = h;
}

function setBankFilter(c) { bankFilter = c; renderBank(); }

// ─── Review ───
function renderReview() {
  let h = `<div class="action-bar"><button class="btn ${reviewMode==='due'?'btn-primary':'btn-ghost'}" onclick="setReviewMode('due')">待复习</button><button class="btn ${reviewMode==='all'?'btn-primary':'btn-ghost'}" onclick="setReviewMode('all')">全部</button></div>`;

  if (!data.length) {
    h += `<div class="empty-state"><div class="icon">🔄</div><div class="title">还没有词组</div><div class="desc">先去添加词组再来复习</div></div>`;
    $('p-review').innerHTML = h; return;
  }

  reviewList = reviewMode === 'due' ? getDue() : [...data].sort((a, b) => {
    if (a.mastery !== b.mastery) return a.mastery - b.mastery;
    return (a.lastReview || 0) - (b.lastReview || 0);
  });

  if (!reviewList.length) {
    h += `<div class="empty-state"><div class="icon">🎉</div><div class="title">全部掌握！</div><div class="desc">太棒了，所有词组都已掌握</div></div>`;
    $('p-review').innerHTML = h; return;
  }

  reviewIdx = 0; reviewRevealed = false;
  h += `<div class="review-progress">${reviewList.length} 个待复习</div><div id="rev-card-wrap">${reviewCardHTML(reviewList[0])}</div>`;
  $('p-review').innerHTML = h;
}

function setReviewMode(m) { reviewMode = m; renderReview(); }

function reviewCardHTML(p) {
  const stars = '★'.repeat(Math.min(p.mastery,5)) + '☆'.repeat(Math.max(5-p.mastery,0));
  let h = `<div class="review-card" onclick="flipReview()"><div class="review-phrase">${esc(p.phrase)}</div>`;
  h += `<div class="review-meaning" id="rev-meaning">${esc(p.meaning)}</div>`;
  if (p.example) {
    h += `<div class="review-example" id="rev-example"><div style="font-weight:500;margin-bottom:4px">${esc(p.example)}</div>`;
    if (p.exampleCn) h += `<div class="muted" style="font-size:.75rem">${esc(p.exampleCn)}</div>`;
    h += `</div>`;
  }
  h += `<div class="review-hint" id="rev-hint">👆 点击查看释义</div></div>`;
  h += `<div id="rev-actions" style="display:none">`;
  h += `<div class="muted tc" style="font-size:.75rem;margin:10px 0 6px">掌握程度：<span style="color:var(--warning)">${stars}</span></div>`;
  h += `<div class="flex gap-4">`;
  h += `<button class="btn btn-sm btn-ghost" onclick="rateReview(0)" style="flex:1;border:1px solid var(--border)">😅 忘了</button>`;
  h += `<button class="btn btn-sm btn-outline" onclick="rateReview(1)" style="flex:1">🤔 模糊</button>`;
  h += `<button class="btn btn-sm btn-primary" onclick="rateReview(2)" style="flex:1">✅ 记得</button>`;
  h += `</div></div>`;
  return h;
}

function flipReview() {
  if (reviewRevealed) return;
  reviewRevealed = true;
  $('rev-meaning').classList.add('show');
  $('rev-hint').style.display = 'none';
  const ex = $('rev-example'); if (ex) ex.classList.add('show');
  $('rev-actions').style.display = 'block';
}

function rateReview(level) {
  const p = reviewList[reviewIdx];
  if (!p) return;
  if (level === 0) p.mastery = Math.max(0, p.mastery - 1);
  else if (level === 1) p.mastery = Math.min(5, p.mastery + 1);
  else p.mastery = Math.min(5, p.mastery + 2);
  p.reviewCount = (p.reviewCount || 0) + 1;
  p.lastReview = now();
  save();

  reviewIdx++;
  reviewRevealed = false;
  if (reviewIdx >= reviewList.length) {
    $('rev-card-wrap').innerHTML = `<div class="empty-state"><div class="icon">🎉</div><div class="title">复习完成！</div><div class="desc">继续保持！</div></div>`;
    return;
  }
  $('rev-card-wrap').innerHTML = reviewCardHTML(reviewList[reviewIdx]);
}

function getDue() {
  const n = now();
  const intervals = [0, 1, 2, 4, 7, 14, 30];
  return data.filter(p => {
    if (p.mastery >= 5) return false;
    if (!p.lastReview) return true;
    const days = (n - p.lastReview) / 86400000;
    return days >= (intervals[Math.min(p.mastery, intervals.length-1)]);
  });
}

// ─── Stats ───
function renderStats() {
  const total = data.length;
  const td = today();
  const todayAdd = data.filter(p => p.date === td).length;
  const mastered = data.filter(p => p.mastery >= 5).length;
  const due = getDue().length;
  const reviewed = data.filter(p => p.reviewCount > 0).length;
  const weekData = getWeekData();

  let h = `<div class="stats-grid">`;
  h += `<div class="stat-card"><div class="num">${total}</div><div class="label">总词组</div></div>`;
  h += `<div class="stat-card"><div class="num">${todayAdd}</div><div class="label">今日新增</div></div>`;
  h += `<div class="stat-card"><div class="num">${mastered}</div><div class="label">已掌握</div></div>`;
  h += `<div class="stat-card"><div class="num">${due}</div><div class="label">待复习</div></div>`;
  h += `</div>`;

  if (total > 0) {
    const pct = Math.round(mastered / total * 100);
    h += `<div class="card"><div class="fw-6 mb-8">掌握进度</div><div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    h += `<div class="flex" style="justify-content:space-between"><span class="muted">${mastered}/${total}</span><span class="muted">${pct}%</span></div></div>`;
  }

  h += `<div class="card"><div class="fw-6 mb-8">分类分布</div>`;
  h += `<div class="chart-wrap">`;
  CATS.forEach(cat => {
    const cnt = data.filter(p => p.category === cat).length;
    const pct2 = total > 0 ? Math.round(cnt / total * 100) : 0;
    h += `<div class="chart-row"><div class="chart-label">${cat}</div>`;
    h += `<div class="chart-track"><div class="chart-fill" style="width:${pct2}%;background:${CAT_COLORS[cat]}"></div></div>`;
    h += `<div class="chart-num">${cnt}</div></div>`;
  });
  h += `</div></div>`;

  h += `<div class="card"><div class="fw-6 mb-8">本周记录</div><div class="week-chart">`;
  const maxVal = Math.max(...weekData.map(d => d.c), 1);
  weekData.forEach(d => {
    const barH = Math.max(4, d.c / maxVal * 48);
    h += `<div class="week-bar"><div class="cnt">${d.c}</div><div class="bar" style="height:${barH}px;background:${d.c > 0 ? 'var(--primary)' : 'var(--border)'}"></div><div class="day">${weekDays[d.d.getDay()]}</div></div>`;
  });
  h += `</div></div>`;

  h += `<div class="card"><div class="fw-6 mb-8">最近添加</div>`;
  const recent = [...data].sort((a,b) => b.id - a.id).slice(0, 5);
  if (!recent.length) {
    h += `<div class="muted">还没有记录</div>`;
  } else {
    recent.forEach(p => {
      const stars = '★'.repeat(Math.min(p.mastery,5)) + '☆'.repeat(Math.max(5-p.mastery,0));
      h += `<div class="flex" style="justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">`;
      h += `<div><div class="fw-6" style="font-size:.8125rem">${esc(p.phrase)}</div><div class="muted" style="font-size:.6875rem">${esc(p.meaning)} · ${p.date}</div></div>`;
      h += `<div style="font-size:.6875rem;color:var(--warning)">${stars}</div></div>`;
    });
  }
  h += `</div>`;
  $('p-stats').innerHTML = h;
}

// ─── Helpers ───
function entryHTML(p, isSearch) {
  const badgeClass = CAT_CLASS[p.category] || 'badge-other';
  const stars = '★'.repeat(Math.min(p.mastery,5)) + '☆'.repeat(Math.max(5-p.mastery,0));
  const due = p.mastery < 5 && p.lastReview && (now() - p.lastReview) / 86400000 >= [0,1,2,4,7,14][Math.min(p.mastery,5)];
  let h = `<div class="entry" onclick="openModal('编辑词组',${p.id})">`;
  h += `<button class="entry-delete" onclick="deleteEntry(${p.id},event)">✕</button>`;
  h += `<div class="entry-phrase">${esc(p.phrase)} <span class="badge ${badgeClass}">${esc(p.category)}</span>${!p.lastReview && !isSearch ? '<span class="due-badge">新</span>' : ''}${due && !isSearch ? '<span class="due-badge">待复习</span>':''}</div>`;
  h += `<div class="entry-meaning">${esc(p.meaning)}</div>`;
  if (p.example) {
    h += `<div class="entry-example">${esc(p.example)}`;
    if (p.exampleCn) h += `<br><span class="muted">${esc(p.exampleCn)}</span>`;
    h += `</div>`;
  }
  h += `<div class="entry-footer"><span class="entry-date">📅 ${p.date}${p.source ? ' · 📌 '+esc(p.source) : ''}</span><span class="entry-stars">${stars}</span></div>`;
  h += `</div>`;
  return h;
}

function getWeekData() {
  const result = [];
  const nowD = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(nowD);
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().slice(0, 10);
    result.push({ d, c: data.filter(p => p.date === ds).length });
  }
  return result;
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  load();
  nav('today');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => nav(el.dataset.page));
  });

  // Close modals on bg click
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });
});
