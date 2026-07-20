// ─── 语块本 ───

const CATS = ['日常对话','商务英语','TED演讲','阅读','其他'];
const CAT_COLORS = { '日常对话':'#10B981', '商务英语':'#6366F1', 'TED演讲':'#F59E0B', '阅读':'#8B5CF6', '其他':'#94A3B8' };
const CAT_CLASS = { '日常对话':'badge-daily', '商务英语':'badge-biz', 'TED演讲':'badge-ted', '阅读':'badge-read', '其他':'badge-other' };
const KEY = 'phrasebook_data';
const VOCAB_KEY = 'phrasebook_vocab';

const $ = id => document.getElementById(id);
const esc = s => { if(!s) return ''; const d = document.createElement('div'); d.textContent = s; return d.innerHTML; };
const today = () => new Date().toISOString().slice(0,10);
const now = () => Date.now();
const dateCN = ds => { const d = new Date(ds); return (d.getMonth()+1)+'月'+d.getDate()+'日 星期'+['日','一','二','三','四','五','六'][d.getDay()]; };
const weekDays = ['日','一','二','三','四','五','六'];

// ─── State ───
let data = [];
let vocabData = [];
let page = 'today';

// ─── Vocab helpers (global) ───
function vocabLoad() {
  try { const raw = localStorage.getItem(VOCAB_KEY); if (raw) vocabData = JSON.parse(raw); } catch(e) {}
  if (!Array.isArray(vocabData)) vocabData = [];
}
function vocabSave() { localStorage.setItem(VOCAB_KEY, JSON.stringify(vocabData)); }
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
  closeAllModals();
  page = p;
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === p));
  document.querySelectorAll('.page').forEach(el => el.classList.remove('active'));
  const el = $('p-'+p); if (el) el.classList.add('active');
  window.scrollTo(0,0);
  
  // Update header title based on current page
  const titles = {today:'📝 语块本', bank:'📝 语料', review:'🔄 复习', vocab:'📖 生词本', stats:'📊 统计'};
  const h1 = document.querySelector('.header h1');
  if (h1 && titles[p]) h1.textContent = titles[p];
  
  if (p === 'today') renderToday();
  else if (p === 'bank') renderBank();
  else if (p === 'review') renderReview();
  else if (p === 'stats') renderStats();
  else if (p === 'vocab') renderVocab();
}

// ─── Modal ───
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(function(m) { m.style.display = ''; m.classList.remove('open'); });
}
function openModal(title, editId) {
  closeAllModals();
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
function closeModal() { var m = document.getElementById('modal'); if (m) { m.style.display = ''; m.classList.remove('open'); } }

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

function getDeletedIds() {
  try {
    var raw = localStorage.getItem("phrasebook_deleted");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (!parsed.phrases) parsed.phrases = {};
        if (!parsed.vocab) parsed.vocab = {};
        return parsed;
      }
    }
  } catch(e) {}
  return { phrases: {}, vocab: {} };
}


function getDeletedIds() {
  try {
    var raw = localStorage.getItem("phrasebook_deleted");
    if (raw) {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        if (!parsed.phrases) parsed.phrases = {};
        if (!parsed.vocab) parsed.vocab = {};
        return parsed;
      }
    }
  } catch(e) {}
  return { phrases: {}, vocab: {} };
}

function deleteEntry(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('删除这个词组？')) return;
  var delIds = getDeletedIds();
  delIds.phrases[id] = true;
  localStorage.setItem('phrasebook_deleted', JSON.stringify(delIds));
  data = data.filter(p => p.id !== id);
  save();
  nav(page);
}

// ─── Search ───

// ─── Voice Input ───
var _recognition = null;
var _recording = false;
var _currentTarget = null;

function startVoiceInput(btn){
  var targetId = btn.dataset.target;
  var lang = btn.dataset.lang || 'en-US';
  var hint = btn.dataset.hint || '语音输入';
  
  var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SpeechRecognition){
    showMicStatus(targetId, '语音识别不支持，请使用Chrome浏览器', 'error');
    return;
  }
  
  if(_recording){
    if(_currentTarget === targetId) {
      stopVoiceInput(targetId);
    }
    return;
  }
  
  try {
    _recognition = new SpeechRecognition();
    _recognition.lang = lang;
    _recognition.continuous = false;
    _recognition.interimResults = true;
    _recognition.maxAlternatives = 1;
    
    _recording = true;
    _currentTarget = targetId;
    
    btn.classList.add('recording');
    btn.textContent = '⏹';
    showMicStatus(targetId, '正在听...' + hint, 'listening');
    
    _recognition.onresult = function(e){
      for(var i=e.resultIndex; i<e.results.length; i++){
        if(e.results[i].isFinal){
          var finalText = e.results[i][0].transcript.trim();
          var input = document.getElementById(targetId);
          if(input) input.value = finalText;
          showMicStatus(targetId, '✅ 识别完成', 'done');
        }
      }
    };
    
    _recognition.onerror = function(e){
      showMicStatus(targetId, '识别出错: ' + e.error, 'error');
      stopVoiceInput(targetId);
    };
    
    _recognition.onend = function(){
      if(_recording) stopVoiceInput(_currentTarget);
    };
    
    _recognition.start();
  } catch(e){
    showMicStatus(targetId, '启动失败: ' + e.message, 'error');
    stopVoiceInput(targetId);
  }
}

function stopVoiceInput(targetId){
  _recording = false;
  _currentTarget = null;
  
  var btns = document.querySelectorAll('[data-target="' + targetId + '"]');
  btns.forEach(function(btn){
    btn.classList.remove('recording');
    btn.textContent = '🎤';
  });
  
  if(_recognition){
    try { _recognition.stop(); } catch(e) {}
    _recognition = null;
  }
  
  var el = document.getElementById('ms-' + targetId);
  if(el && el.textContent.indexOf('✅') < 0){
    showMicStatus(targetId, '已取消', '');
  }
}

function showMicStatus(targetId, msg, type){
  var el = document.getElementById('ms-' + targetId);
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
  var res = data.filter(function(p) {
    return p.phrase.toLowerCase().includes(q) ||
      p.meaning.includes(q) ||
      (p.example && p.example.toLowerCase().includes(q));
  });
  var vocabRes = vocabData.filter(function(v) {
    return v.word.toLowerCase().includes(q) ||
      v.meaning.includes(q);
  });
  var h = '';
  if (res.length) {
    h += '<div class="fw-6 mb-4" style="font-size:.8125rem;color:var(--muted)">📝 词组</div>';
    h += res.map(function(p) { return entryHTML(p, true); }).join('');
  }
  if (vocabRes.length) {
    h += '<div class="fw-6 mb-4 mt-8" style="font-size:.8125rem;color:var(--muted)">📖 生词</div>';
    vocabRes.forEach(function(v) {
      var stars = '\u2605'.repeat(Math.min(v.mastery||0,5)) + '\u2606'.repeat(Math.max(5-(v.mastery||0),0));
      h += '<div class="entry"><div class="entry-phrase">' + esc(v.word) + '</div>';
      h += '<div class="entry-meaning">' + esc(v.meaning) + '</div>';
      h += '<div class="entry-footer"><span class="entry-date">\ud83d\udcc5 ' + (v.date || '') + '</span><span class="entry-stars">' + stars + '</span></div></div>';
    });
  }
  if (!res.length && !vocabRes.length) {
    el.innerHTML = '<div class="empty-state" style="padding:20px"><div class="muted">无匹配</div></div>';
    return;
  }
  el.innerHTML = h;
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
  const mastered = data.filter(p => p.reviewCount > 0).length;
  const due = getDue().length;
  const deepMastery = data.filter(p => p.mastery >= 5).length;
  const weekData = getWeekData();

  let h = `<div class="stats-grid">`;
  h += `<div class="stat-card"><div class="num">${total}</div><div class="label">总词组</div></div>`;
  h += `<div class="stat-card"><div class="num">${todayAdd}</div><div class="label">今日新增</div></div>`;
  h += `<div class="stat-card"><div class="num">${mastered}</div><div class="label">已掌握</div></div>`;
  h += `<div class="stat-card"><div class="num">${due}</div><div class="label">待复习</div></div>`;
  h += `</div>`;

  if (total > 0) {
    const pct = Math.round(mastered / total * 100);
    const deepPct = Math.round(deepMastery / total * 100);
    h += `<div class="card"><div class="fw-6 mb-8">复习进度</div><div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>`;
    h += `<div class="flex" style="justify-content:space-between"><span class="muted">${mastered}/${total} 已复习</span><span class="muted">${pct}%</span></div>`;
    h += `<div class="flex" style="justify-content:space-between;margin-top:4px"><span class="muted">${deepMastery}/${total} 已掌握（5星）</span><span class="muted">${deepPct}%</span></div></div>`;
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

  h += renderCalendar();

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
  
  // Sync card
  h += '<div class="card">';
  h += '<div class="fw-6 mb-8">☁️ 云同步</div>';
  h += '<div style="font-size:.8125rem;color:var(--muted);margin-bottom:10px">一键备份词组和生词到云端，多设备共享数据</div>';
  h += '<button class="btn btn-primary btn-block" onclick="syncAll()">🔄 一键同步</button>';
  h += '</div>';
  
  $('p-stats').innerHTML = h;
}

// ─── Calendar ───
let calendarYear = new Date().getFullYear();
let calendarMonth = new Date().getMonth();
let calendarSelectedDate = '';
const MONTH_NAMES = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];

function renderCalendar() {
  const year = calendarYear;
  const month = calendarMonth;
  
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const todayStr = today();
  
  // Collect dates with entries for this month
  const datesWithEntries = {};
  data.forEach(function(p) {
    if (p.date && p.date.indexOf(year + '-' + String(month+1).padStart(2,'0')) === 0) {
      datesWithEntries[p.date] = (datesWithEntries[p.date] || 0) + 1;
    }
  });
  
  var h = '<div class="card" id="cal-card">';
  h += '<div class="cal-header">';
  h += '<button class="btn btn-sm btn-ghost" onclick="changeMonth(-1)">\u25c0</button>';
  h += '<span class="fw-6">' + year + '\u5e74 ' + MONTH_NAMES[month] + '</span>';
  h += '<button class="btn btn-sm btn-ghost" onclick="changeMonth(1)">\u25b6</button>';
  h += '</div>';
  h += '<div class="cal-grid">';
  
  // Day-of-week headers
  ['\u4e00','\u4e8c','\u4e09','\u56db','\u4e94','\u516d','\u65e5'].forEach(function(d) {
    h += '<div class="cal-dow">' + d + '</div>';
  });
  
  // Empty cells before first day
  var startOffset = firstDay.getDay() - 1;
  if (startOffset < 0) startOffset = 6;
  for (var i = 0; i < startOffset; i++) {
    h += '<div class="cal-cell cal-empty"></div>';
  }
  
  // Day cells
  for (var d = 1; d <= lastDay.getDate(); d++) {
    var dateStr = year + '-' + String(month+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
    var hasEntry = datesWithEntries[dateStr] > 0;
    var isToday = dateStr === todayStr;
    var isSelected = dateStr === calendarSelectedDate;
    
    var cls = 'cal-cell';
    if (isToday) cls += ' cal-today';
    if (isSelected) cls += ' cal-selected';
    if (hasEntry) cls += ' cal-has';
    
    h += '<div class="' + cls + '" data-date="' + dateStr + '" onclick="showDayEntries(\'' + dateStr + '\')">';
    h += '<span class="cal-num">' + d + '</span>';
    if (hasEntry) h += '<span class="cal-dot"></span>';
    h += '</div>';
  }
  
  h += '</div>'; // close cal-grid
  
  // Pre-render entries for selected date
  if (calendarSelectedDate && datesWithEntries[calendarSelectedDate]) {
    var dayItems = data.filter(function(p) { return p.date === calendarSelectedDate; });
    if (dayItems.length) {
      h += '<div class="cal-entries">';
      h += '<div class="fw-6 mb-4" style="font-size:.875rem">\ud83d\udcdd ' + calendarSelectedDate + '\uff08' + dayItems.length + ' \u6761\uff09</div>';
      dayItems.sort(function(a, b) { return b.id - a.id; });
      dayItems.forEach(function(p) {
        h += '<div class="entry" style="margin-bottom:6px;padding:10px 12px">';
        h += '<div class="entry-phrase">' + esc(p.phrase) + '</div>';
        h += '<div class="entry-meaning">' + esc(p.meaning) + '</div>';
        if (p.category) h += '<span class="badge ' + (CAT_CLASS[p.category] || 'badge-other') + '" style="font-size:.6875rem;margin-top:4px">' + p.category + '</span>';
        h += '</div>';
      });
      h += '</div>';
    }
  } else {
    h += '<div class="muted tc" style="padding:12px 0 4px;font-size:.75rem">\u70b9\u51fb\u65e5\u671f\u67e5\u770b\u5f53\u5929\u8bb0\u5f55</div>';
  }
  
  h += '</div>'; // close card
  return h;
}

function changeMonth(delta) {
  calendarMonth += delta;
  if (calendarMonth > 11) { calendarMonth = 0; calendarYear++; }
  if (calendarMonth < 0) { calendarMonth = 11; calendarYear--; }
  nav(page);
}

function showDayEntries(dateStr) {
  if (calendarSelectedDate === dateStr) {
    calendarSelectedDate = ''; // toggle off
  } else {
    calendarSelectedDate = dateStr;
  }
  nav(page);
}

// ─── Vocab (生词本) ───
function renderVocab() {
  var h = '';
  h += `<!-- 添加按钮 --><div class="action-bar"><button class="btn btn-primary" onclick="openVocabModal()">➕ 添加生词</button></div>`;
  h += `<div class="muted" style="font-size:.8125rem;margin-bottom:10px">共 ${vocabData.length} 个生词</div>`;
  if (!vocabData.length) {
    h += `<div class="empty-state"><div class="icon">📖</div><div class="title">还没有生词</div><div class="desc">点击"添加生词"开始记录</div></div>`;
  } else {
    const sorted = [...vocabData].sort((a,b) => b.id - a.id);
    sorted.forEach(v => { h += vocabEntryHTML(v); });
  }
  $('p-vocab').innerHTML = h;
}

function vocabEntryHTML(v) {
  const stars = '★'.repeat(Math.min(v.mastery,5)) + '☆'.repeat(Math.max(5-v.mastery,0));
  var h = `<div class="entry">`;
  h += `<button class="entry-delete" onclick="vocabDeleteEntry(${v.id},event)">✕</button>`;
  h += `<div class="entry-phrase">${esc(v.word)}</div>`;
  h += `<div class="entry-meaning">${esc(v.meaning)}</div>`;
  h += `<div class="entry-footer"><span class="entry-date">📅 ${v.date}</span><span class="entry-stars">${stars}</span></div>`;
  h += `</div>`;
  return h;
}

function vocabDeleteEntry(id, e) {
  if (e) e.stopPropagation();
  if (!confirm('删除这个生词？')) return;
  var delIds = getDeletedIds();
  delIds.vocab[id] = true;
  localStorage.setItem('phrasebook_deleted', JSON.stringify(delIds));
  showSyncToast('🗑 已记录删除: ' + JSON.stringify(delIds), false);
  vocabData = vocabData.filter(v => v.id !== id);
  vocabSave();
  renderVocab();
}

function openVocabModal(editId) {
  closeAllModals();
  var title = document.getElementById('vocab-modal-title');
  if (title) title.textContent = editId ? '编辑生词' : '添加生词';
  document.getElementById('vocab-edit-id').value = editId || '';
  if (editId) {
    var v = vocabData.find(function(x) { return x.id === parseInt(editId); });
    if (v) {
      document.getElementById('vf-word').value = v.word;
      document.getElementById('vf-meaning').value = v.meaning;
    }
  } else {
    document.getElementById('vf-word').value = '';
    document.getElementById('vf-meaning').value = '';
  }
  var vm = document.getElementById('vocab-modal');
  if (vm) {
    vm.classList.add('open');
    setTimeout(function() { var t = document.getElementById('vf-word'); if(t) t.focus(); }, 300);
  }
}

function closeVocabModal() { var m = document.getElementById('vocab-modal'); if (m) { m.style.display = ''; m.classList.remove('open'); } }

function saveVocabEntry(e) {
  e.preventDefault();
  const id = $('vocab-edit-id').value;
  const word = $('vf-word').value.trim();
  const meaning = $('vf-meaning').value.trim();
  if (!word || !meaning) return false;

  if (id) {
    const v = vocabData.find(x => x.id === parseInt(id));
    if (v) { v.word = word; v.meaning = meaning; }
  } else {
    vocabData.unshift({ id: now(), word: word, meaning: meaning, date: today(), mastery: 0, reviewCount: 0, lastReview: null });
  }
  vocabSave();
  closeVocabModal();
  renderVocab();
  return false;
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


// ─── Sync ───
const SYNC_REPO = 'jingaven94-byte/phrase-book';
const SYNC_BRANCH = 'main';
const SYNC_PATH = 'data/phrasebook-backup.json';

// Get saved sync config
function getSyncConfig() {
  try {
    var raw = localStorage.getItem('phrasebook_sync');
    return raw ? JSON.parse(raw) : null;
  } catch(e) { return null; }
}

function saveSyncConfig(cfg) {
  localStorage.setItem('phrasebook_sync', JSON.stringify(cfg));
}

// Show a toast notification at the top
function showSyncToast(msg, isOk) {
  var el = $('sync-toast');
  if(!el) return;
  el.textContent = msg;
  el.style.background = isOk ? 'var(--success)' : 'var(--danger)';
  el.style.color = '#fff';
  el.style.opacity = '1';
  el.style.transform = 'translateX(-50%) translateY(0)';
  clearTimeout(el._hide);
  el._hide = setTimeout(function() {
    el.style.opacity = '0';
    el.style.transform = 'translateX(-50%) translateY(-20px)';
  }, 2500);
}



// Helper: upload data to repo, auto-fetch sha if needed
function syncUploadToRepo(token, message) {
  return new Promise(function(resolve, reject) {
    var url = 'https://api.github.com/repos/' + SYNC_REPO + '/contents/' + SYNC_PATH;
    
    // Step 1: GET latest remote data + SHA (API, no CDN cache)
    fetch(url, {
      cache: 'no-cache',
      headers: {
        'Authorization': 'token ' + token,
        'Accept': 'application/vnd.github.v3+json'
      }
    })
    .then(function(r) {
      if (r.status === 404) return { fileInfo: null, remoteData: null };
      if (!r.ok) return r.json().then(function(e) { throw new Error(e.message || 'HTTP ' + r.status); });
      return r.json().then(function(fileInfo) {
        var remoteData = null;
        if (fileInfo && fileInfo.content) {
          try {
            var raw = atob(fileInfo.content);
            var jsonStr = decodeURIComponent(escape(raw));
            remoteData = JSON.parse(jsonStr);
          } catch(e) { remoteData = null; }
        }
        return { fileInfo: fileInfo, remoteData: remoteData };
      });
    })
    .then(function(result) {
      var fileInfo = result.fileInfo;
      var remoteData = result.remoteData;
      
      // Step 2: merge remote + local
      var mergedPhrases = [];
      var seenPhraseIds = {};
      var mergedVocab = [];
      var seenVocabIds = {};
      
      function addItem(id, item, target, seen, mergeKey) {
        if (!seen[id]) {
          seen[id] = true;
          target.push(item);
        } else {
          var existing = target.find(function(x) { return x.id === id; });
          if (existing && (item[mergeKey] || 0) > (existing[mergeKey] || 0)) {
            Object.assign(existing, item);
          }
        }
      }
      
      // Remote items first, then local items (for dedup keep higher mastery)
      if (remoteData && remoteData.phrases) {
        remoteData.phrases.sort(function(a, b) { return b.id - a.id; });
        remoteData.phrases.forEach(function(p) { addItem(p.id, p, mergedPhrases, seenPhraseIds, 'mastery'); });
      }
      data.forEach(function(p) { addItem(p.id, p, mergedPhrases, seenPhraseIds, 'mastery'); });
      
      if (remoteData && remoteData.vocab) {
        remoteData.vocab.sort(function(a, b) { return b.id - a.id; });
        remoteData.vocab.forEach(function(v) { addItem(v.id, v, mergedVocab, seenVocabIds, 'mastery'); });
      }
      vocabData.forEach(function(v) { addItem(v.id, v, mergedVocab, seenVocabIds, 'mastery'); });
      
      mergedPhrases.sort(function(a, b) { return b.id - a.id; });
      mergedVocab.sort(function(a, b) { return b.id - a.id; });
      var delIds = (remoteData && remoteData.deletedIds) ? JSON.parse(JSON.stringify(remoteData.deletedIds)) : { phrases: {}, vocab: {} };
      var localDelIds = getDeletedIds();
      for (var id in localDelIds.phrases) { if (!delIds.phrases) delIds.phrases = {}; delIds.phrases[id] = true; }
      for (var id in localDelIds.vocab) { if (!delIds.vocab) delIds.vocab = {}; delIds.vocab[id] = true; }
      localStorage.setItem("phrasebook_deleted", JSON.stringify(delIds));
      mergedPhrases = mergedPhrases.filter(function(p) { return !(delIds.phrases && delIds.phrases[p.id]); });
      mergedVocab = mergedVocab.filter(function(v) { return !(delIds.vocab && delIds.vocab[v.id]); });

      // Filter out deleted items (sync deletion across devices)
      var delIds = (remoteData && remoteData.deletedIds) ? JSON.parse(JSON.stringify(remoteData.deletedIds)) : { phrases: {}, vocab: {} };
      var localDelIds = getDeletedIds();
      for (var id in localDelIds.phrases) { if (!delIds.phrases) delIds.phrases = {}; delIds.phrases[id] = true; }
      for (var id in localDelIds.vocab) { if (!delIds.vocab) delIds.vocab = {}; delIds.vocab[id] = true; }
      localStorage.setItem('phrasebook_deleted', JSON.stringify(delIds));
      mergedPhrases = mergedPhrases.filter(function(p) { return !(delIds.phrases && delIds.phrases[p.id]); });
      mergedVocab = mergedVocab.filter(function(v) { return !(delIds.vocab && delIds.vocab[v.id]); });
      
      // Step 3: PUT merged data
      var uploadContent = JSON.stringify({
        phrases: mergedPhrases,
        vocab: mergedVocab,
        deletedIds: delIds,
        updatedAt: new Date().toISOString()
      });
      
      var body = {
        message: message || 'sync phrasebook data',
        content: btoa(unescape(encodeURIComponent(uploadContent))),
        branch: SYNC_BRANCH
      };
      if (fileInfo && fileInfo.sha) body.sha = fileInfo.sha;
      
      return fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': 'token ' + token,
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify(body)
      })
      .then(function(r) {
        if (!r.ok) return r.json().then(function(e) { throw new Error(e.message || 'HTTP ' + r.status); });
        return r.json();
      })
      .then(function(putResult) {
        var newSha = putResult.content ? putResult.content.sha : '';
        return { newSha: newSha, mergedPhrases: mergedPhrases, mergedVocab: mergedVocab };
      });
    })
    .then(function(result) {
      resolve(result);
    })
    .catch(function(e) {
      reject(e);
    });
  });
}

// Main sync button handler: one-click sync all
function syncAll() {
  closeAllModals();
  var cfg = getSyncConfig();
  
  if(!cfg || !cfg.token) {
    openSyncSettings();
    return;
  }
  
  // Show deletion tracking data before sync
  var _delRaw = localStorage.getItem('phrasebook_deleted');
  var _delStr = _delRaw || '(空)';
  showSyncToast('🔍 删除追踪: ' + _delStr, false);
  
  var _self = this;
  setTimeout(function() {
    showSyncToast('🔄 双向同步中...', false);
    syncUploadToRepo(cfg.token, 'sync phrasebook data')
      .then(function(result) {
        data = result.mergedPhrases;
        vocabData = result.mergedVocab;
        save();
        vocabSave();
        saveSyncConfig({ token: cfg.token, fileSha: result.newSha });
        showSyncToast('✅ 同步完成！词组' + data.length + ' · 生词' + vocabData.length, true);
        nav(page);
      })
      .catch(function(e) {
        showSyncToast('❌ 同步失败: ' + e.message, false);
      });
  }, 2000);
}

function setupSync
function setupSync
function setupSync() {
  var token = $('sync-token').value.trim();
  if(!token) {
    $('sync-status-msg').textContent = '请输入 GitHub Token';
    $('sync-status-msg').style.color = 'var(--danger)';
    return;
  }
  
  $('sync-status-msg').textContent = '同步中...';
  $('sync-status-msg').style.color = 'var(--text2)';
  
  syncUploadToRepo(token, 'init phrasebook sync')
    .then(function(result) {
      data = result.mergedPhrases;
      vocabData = result.mergedVocab;
      save();
      vocabSave();
      saveSyncConfig({ token: token, fileSha: result.newSha });
      $('sync-status-msg').textContent = '✅ 设置完成！数据已同步';
      $('sync-status-msg').style.color = 'var(--success)';
      setTimeout(closeSyncModal, 1500);
    })
    .catch(function(e) {
      $('sync-status-msg').textContent = '❌ 设置失败: ' + e.message;
      $('sync-status-msg').style.color = 'var(--danger)';
    });
}

function closeSyncModal() {
  closeAllModals();
  $('sync-token').value = '';
  $('sync-status-msg').textContent = '';
}

function openSyncSettings() {
  var cfg = getSyncConfig();
  if(cfg && cfg.token) $('sync-token').value = cfg.token;
  var ms = document.getElementById('modal-sync');
  if (ms) {
    ms.style.display = 'block';
    ms.classList.add('open');
  }
  $('sync-status-msg').textContent = '';
  setTimeout(function() { var t = $('sync-token'); if(t) t.focus(); }, 300);
}

// Also sync from cloud: pull latest data
function syncPull() {
  var cfg = getSyncConfig();
  if(!cfg || !cfg.token) {
    showSyncToast('请先点击🔄设置同步', false);
    return;
  }
  
  showSyncToast('📥 下载中...', false);
  fetch('https://raw.githubusercontent.com/' + SYNC_REPO + '/' + SYNC_BRANCH + '/' + SYNC_PATH, {
    cache: 'no-cache'
  })
  .then(function(r) {
    if(!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  })
  .then(function(remote) {
    if(remote.phrases) { data = remote.phrases; save(); }
    if(remote.vocab) { vocabData = remote.vocab; vocabSave(); }
    showSyncToast('✅ 已下载 ' + data.length + ' 词组 · ' + vocabData.length + ' 生词', true);
    nav(page);
  })
  .catch(function(e) {
    showSyncToast('❌ 下载失败: ' + e.message, false);
  });
}

// ─── Init ───
document.addEventListener('DOMContentLoaded', () => {
  load();
  vocabLoad();
  nav('today');

  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => nav(el.dataset.page));
  });

  // Close modals on bg click
  document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', e => { if (e.target === m) m.classList.remove('open'); });
  });
});
