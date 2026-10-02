(function () {
  'use strict';
  const C = StudyCore, D = StudyContent, KEY = 'youyan.study.v1';
  const aiLabs={regression:StudyAI,digits:StudyDigits,metrics:StudyMetrics};
  const $ = selector => document.querySelector(selector);
  const h = value => String(value ?? '').replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const uid = () => typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const icons = {
    today: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    logic: '<path d="M4 4h16v16H4zM4 10h16M4 15h16M10 4v16M15 4v16"/>',
    ai: '<path d="M3 20h18M4 20V4M6 16l5-6 4 2 5-8"/><circle cx="11" cy="10" r="1.5"/><circle cx="15" cy="12" r="1.5"/>',
    review: '<path d="M3 6h7l2 2 2-2h7v14h-7l-2 2-2-2H3zM12 8v14M6 10h3M15 10h3M6 14h3M15 14h3"/>',
    materials: '<path d="M5 3h10l4 4v14H5zM15 3v5h4M8 12h8M8 16h6"/>',
    data: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 4 16 4 16 0V5M4 12v7c0 4 16 4 16 0v-7"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v6l4 2"/>',
    check: '<path d="M5 12l4 4L20 5"/><path d="M20 12v8H4V4h9"/>',
    trash: '<path d="M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7"/>',
    edit: '<path d="M15 4l5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    export: '<path d="M12 3v12M7 10l5 5 5-5M4 15v6h16v-6"/>'
  };
  const icon = name => `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${icons[name] || icons.today}</svg>`;
  const pages = [['today','今日学习'],['logic','教材学习'],['ai','AI 专业学习'],['logic-tools','计算工具'],['review','复习与错题'],['materials','综测记录台'],['data','数据与使用说明']];
  let state = C.initialState(), damagedBackup = null, recoverySecured = false, toastTimeout, exportFile = '学习笔记.md', confirmCallback;
  let ui = { route: 'today', aiMode: 'regression', taskFilter: 'pending', taskCourse: '', reviewMode: 'review', reviewTopic: '', reviewId: null, revealed: false, practiceIndex: 0, choice: null, practiceCorrect: 0, practiceAnswered: 0, showLibrary: false, cardSearch: '', target: 150, counting: 'total', focusTopic: '' };
  let logic = { n: 4, ones: '0, 2, 8, 10', dc: '', result: C.minimize(4,[0,2,8,10]), selected: -1, hint: '先试着判断四角中哪两个变量不变，再查看分组。', error: '' };
  function toast(message) { $('#toast').textContent = message; $('#toast').hidden = false; clearTimeout(toastTimeout); toastTimeout = setTimeout(() => $('#toast').hidden = true, 4500); }
  function alertStorage(message) { const el = $('#storage-alert'); el.textContent = message; el.hidden = false; }
  function readState(raw){
    const data=C.validateState(JSON.parse(raw.replace(/^\uFEFF/,''))),builtInIds=new Set(D.cards.map(card=>card.id));
    if(data.cards.some(card=>builtInIds.has(card.id)))throw new Error('自建卡ID与基础卡冲突。');
    const knownIds=new Set([...builtInIds,...data.cards.map(card=>card.id)]);
    if(Object.keys(data.reviews).some(id=>!knownIds.has(id)))throw new Error('复习进度引用了不存在的知识卡。');
    return data;
  }
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      try { state = readState(raw); }
      catch { damagedBackup = raw; try { localStorage.setItem(KEY + '.recovery', raw); recoverySecured = true; } catch {} alertStorage('发现无法读取的旧数据，已保留原文。请在「数据与使用说明」下载恢复文件；当前暂用空白工作台。'); }
    }
    const recovery=localStorage.getItem(KEY + '.recovery');damagedBackup = damagedBackup || recovery;recoverySecured=recoverySecured || Boolean(recovery && recovery===damagedBackup);
  } catch { alertStorage('浏览器阻止了本地存储。当前操作仅保留在此页面，关闭前请导出 JSON 备份。'); }
  function save() {
    if(damagedBackup && !recoverySecured){alertStorage('异常原数据的安全副本未能写入，当前修改只留在页面中，不会覆盖原记录。请先下载异常数据原文，并导出当前JSON；保存两份文件后再清理浏览器数据并导入当前JSON。');return false;}
    try { localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch { alertStorage('本地保存失败，可能是存储已满或被禁用。当前修改仍在页面中，请立即导出 JSON，关闭页面将丢失未保存内容。'); return false; }
  }
  function confirmAction(title, message, action, label = '确认') {
    $('#confirm-title').textContent = title; $('#confirm-message').textContent = message; $('#confirm-action').textContent = label; confirmCallback = action; $('#confirm-dialog').showModal();
  }
  const editing = { task: null, card: null, experience: null };
  function openForm(id, record = null) {
    const form = $(`#${id}-form`); form.reset(); editing[id] = record?.id || null;
    if(record)for(const el of form.elements)if(el.name && Object.hasOwn(record,el.name))el.value=record[el.name];
    const titles={task:'学习任务',card:'错题卡',experience:'经历'};
    form.querySelector('h2').textContent=(record?'编辑':'记录')+titles[id];
    form.querySelector('.form-error').textContent = ''; $(`#${id}-dialog`).showModal();
  }
  function download(text, filename, type = 'text/plain;charset=utf-8') {
    const url = URL.createObjectURL(new Blob([text], { type })), a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function backup() { download(JSON.stringify({...state, exportedAt: new Date().toISOString()}, null, 2), `邮研备份-${C.dateKey()}-${Date.now()}.json`, 'application/json'); }
  function showText(title, text, file) { $('#text-title').textContent = title; $('#export-text').value = text; exportFile = file; $('#text-dialog').showModal(); }
  async function copyText(text) {
    try { await navigator.clipboard.writeText(text); toast('已复制到剪贴板'); }
    catch { if(!$('#text-dialog').open)showText('复制内容', text, '学习笔记.md');const box=$('#export-text');box.focus();box.select();toast('浏览器未允许自动复制，文字已选中，请按 Ctrl+C。'); }
  }
  const cards = () => [...D.cards, ...state.cards];
  const courseNames=()=>[...new Set([...D.courses,...state.tasks.map(t=>t.course),...state.cards.map(c=>c.topic)])].filter(Boolean);
  function updateCourseSelects(){
    for(const select of document.querySelectorAll('.course-select')){
      const value=select.value,initialized=select.options.length>0,names=[...new Set([...courseNames(),value])].filter(Boolean);
      select.innerHTML=names.map(name=>`<option value="${h(name)}">${h(name)}</option>`).join('')+'<option value="">未指定方向</option>';
      if(initialized)select.value=value;
    }
  }
  const dueCards = () => cards().filter(x => (!ui.reviewTopic || x.topic === ui.reviewTopic) && (!state.reviews[x.id] || state.reviews[x.id].dueAt <= Date.now())).sort((a,b) => (state.reviews[a.id]?.dueAt || Infinity) - (state.reviews[b.id]?.dueAt || Infinity));
  const fmtDate = x => x ? x.slice(5).replace('-', '/') : '无截止日期';
  const fmtTime = timestamp => new Date(timestamp).toLocaleString('zh-CN', { month:'numeric',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false });
  const remaining = () => state.timer ? state.timer.status === 'running' ? Math.min(state.timer.remainingSeconds,Math.max(0, Math.ceil((state.timer.endsAt - Date.now()) / 1000))) : state.timer.remainingSeconds : state.settings.focusMinutes * 60;
  const formatTimer = seconds => `${String(Math.floor(seconds / 60)).padStart(2,'0')}:${String(seconds % 60).padStart(2,'0')}`;
  const dailyMinutes = key => state.sessions.filter(s => C.dateKey(new Date(s.endedAt)) === key).reduce((n,s) => n + s.minutes,0);
  function heading(eyebrow, title, subtitle, action = '') { return `<div class="page-heading"><div><span class="eyebrow">${eyebrow}</span><h1>${title}</h1><p>${subtitle}</p></div>${action}</div>`; }
  function panelHeader(title, note = '', extra = '', symbol = '') { return `<div class="panel-header"><div><h2 class="panel-title">${symbol ? icon(symbol) : ''}${title}</h2>${note ? `<p>${note}</p>` : ''}</div>${extra}</div>`; }
  function taskRows(items) {
    if (!items.length) return `<div class="empty"><div class="empty-symbol">▤</div><h3>${ui.taskFilter === 'done' ? '还没有完成的任务' : ui.taskFilter === 'all' ? '把下一步写下来' : '当前筛选下没有待办'}</h3><p>不用写一整学期的计划。先记录今天能独立完成的一件事。</p><button class="button" data-action="add-task">${icon('plus')}添加任务</button></div>`;
    return `<div class="task-list">${items.map(t => `<div class="task-row ${t.done ? 'done' : ''}"><input type="checkbox" data-task="${h(t.id)}" ${t.done ? 'checked' : ''} aria-label="${h(t.done ? '标记为未完成：' : '完成任务：')}${h(t.title)}"><div class="task-info"><div class="task-title">${h(t.title)}</div><div class="task-meta"><span class="pill">${h(t.course || '其他')}</span><span class="${!t.done && t.due && t.due < C.dateKey() ? 'overdue' : ''}">${t.due && t.due < C.dateKey() && !t.done ? '已逾期 · ' : ''}${h(fmtDate(t.due))}</span>${t.priority === 'high' ? '<span class="pill orange">优先完成</span>' : ''}</div></div><button class="icon-button" data-action="delete-task" data-id="${h(t.id)}" aria-label="删除任务：${h(t.title)}">${icon('trash')}</button></div>`).join('')}</div>`;
  }
  function todayView() {
    const today = C.dateKey(), pending = state.tasks.filter(t=>!t.done), done = state.tasks.filter(t=>t.done).length, reviewed = Object.values(state.reviews).filter(x=>C.dateKey(new Date(x.lastAt))===today).length;
    const due = cards().filter(x=>state.reviews[x.id] && state.reviews[x.id].dueAt<=Date.now()).length, fresh = cards().filter(x=>!state.reviews[x.id]).length;
    const tasks = state.tasks.filter(t => (ui.taskFilter==='all' || (ui.taskFilter==='done')===t.done) && (!ui.taskCourse || t.course===ui.taskCourse)).sort((a,b)=>({high:0,normal:1,low:2}[a.priority]-{high:0,normal:1,low:2}[b.priority]) || (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt-b.createdAt);
    const week = Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-6+i);return {key:C.dateKey(d),label:['日','一','二','三','四','五','六'][d.getDay()],minutes:dailyMinutes(C.dateKey(d))};}), max = Math.max(60,...week.map(x=>x.minutes));
    const candidate = cards().find(x=>state.reviews[x.id]?.dueAt<=Date.now()) || cards().find(x=>!state.reviews[x.id]) || cards()[0];
    return heading('MAKE ROOM FOR UNDERSTANDING','今天，从一件小事开始。','把待办变成行动，把答案变成自己的理解。') +
      `<div class="stats">${[
        ['待完成任务',pending.length,'项',pending.some(t=>t.due && t.due<today) ? `${pending.filter(t=>t.due && t.due<today).length} 项已逾期` : '按优先级安排下一步','check'],
        ['今日专注',dailyMinutes(today),'分钟','仅记录完成的计时','clock'],
        ['需要复习',due,'张',`${fresh} 张知识卡尚未学习`,'review'],
        ['今日已复习',reviewed,'张','先回答，再查看答案','today']
      ].map(([title,value,unit,note,symbol])=>`<div class="stat"><div class="stat-top">${title}<span class="stat-icon">${icon(symbol)}</span></div><div class="stat-value">${value}<span>${unit}</span></div><div class="stat-note">${note}</div></div>`).join('')}</div>
      <div class="layout-two"><div class="stack"><section class="panel">${panelHeader('学习任务','先做最重要的一项，再安排下一项。',`<button class="text-link" data-action="add-task">＋ 添加</button>`)}<div class="panel-body"><div class="filter-bar"><div class="segmented" aria-label="任务状态">${[['pending','待完成'],['all','全部'],['done','已完成']].map(([k,t])=>`<button data-action="task-filter" data-filter="${k}" class="${ui.taskFilter===k?'active':''}" aria-pressed="${ui.taskFilter===k}">${t}</button>`).join('')}</div><label class="sr-only" for="task-course">课程筛选</label><select id="task-course"><option value="">全部方向</option>${courseNames().map(c=>`<option value="${h(c)}" ${ui.taskCourse===c?'selected':''}>${h(c)}</option>`).join('')}</select></div>${taskRows(tasks)}${state.tasks.length?`<div class="task-progress" role="progressbar" aria-label="任务完成比例" aria-valuemin="0" aria-valuemax="${state.tasks.length}" aria-valuenow="${done}"><div style="width:${done/state.tasks.length*100}%"></div></div>`:''}</div><div class="panel-foot"><span>${done} / ${state.tasks.length} 项已完成</span><span>一步一步来</span></div></section>
      <section class="panel">${panelHeader('今日回忆','合上笔记，试着用自己的话回答。',`<span class="pill blue">${h(candidate.topic)}</span>`)}<div class="panel-body"><div class="mini-card"><span class="eyebrow">QUESTION OF THE DAY</span><p>${h(candidate.question)}</p></div><button class="button" data-action="start-review" data-id="${h(candidate.id)}">开始回忆练习</button></div></section></div>
      <div class="stack overview-right"><section class="panel focus-panel">${panelHeader('留一段时间给专注','只关注手上的这一件事。',`<span class="pill">专注计时</span>`,'clock')}<div class="panel-body"><div class="timer-display"><div class="timer-digits" id="timer-digits">${formatTimer(remaining())}</div><div class="timer-label" id="timer-label">${state.timer?.status==='paused'?'已暂停':state.timer?'专注进行中':'准备开始一个学习片段'}</div></div><div class="form-row"><label>这次专注的内容<input id="focus-topic" maxlength="300" placeholder="例如：卡诺图练习" value="${h(state.timer?.topic || ui.focusTopic)}" ${state.timer?'disabled':''}></label><label>分钟<input id="focus-minutes" type="number" min="1" max="180" value="${state.timer?.minutes || state.settings.focusMinutes}" ${state.timer?'disabled':''}></label></div><div class="timer-actions">${state.timer ? `<button class="button primary" data-action="${state.timer.status==='paused'?'resume-focus':'pause-focus'}">${state.timer.status==='paused'?'继续专注':'暂停'}</button><button class="button" data-action="cancel-focus">结束</button>` : '<button class="button primary" data-action="start-focus">开始专注</button>'}</div><p class="timer-state">${state.timer?'刷新后可恢复；完成时自动记入记录。':'完成后自动记录时长，中途结束不计入。'}</p></div></section>
      <section class="tool-shortcut"><span class="tool-symbol" aria-hidden="true">Σm</span><div><h3>卡诺图，不只看答案。</h3><p>看清每个分组，核验每一行真值。</p><a class="text-link" href="#logic-tools">打开计算工具</a></div></section>
      <section class="panel">${panelHeader('最近 7 天','给学习留下一点可见的积累。',`<span class="pill">分钟</span>`)}<div class="panel-body"><div class="week-chart" role="img" aria-label="${h(week.map(x=>`${x.key}：${x.minutes}分钟`).join('；'))}">${week.map((x,i)=>`<div class="bar-column ${i===6?'today':''}" title="${x.key} · ${x.minutes} 分钟"><div class="bar-track"><div class="bar-fill" style="height:${Math.max(3,x.minutes/max*100)}%"></div></div><span>${i===6?'今天':x.label}</span></div>`).join('')}</div><p class="weekly-total">近7天累计 <strong>${week.reduce((s,x)=>s+x.minutes,0)}</strong> 分钟 · ${state.sessions.filter(s=>week.some(d=>d.key===C.dateKey(new Date(s.endedAt)))).length} 个学习片段</p></div></section></div></div>`;
  }
  function logicView() {
    return heading('DIGITAL LOGIC LAB','数字逻辑实验室','从最小项到分组，再到经真值验证的最简与或式。',`<span class="pill blue">2–4 变量 · 离线计算</span>`) + `<div class="logic-layout"><section class="panel logic-controls">${panelHeader('定义逻辑函数','变量 A 为最高位。')}<div class="panel-body"><label>变量个数<select id="logic-n">${[2,3,4].map(n=>`<option value="${n}" ${n===logic.n?'selected':''}>${n} 个变量 · ${'ABCD'.slice(0,n)}</option>`).join('')}</select></label><label>最小项 m<input id="logic-ones" value="${h(logic.ones)}" placeholder="例如：0, 2, 8, 10" inputmode="text" aria-describedby="logic-hint"></label><label>无关项 d（可留空）<input id="logic-dc" value="${h(logic.dc)}" placeholder="例如：5, 6" aria-describedby="logic-hint"></label><p class="hint" id="logic-hint">输入 0–${2**logic.n-1} 的编号，用逗号或空格分隔。两个集合不能重叠。</p><button class="button primary" data-action="solve-logic">化简并验证</button><p id="logic-error" class="error-message" role="alert">${h(logic.error)}</p><h3 class="section-gap">试一个示例</h3><div class="examples">${D.examples.map((e,i)=>`<button class="example-button" data-action="logic-example" data-index="${i}">${h(e.title)}</button>`).join('')}</div><div class="notes-callout"><strong>分组规则</strong><br>格数取 1、2、4、8、16；允许首尾相邻和重叠；不包含 0；覆盖全部 1。<br><br>点击格子循环切换 0 → 1 → ×。点击分组查看高亮。</div><p class="source-note">示例用于学习演示，不代表教材原题。</p></div></section><section class="panel" id="logic-result">${logicResult()}</section></div>`;
  }
  const groupColors = ['#245cd8','#ab5919','#007b70','#914bc2','#b53b66','#45754f','#6655b5','#466881'];
  function logicResult() {
    const r=logic.result, map=C.kmap(r.n);
    return panelHeader('化简结果',h(logic.hint),`<span class="pill green">${r.verified?'真值验证通过':'验证失败'}</span>`) + `<div class="panel-body"><div class="formula-result"><span class="eyebrow">MINIMAL SUM OF PRODUCTS</span><div class="formula">F = ${h(r.expression)}</div><div class="result-stats"><span>${r.selected.length} 个乘积项</span><span>·</span><span>${r.literals} 个文字</span><span>·</span><span>${r.ones.length} 个最小项 / ${r.dontCares.length} 个无关项</span></div></div><div class="kmap-wrapper"><table class="kmap" aria-label="${r.n}变量卡诺图"><thead><tr><th scope="col">${map.rowLabel} \ ${map.colLabel}</th>${map.cols.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${map.cells.map((row,ri)=>`<tr><th scope="row">${map.rows[ri]}</th>${row.map(i=>{
      const value=r.dontCares.includes(i)?'×':r.ones.includes(i)?'1':'0', groups=r.selected.map((g,k)=>g.cells.includes(i)?k:-1).filter(k=>k>=0), active=logic.selected>=0;
      return `<td class="${value==='1'?'one':value==='×'?'dc':''} ${active?(groups.includes(logic.selected)?'highlight':'dim'):''}" ${active?`style="--group-color:${groupColors[logic.selected%8]}"`:''}><button class="kmap-cell" data-action="logic-cell" data-index="${i}" aria-label="m${i}，当前值${value}，点击切换"><span class="cell-index">m${i}</span><span class="cell-value">${value}</span><span class="cell-groups">${groups.map(k=>`<span class="group-dot" style="--group-color:${groupColors[k%8]}25">${k+1}</span>`).join('')}</span></button></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div><div class="kmap-legend"><span>1 · 最小项</span><span>× · 无关项</span><span>角标数字 · 所属分组</span></div><div class="group-list">${r.selected.map((g,i)=>`<button class="group-item ${logic.selected===i?'selected':''}" style="--group-color:${groupColors[i%8]}" data-action="logic-group" data-index="${i}" aria-pressed="${logic.selected===i}"><span class="group-number">${i+1}</span><span><strong>${h(g.text)}</strong><small>覆盖 m(${g.cells.join(', ')})<br>${g.cells.length} 格 · 消去 ${r.n-g.literals} 个变量</small></span></button>`).join('') || '<p class="muted">没有实际最小项，取 F = 0。</p>'}</div><div class="result-actions"><button class="button primary" data-action="logic-markdown">${icon('export')}导出 Markdown 过程</button><button class="button" data-action="logic-copy">复制表达式</button><button class="button" data-action="logic-to-card">保存为练习卡</button><button class="button ghost" data-action="logic-print">打印 / PDF</button></div><div class="verification"><details><summary>展开 ${2**r.n} 行真值验证</summary><div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">编号</th><th scope="col">${'ABCD'.slice(0,r.n)}</th><th scope="col">题目要求</th><th scope="col">化简输出</th><th scope="col">验证</th></tr></thead><tbody>${r.table.map(x=>`<tr><td>m${x.value}</td><td><code>${x.bits}</code></td><td>${x.expected}</td><td>${x.actual}</td><td>${x.expected==='×'?'不约束':x.actual===x.expected?'一致':'不一致'}</td></tr>`).join('')}</tbody></table></div></details><p class="source-note">先最少乘积项，再最少文字数。结果是一个最优解；等价最简式可能不唯一。单个变量取反用 ' 表示，· 表示与，+ 表示或。</p></div></div>`;
  }
  function solveLogic() {
    try { const n=Number($('#logic-n').value), ones=C.parseTerms($('#logic-ones').value,n), dc=C.parseTerms($('#logic-dc').value,n); logic={...logic,n,ones:ones.join(', '),dc:dc.join(', '),result:C.minimize(n,ones,dc),selected:-1,error:'',dirty:false}; render(); }
    catch(e) { logic.n=Number($('#logic-n').value);logic.ones=$('#logic-ones').value;logic.dc=$('#logic-dc').value;logic.error=e.message;logic.dirty=true;$('#logic-error').textContent=e.message;markLogicDirty(); }
  }
  function markLogicDirty() {
    if(!$('#logic-result'))return;
    const dirty=Number($('#logic-n').value)!==logic.result.n || $('#logic-ones').value!==logic.result.ones.join(', ') || $('#logic-dc').value!==logic.result.dontCares.join(', ');
    logic.dirty=dirty;
    const badge=$('#logic-result .panel-header .pill');
    badge.className=`pill ${dirty?'orange':StudyPractice.active()?'blue':'green'}`;badge.textContent=dirty?'保留上次结果 · 新输入未计算':StudyPractice.active()?'自主练习 · 先圈组':'真值验证通过';
    for(const el of document.querySelectorAll('#logic-result [data-action]'))el.disabled=dirty;
  }
  function reviewView() {
    const queue=dueCards(); let card=queue.find(x=>x.id===ui.reviewId) || queue[0]; ui.reviewId=card?.id || null;
    const filter=`<div class="filter-bar"><div class="segmented" aria-label="练习模式">${[['review','主动回忆'],['practice','基础自测']].map(([m,t])=>`<button data-action="review-mode" data-mode="${m}" class="${ui.reviewMode===m?'active':''}" aria-pressed="${ui.reviewMode===m}">${t}</button>`).join('')}</div><label class="sr-only" for="review-topic">复习课程筛选</label><select id="review-topic" ${ui.reviewMode==='practice'?'disabled':''}><option value="">全部方向</option>${courseNames().filter(t=>cards().some(c=>c.topic===t)).map(t=>`<option value="${h(t)}" ${ui.reviewTopic===t?'selected':''}>${h(t)}</option>`).join('')}</select></div>`;
    const left=ui.reviewMode==='practice'?practiceView():card?`<section class="panel review-card"><div class="review-card-top"><span class="pill blue">${h(card.topic)}</span><span class="muted"><small>${state.reviews[card.id]?'到期复习':'新知识卡'} · 待学 ${queue.length} 张</small></span></div><div class="review-question">${h(card.question)}</div>${ui.revealed?`<div class="review-answer">${h(card.answer)}</div><p class="hint">按你刚才独立回答的情况评分，而不是按答案看起来是否熟悉。</p><div class="review-rating">${[['again','没想起来','10 分钟后'],['hard','想得吃力','明天再看'],['good','独立回答','逐步延长'],['easy','能讲给别人','跳一档复习']].map(([r,t,n])=>`<button class="button ${r==='good'?'primary':''}" data-action="rate-card" data-rating="${r}">${t}<small>${n}</small></button>`).join('')}</div>`:`<p class="muted">先口述或写出答案，再翻开这张卡。</p><div class="review-controls"><button class="button primary" data-action="reveal-card">查看答案</button><button class="text-link" data-action="skip-card">暂时跳过</button></div>`}</section>`:`<section class="panel"><div class="empty"><div class="empty-symbol">✓</div><h3>当前方向的复习已完成</h3><p>已评分的卡片会按复习计划再次出现。你也可以添加自己的错题，或做一轮基础自测。</p><button class="button primary" data-action="add-card">记录一张错题</button></div></section>`;
    return heading('RECALL BEFORE YOU RECOGNIZE','把“看懂了”，变成“会做了”。','先尝试回忆，再对照答案；薄弱知识会更早回来。',`<button class="button primary" data-action="add-card">${icon('plus')}记录错题</button>`) + filter + `<div class="review-grid"><div class="stack">${left}<section class="panel">${panelHeader('自己的错题卡',`${state.cards.length} 张 · 题目和答案均由你记录`, `<button class="text-link" data-action="toggle-library">${ui.showLibrary?'收起':'查看知识卡库'}</button>`)}<div class="panel-body">${state.cards.length?state.cards.slice(-5).reverse().map(c=>`<div class="review-list-item"><div class="task-info"><p>${h(c.question)}</p><small>${h(c.topic)} · ${state.reviews[c.id]?`下次 ${fmtTime(state.reviews[c.id].dueAt)}`:'尚未学习'}</small></div><button class="icon-button" data-action="delete-card" data-id="${h(c.id)}" aria-label="删除错题：${h(c.question)}">${icon('trash')}</button></div>`).join(''):'<p class="muted">遇到一次错误，就留下一个可回答的问题。</p>'}<div class="card-list-controls"><button class="button" data-action="export-cards">导出知识卡 Markdown</button></div></div></section>${ui.showLibrary?libraryView():''}</div><div class="stack"><section class="panel">${panelHeader('知识方向','自编基础卡，可按实际课程补充。')}<div class="panel-body"><div class="topic-list">${courseNames().filter(t=>cards().some(c=>c.topic===t)).map(t=>{const list=cards().filter(c=>c.topic===t),learned=list.filter(c=>state.reviews[c.id]).length;return `<div class="topic-item"><span>${h(t)}</span><span>${learned} / ${list.length} 已学</span></div>`;}).join('')}</div></div></section><section class="panel">${panelHeader('怎样算一次有效复习？')}<div class="panel-body"><div class="guide-list">${[['先遮住答案','写出关键步骤，或者用一句话解释原因。'],['再核对差异','找出遗漏的条件、错误的符号或错误的前提。'],['按实际掌握评分','“没想起来”10分钟后再来；“独立回答”依次间隔1、3、7、14、30、60天。']].map(([a,b],i)=>`<div class="guide-step"><span class="guide-number">${i+1}</span><div><h3>${a}</h3><p>${b}</p></div></div>`).join('')}</div><p class="capacity-note">这是可解释的简易间隔计划，不是对长期记忆效果的保证。基础自测均为自编题。</p></div></section></div></div>`;
  }
  function practiceView() {
    const q=D.practice[ui.practiceIndex%D.practice.length], answered=ui.choice!==null;
    return `<section class="panel review-card"><div class="review-card-top"><span class="pill blue">${h(q.topic)}</span><span class="muted"><small>第 ${ui.practiceIndex%D.practice.length+1} / ${D.practice.length} 题</small></span></div><div class="review-question">${h(q.question)}</div><div class="practice-choices">${q.choices.map((c,i)=>`<button class="practice-choice ${answered?(i===q.correct?'correct':i===ui.choice?'wrong':''):''}" data-action="practice-answer" data-choice="${i}" ${answered?'disabled':''}><span>${'ABCD'[i]}</span>${h(c)}${answered && i===q.correct?' ✓':''}</button>`).join('')}</div>${answered?`<div class="review-answer"><strong>${ui.choice===q.correct?'回答正确':'再核对一次关键条件'}</strong><br>${h(q.explanation)}${ui.choice!==q.correct?'<br><small>相关知识已安排 10 分钟后复习。</small>':''}</div><div class="review-controls"><button class="button primary" data-action="practice-next">下一题</button><span class="muted"><small>本轮 ${ui.practiceCorrect} / ${ui.practiceAnswered} 正确</small></span></div>`:'<p class="source-note">选择后会显示解释；答错的相关知识自动进入复习计划。</p>'}</section>`;
  }
  function libraryView() {
    const list=cards().filter(c=>`${c.question} ${c.answer} ${c.topic}`.toLowerCase().includes(ui.cardSearch.toLowerCase()));
    return `<section class="panel">${panelHeader('知识卡库',`${cards().length} 张基础卡与自定义卡`)}<div class="panel-body"><label for="card-search">搜索题目、答案或方向<input id="card-search" value="${h(ui.cardSearch)}" placeholder="例如：卡诺图、受控源、贝叶斯"></label><div id="library-items">${libraryItems(list)}</div></div></section>`;
  }
  function libraryItems(list) { return list.map(c=>`<div class="library-entry"><details class="review-list-item"><summary>${h(c.question)}<small> · ${h(c.topic)}</small></summary><p class="review-answer">${h(c.answer)}</p></details>${state.cards.some(x=>x.id===c.id)?`<div class="library-actions"><button class="icon-button" data-action="edit-card" data-id="${h(c.id)}" aria-label="编辑错题：${h(c.question)}">${icon('edit')}</button><button class="icon-button" data-action="delete-card" data-id="${h(c.id)}" aria-label="删除错题：${h(c.question)}">${icon('trash')}</button></div>`:''}</div>`).join('') || '<p class="muted">没有匹配的知识卡。</p>'; }

  function updateCounts() {
    const x=C.countText(state.drafts); $('#count-total').textContent=x.total;$('#count-clean').textContent=x.noWhitespace;$('#count-chinese').textContent=x.chinese;
    const current=x[ui.counting],diff=ui.target-current, el=$('#draft-status'); el.textContent=diff===0?`正好 ${ui.target} 字，可以开始逐句核对事实。`:diff>0?`距离 ${ui.target} 字还差 ${diff} 字。优先补具体贡献，避免填充空话。`:`超过目标 ${-diff} 字。优先删除重复评价与冗余修饰。`;
    $('#counter-total').classList.toggle('exact',diff===0);$('#counter-total').classList.toggle('over',diff<0);
  }
  async function fullBackup(){try{await StudyVault.exportBackup(state);toast('完整备份已下载，含教材、综测证明与课程进度。');return true;}catch(error){toast(error.message);return false;}}
  function moduleContext(){return {heading,panelHeader,h,toast,getLegacy:()=>state,fullBackup};}
  function dataView() {
    return heading('YOUR DATA, YOUR WORKSPACE','记录、教材与证明，一起带走。','完整备份包含当前个人记录和真实附件；密钥不进入备份。')+`<div class="data-grid"><section class="panel">${panelHeader('完整备份与恢复')}<div class="panel-body"><p>包括任务、复习、专注、旧经历与草稿、教材PDF与生成展示、课程笔记进度、综测活动及证明文件。</p><div class="data-buttons"><button class="button primary" data-action="full-backup">下载完整备份（含附件）</button><button class="button" data-action="full-import">导入完整备份</button></div><p class="source-note">附件总量最多120 MB，教材最多30本，活动最多1,000项。导入前校验全部字段和附件引用，替换前先下载当前完整备份。清除站点数据、更换浏览器或访问地址都可能失去本地数据。</p><div class="notice-box"><strong>API密钥只在页面内存中</strong><p>刷新页面会清除。证明文件只保存在本浏览器；教材生成发送目录节选或所选章节文字到DeepSeek。文件本身不上传。</p></div></div></section><section class="panel">${panelHeader('兼容旧版基础备份')}<div class="panel-body"><p>原有任务、卡片、专注和旧经历备份仍可导入。此格式不包含新教材、课程进度或综测附件。</p><div class="data-buttons"><button class="button" data-action="backup">导出基础记录 JSON</button><button class="button" data-action="import">导入旧版基础记录</button>${damagedBackup?'<button class="button" data-action="recover">下载异常原文</button>':''}</div><p>${state.tasks.length}项任务 · ${state.cards.length}张自建卡 · ${state.sessions.length}次专注 · ${state.experiences.length}项旧经历</p><p class="source-note">旧经历会在首次打开综测记录台时迁移。完整备份是新版本迁移的推荐格式。</p></div></section><section class="panel">${panelHeader('新版使用流程')}<div class="panel-body"><ol class="checklist"><li>运行启动工作台.cmd，保持本地服务开启。</li><li>教材学习：导入PDF，在本机填写DeepSeek密钥，生成目录与章节展示。</li><li>AI专业学习：按先修关系学习，下载端到端训练脚本，记录实作验收。</li><li>综测记录台：填写活动、单位、奖级、日期并添加证明。</li><li>下载完整备份，换设备后在相同版本导入。</li></ol><p class="source-note">没有DeepSeek密钥时仍可读取教材、查看已有展示和学习离线课程。扫描PDF需先OCR。AI路线为自编资料，不代表官方培养方案；综测不自动认定分值。</p></div></section><section class="panel">${panelHeader('专注记录')}<div class="panel-body">${state.sessions.length?`<div class="table-scroll"><table class="data-table"><thead><tr><th>时间</th><th>内容</th><th>分钟</th></tr></thead><tbody>${state.sessions.slice(-20).reverse().map(x=>`<tr><td>${h(fmtTime(x.endedAt))}</td><td>${h(x.topic)}</td><td>${x.minutes}</td></tr>`).join('')}</tbody></table></div>`:'<p>尚无已完成专注。</p>'}</div></section></div>`;
  }
  function pdfLink(filename,label,primary=false) {
    const fileMode=location.protocol==='file:';
    return `<a class="button${primary?' primary':''}" href="${h(filename)}" ${fileMode?'target="_blank" rel="noopener"':'download'}>${fileMode?'查看':'下载'}${h(label)} PDF</a>`;
  }
  function render() {
    const focusedBefore=document.activeElement,focusedId=focusedBefore?.id,focusedData={...focusedBefore?.dataset},hadPageFocus=$('#main').contains(focusedBefore),caretStart=focusedBefore?.selectionStart,caretEnd=focusedBefore?.selectionEnd;
    const requested=location.hash.slice(1); ui.route=pages.some(([r])=>r===requested)?requested:'today';
    updateCourseSelects();
    $('#navigation').innerHTML=pages.map(([r,t])=>`<a href="#${r}" class="${r===ui.route?'active':''}" ${r===ui.route?'aria-current="page"':''}>${icon(r)}${t}</a>`).join('');
    const title=pages.find(([r])=>r===ui.route)[1];$('#page-label').textContent=title; document.title=`${title} · 邮研`;$('#date-label').textContent=new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'});
    $('#quick-add').textContent=ui.route==='review'?'记录错题':ui.route==='materials'?'记录活动':'添加任务';
    $('#main').innerHTML=({today:todayView,logic:()=>StudyTextbook.renderView(moduleContext()),'logic-tools':logicView,ai:()=>StudyCurriculum.renderView(moduleContext()),review:reviewView,materials:()=>StudyRecords.renderView(moduleContext()),data:dataView}[ui.route])();
    if(ui.route==='materials')StudyRecords.mount();
    if(ui.route==='logic')StudyTextbook.mount();
    if(ui.route==='review'){const button=document.createElement('button');button.className='button';button.dataset.action='batch-open';button.textContent='批量录入问答卡';$('#main .card-list-controls').append(button);}
    addEditControls();
    if(ui.route==='logic-tools'){StudyCircuit.mount(logic.result);StudyPractice.mount(logic.result);markLogicDirty();}
    if(ui.route==='ai')StudyCurriculum.mount();
    if(ui.route==='data'){
      const section=document.createElement('section');section.className='panel';section.innerHTML=panelHeader('离开屏幕，再做一遍','7页自编练习册：先作答，后核对。')+'<div class="panel-body"><p class="muted">包含三道卡诺图练习、实际分组图、易错点与线性回归实验记录页。可以打印，也可以保留Markdown继续修改。</p><div class="data-buttons">'+pdfLink('output/pdf/数字逻辑与AI基础速练册.pdf','练习册',true)+'<a class="button" href="docs/学习练习册.md" download>下载 Markdown</a></div></div>';$('#main .data-grid').append(section);
      const practice=document.createElement('section');practice.className='panel';practice.innerHTML=panelHeader('把公式变成你能改的代码','从梯度到分类 · Python实训包')+'<div class="panel-body"><p class="muted">用Python标准库自己计算梯度、Softmax和反向传播。附已执行Notebook、12道自测、实验图与核对代码；解压后按实训手册运行。</p><div class="data-buttons"><a class="button primary" href="output/邮研-Python实训包.zip" download>下载 Python 实训包</a>'+pdfLink('practice/output/从梯度到分类-实训讲义.pdf','实训讲义')+'</div><p class="source-note">网页与PDF使用不需要Python。这个实训包不含你的个人学习记录，个人数据请另导出JSON备份。'+(location.protocol==='file:'?' PDF在新标签页打开，可在阅读器中保存或打印。':'')+'</p></div>';$('#main .data-grid').append(practice);
    }
    if(!focusedBefore.isConnected){
      const keys=Object.keys(focusedData),restored=focusedId?document.getElementById(focusedId):keys.length?[...$('#main').querySelectorAll('[data-action],[data-task]')].find(el=>keys.every(key=>el.dataset[key]===focusedData[key])):null;
      if(restored && !restored.disabled){restored.focus({preventScroll:true});if(typeof caretStart==='number')try{restored.setSelectionRange(caretStart,caretEnd);}catch{}}
      else if(hadPageFocus && !document.querySelector('dialog[open]'))$('#main').focus({preventScroll:true});
    }
  }
  function addEditControls() {
    for(const type of ['task','card','experience'])for(const remove of document.querySelectorAll(`[data-action="delete-${type}"]`)){
      if(remove.previousElementSibling?.dataset.action===`edit-${type}`)continue;
      const button=document.createElement('button');button.className='icon-button';button.type='button';button.dataset.action=`edit-${type}`;button.dataset.id=remove.dataset.id;button.setAttribute('aria-label',remove.getAttribute('aria-label').replace('删除','编辑'));button.innerHTML=icon('edit');remove.before(button);
    }
    if(ui.route==='logic-tools'){const exportButton=document.createElement('button');exportButton.className='button';exportButton.textContent='下载分组图 SVG';exportButton.dataset.action='logic-svg';$('#logic-result .result-actions').append(exportButton);}
  }
  function mutate(action, message) { action(); const saved=save();render(); if(message)toast(message + (saved?'':'（尚未写入本地，请导出备份）')); }
  function completeTimer() {
    const t=state.timer;if(!t || t.status!=='running' || t.endsAt>Date.now())return;
    if(!state.sessions.some(s=>s.id===t.id))state.sessions.push({id:t.id,endedAt:t.endsAt,minutes:t.minutes,topic:t.topic});
    if(state.sessions.length>5000)state.sessions=state.sessions.slice(-5000);
    state.timer=null;const saved=save();render();toast(`这一段 ${t.minutes} 分钟的计时已完成，${saved?'已记录。':'当前记录仅在页面中，请导出备份。'}`);
  }
  function exportExperiences() { return ['# 我的经历档案','',...state.experiences.flatMap(x=>[`## ${x.title}`,`${x.category}${x.date?' · '+x.date:''}`,'',x.detail || '具体贡献待补充','',`证明位置：${x.evidence || '待补充'}`,''])].join('\n'); }
  function exportCards() { return ['# 我的复习知识卡','',...cards().flatMap(c=>[`## ${c.question}`,`方向：${c.topic}`,'',c.answer,''])].join('\n'); }
  const actions = {
    'full-backup':fullBackup,
    'full-import':()=>$('#full-import-file').click(),
    'add-task':()=>{if(state.tasks.length>=1000)return toast('任务已达 1,000 项，请先导出并整理旧任务。');openForm('task');},
    'add-card':()=>{if(state.cards.length>=500)return toast('自建卡已达 500 张，请先导出并整理。');openForm('card');},
    'add-experience':()=>{if(state.experiences.length>=1000)return toast('经历已达 1,000 项，请先导出并整理。');openForm('experience');},
    'edit-task':e=>{const record=state.tasks.find(x=>x.id===e.dataset.id);if(record)openForm('task',record);},
    'edit-card':e=>{const record=state.cards.find(x=>x.id===e.dataset.id);if(record)openForm('card',record);},
    'edit-experience':e=>{const record=state.experiences.find(x=>x.id===e.dataset.id);if(record)openForm('experience',record);},
    'task-filter':e=>{ui.taskFilter=e.dataset.filter;render();},
    'delete-task':e=>confirmAction('删除这项任务？','删除后不能直接恢复；已导出的备份不受影响。',()=>mutate(()=>state.tasks=state.tasks.filter(t=>t.id!==e.dataset.id),'任务已删除'),'删除任务'),
    'start-focus':()=>{const minutes=Number($('#focus-minutes').value),topic=$('#focus-topic').value.trim();if(!Number.isInteger(minutes)||minutes<1||minutes>180)return toast('专注时长请输入 1–180 的整数。');mutate(()=>{state.settings.focusMinutes=minutes;state.timer={id:uid(),status:'running',endsAt:Date.now()+minutes*60000,remainingSeconds:minutes*60,minutes,topic};ui.focusTopic=topic;},'专注已开始');},
    'pause-focus':()=>{if(!state.timer)return;const seconds=remaining();if(seconds===0)return completeTimer();mutate(()=>{state.timer.remainingSeconds=seconds;state.timer.status='paused';},'计时已暂停');},
    'resume-focus':()=>{if(!state.timer)return;mutate(()=>{state.timer.endsAt=Date.now()+state.timer.remainingSeconds*1000;state.timer.status='running';},'计时已继续');},
    'cancel-focus':()=>confirmAction('提前结束这段专注？','本段尚未完成，不会记入专注分钟。可以先暂停，稍后继续。',()=>mutate(()=>state.timer=null,'本段计时已结束'),'结束计时'),
    'solve-logic':solveLogic,
    'logic-example':e=>{const x=D.examples[Number(e.dataset.index)];logic={...logic,n:x.n,ones:x.ones.join(', '),dc:x.dc.join(', '),result:C.minimize(x.n,x.ones,x.dc),selected:-1,error:'',dirty:false,hint:x.hint};render();},
    'logic-cell':e=>{if(Number($('#logic-n').value)!==logic.result.n || $('#logic-ones').value!==logic.ones || $('#logic-dc').value!==logic.dc)return toast('输入已更改，请先点击「化简并验证」，再编辑格子。');const i=Number(e.dataset.index),r=logic.result,ones=new Set(r.ones),dc=new Set(r.dontCares);if(ones.has(i)){ones.delete(i);dc.add(i);}else if(dc.has(i))dc.delete(i);else ones.add(i);logic={...logic,ones:[...ones].sort((a,b)=>a-b).join(', '),dc:[...dc].sort((a,b)=>a-b).join(', '),result:C.minimize(r.n,[...ones],[...dc]),selected:-1,error:'',hint:'格子已修改，公式和真值验证已重新计算。'};render();},
    'logic-group':e=>{const i=Number(e.dataset.index);logic.selected=logic.selected===i?-1:i;render();},
    'logic-copy':()=>copyText(`F = ${logic.result.expression}`),
    'logic-markdown':()=>showText('卡诺图化简过程',C.toMarkdown(logic.result),'卡诺图化简.md'),
    'logic-svg':()=>download(C.toSvg(logic.result),'卡诺图分组.svg','image/svg+xml'),
    'logic-print':()=>window.print(),
    'logic-to-card':()=>{actions['add-card']();if(!$('#card-dialog').open)return;const f=$('#card-form'),r=logic.result;f.elements.topic.value='数字系统设计';f.elements.question.value=`化简 F(${ 'ABCD'.slice(0,r.n) })=Σm(${r.ones.join(',')})${r.dontCares.length?`，无关项 d(${r.dontCares.join(',')})`:''}，并解释分组。`;f.elements.answer.value=`F = ${r.expression}\n${r.selected.map((g,i)=>`第${i+1}组：m(${g.cells.join(',')}) → ${g.text}`).join('\n')}\n先最少乘积项，再最少文字数；等价最简式可能不唯一。`;},
    'start-review':e=>{ui.reviewMode='review';ui.reviewTopic='';ui.reviewId=e.dataset.id;ui.revealed=false;location.hash='review';if(ui.route==='review')render();},
    'review-mode':e=>{ui.reviewMode=e.dataset.mode;ui.revealed=false;render();},
    'reveal-card':()=>{ui.revealed=true;render();},
    'skip-card':()=>{const q=dueCards(),i=q.findIndex(c=>c.id===ui.reviewId);ui.reviewId=q[(i+1)%q.length]?.id;ui.revealed=false;render();},
    'rate-card':e=>{if(!ui.revealed||!ui.reviewId)return;const id=ui.reviewId,rating=e.dataset.rating;mutate(()=>{state.reviews[id]=C.reviewNext(state.reviews[id],rating);ui.reviewId=null;ui.revealed=false;},rating==='again'?'已安排 10 分钟后再次复习':'已更新复习计划');},
    'practice-answer':e=>{if(ui.choice!==null)return;const choice=Number(e.dataset.choice),q=D.practice[ui.practiceIndex%D.practice.length];ui.choice=choice;ui.practiceAnswered++;if(choice===q.correct)ui.practiceCorrect++;else{state.reviews[q.cardId]=C.reviewNext(state.reviews[q.cardId],'again');save();}render();},
    'practice-next':()=>{ui.practiceIndex++;ui.choice=null;if(ui.practiceIndex%D.practice.length===0){toast(`本轮完成：${ui.practiceCorrect} / ${ui.practiceAnswered} 正确，可以再做一轮。`);ui.practiceCorrect=0;ui.practiceAnswered=0;}render();},
    'toggle-library':()=>{ui.showLibrary=!ui.showLibrary;render();},
    'delete-card':e=>confirmAction('删除这张错题卡？','该卡的题目、答案和复习计划将一并移除。',()=>mutate(()=>{state.cards=state.cards.filter(c=>c.id!==e.dataset.id);delete state.reviews[e.dataset.id];},'错题卡已删除'),'删除错题'),
    'export-cards':()=>showText('复习知识卡',exportCards(),'复习知识卡.md'),
    'delete-experience':e=>confirmAction('删除这项经历？','申请草稿文字不会自动改动。建议先备份。',()=>mutate(()=>state.experiences=state.experiences.filter(x=>x.id!==e.dataset.id),'经历已删除'),'删除经历'),
    'export-experiences':()=>showText('经历档案',exportExperiences(),'经历档案.md'),
    'copy-draft':()=>copyText(state.drafts),
    'export-draft':()=>download(state.drafts,'申请草稿.txt'),
    'draft-template':()=>confirmAction('插入结构提示？','这会替换当前草稿。已有文字会先下载为 TXT；结构提示中的括号内容需要你依据事实填写。',()=>{if(state.drafts)download(state.drafts,'插入提示前的草稿.txt');mutate(()=>state.drafts='就读于北京邮电大学人工智能专业，任[学生工作职务]。在[具体工作或项目]中负责[个人贡献]，取得[有证明的结果]。参与[学科实践、体育或志愿活动]，获得[准确奖项全称]。','已插入提示，请替换所有占位内容');},'插入提示'),
    'backup':()=>{backup();toast('JSON 备份已下载');},
    'import':()=>$('#import-file').click(),
    'recover':()=>download(damagedBackup,'异常数据原文.txt'),
    'demo-tasks':()=>{if(state.tasks.length>997)return toast('任务容量不足，先整理旧任务。');mutate(()=>{for(const [title,course] of [['演示：独立解释卡诺图的四角合并','数字系统设计'],['演示：做一轮基础自测并记录易错点','人工智能基础'],['演示：补充一项学生工作的证明位置','学生工作']])if(!state.tasks.some(t=>t.title===title))state.tasks.push({id:uid(),title,course,due:'',priority:'normal',done:false,createdAt:Date.now()});},'已加入 3 项无截止日期的演示任务');}
  };
  document.addEventListener('click', e => {
    const close=e.target.closest('[data-close]');if(close){close.closest('dialog').close();return;}
    const button=e.target.closest('[data-action]');if(button && !button.disabled){const action=button.dataset.action;if(action==='logic-cell' && StudyPractice.active())StudyPractice.toggle(Number(button.dataset.index));else actions[action]?.(button);}
  });
  Object.assign(actions,StudyPractice.actions({render,toast,h,showText,solveExpression:source=>{const n=Number($('#logic-n').value),parsed=C.expressionToTerms(source,n),dc=C.parseTerms($('#logic-dc').value,n);logic={...logic,n,ones:parsed.ones.join(', '),dc:dc.join(', '),result:C.minimize(n,parsed.ones,dc),selected:-1,error:'',dirty:false,hint:'逻辑表达式已逐行求值并转换为最小项。'};render();}}));
  const addAICard=({question,answer})=>{actions['add-card']();if(!$('#card-dialog').open)return;const f=$('#card-form');f.elements.topic.value='人工智能基础';f.elements.question.value=question;f.elements.answer.value=answer;};
  Object.assign(actions,StudyAI.actions({render,toast,showText,addCard:addAICard}));
  Object.assign(actions,StudyDigits.actions({render,h,download,addCard:addAICard}));
  Object.assign(actions,StudyMetrics.actions({render,showText,addCard:addAICard}));
  actions['ai-workbench-mode']=el=>{ui.aiMode=Object.hasOwn(aiLabs,el.dataset.mode)?el.dataset.mode:'regression';render();};
  Object.assign(actions,StudyCircuit.actions({download,showText,h}));
  Object.assign(actions,StudyCardImport.actions({h,cards,courses:courseNames,count:()=>state.cards.length,commit:(fresh,duplicates)=>mutate(()=>state.cards.push(...fresh.map(c=>({...c,id:uid()}))),`已加入 ${fresh.length} 张复习卡${duplicates?`，跳过 ${duplicates} 张完全重复卡`:''}`)}));
  StudyCardImport.mount();
  $('#quick-add').addEventListener('click',()=>{if(ui.route==='materials')StudyRecords.openForm();else actions[ui.route==='review'?'add-card':'add-task']();});
  $('#confirm-action').addEventListener('click',()=>{const action=confirmCallback;confirmCallback=null;$('#confirm-dialog').close();action?.();});
  $('#text-copy').addEventListener('click',()=>copyText($('#export-text').value));
  $('#text-download').addEventListener('click',()=>download($('#export-text').value,exportFile));
  function bindForm(name, create) {
    $(`#${name}-form`).addEventListener('submit',e=>{e.preventDefault();const form=e.target,values=Object.fromEntries(new FormData(form));try{create(values);save();$(`#${name}-dialog`).close();render();toast('已保存'+($('#storage-alert').hidden?'':'；请注意上方保存提示'));}catch(err){form.querySelector('.form-error').textContent=err.message;}});
  }
  function writeRecord(type, values) {
    const key={task:'tasks',card:'cards',experience:'experiences'}[type],limit={task:1000,card:500,experience:1000}[type],id=editing[type];
    if(id){const i=state[key].findIndex(x=>x.id===id);if(i<0)throw new Error('这条记录已在其他窗口被删除，请关闭后重新添加。');state[key][i]={...state[key][i],...values};}
    else {if(state[key].length>=limit)throw new Error('记录已达容量上限，请先导出并整理。');state[key].push({id:uid(),...values});}
  }
  bindForm('task',v=>{if(!v.title.trim())throw new Error('任务名称不能全部为空格。');if(!C.validDate(v.due))throw new Error('截止日期无效。');const previous=state.tasks.find(x=>x.id===editing.task);writeRecord('task',{title:v.title.trim(),course:v.course,due:v.due,priority:v.priority,done:previous?.done || false,createdAt:previous?.createdAt || Date.now()});});
  bindForm('card',v=>{if(!v.question.trim()||!v.answer.trim())throw new Error('请填写题目与答案，不能只含空白。');writeRecord('card',{question:v.question.trim(),answer:v.answer.trim(),topic:v.topic});ui.reviewId=null;});
  bindForm('experience',v=>{if(!v.title.trim())throw new Error('经历名称不能全部为空格。');if(!C.validDate(v.date))throw new Error('日期无效。');writeRecord('experience',{title:v.title.trim(),category:v.category,date:v.date,detail:v.detail.trim(),evidence:v.evidence.trim()});});
  document.addEventListener('change',e=>{
    if(e.target.matches('[data-task]')){const t=state.tasks.find(t=>t.id===e.target.dataset.task);if(t)mutate(()=>t.done=e.target.checked,t.done?'任务恢复为待完成':'完成一项任务，继续保持');}
    if(e.target.id==='task-course'){ui.taskCourse=e.target.value;render();}
    if(e.target.id==='review-topic'){ui.reviewTopic=e.target.value;ui.reviewId=null;ui.revealed=false;render();}
    if(e.target.id==='draft-target'){ui.target=Number(e.target.value);updateCounts();}
    if(e.target.id==='draft-counting'){ui.counting=e.target.value;updateCounts();}
    if(e.target.id==='focus-minutes' && !state.timer){const minutes=Number(e.target.value);if(Number.isInteger(minutes)&&minutes>=1&&minutes<=180){state.settings.focusMinutes=minutes;save();$('#timer-digits').textContent=formatTimer(minutes*60);}}
    if(e.target.id==='logic-n'){markLogicDirty();$('#logic-hint').textContent=`输入 0–${2**Number(e.target.value)-1} 的编号，用逗号或空格分隔。请点击「化简并验证」更新结果。`;}
  });
  document.addEventListener('input',e=>{
    if(e.target.id==='draft-text'){state.drafts=e.target.value;save();updateCounts();}
    if(e.target.id==='focus-topic')ui.focusTopic=e.target.value;
    if(['logic-ones','logic-dc'].includes(e.target.id))markLogicDirty();
    if(e.target.id==='card-search'){ui.cardSearch=e.target.value;$('#library-items').innerHTML=libraryItems(cards().filter(c=>`${c.question} ${c.answer} ${c.topic}`.toLowerCase().includes(ui.cardSearch.toLowerCase())));}
  });
  $('#import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    if(file.size>C.BACKUP_FILE_LIMIT)return toast(`文件超过 ${C.BACKUP_FILE_LIMIT/1024/1024} MB，请检查是否为本工作台备份。`);
    try {const imported=readState(await file.text());confirmAction('用这份备份替换当前数据？',`备份包含 ${imported.tasks.length} 项任务、${imported.cards.length} 张自建卡、${imported.experiences.length} 项经历和 ${imported.sessions.length} 次专注。\n当前数据会先下载为 JSON，再被替换。`,()=>{backup();state=imported;StudyVault.migrate(state.experiences,true).catch(error=>toast('基础数据已导入；经历迁移失败：'+error.message));ui.reviewId=null;ui.revealed=false;save();render();completeTimer();toast('备份已导入；原数据已先下载为备份。');},'备份当前并导入');}
    catch {toast('无法导入：文件格式或字段不合法。当前数据未修改。');}
  });
  $('.skip-link').addEventListener('click',e=>{e.preventDefault();$('#main').focus();$('#main').scrollIntoView({block:'start'});});
  window.addEventListener('hashchange',()=>{render();$('#main').focus({preventScroll:true});window.scrollTo({top:0,behavior:'instant'});});
  $('#full-import-file').addEventListener('change',async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    if(file.size>256*1024*1024)return toast('完整备份最大256 MB。');
    try{const raw=JSON.parse((await file.text()).replace(/^\uFEFF/,''));const legacy=readState(JSON.stringify(raw.legacy)),data=StudyVault.validateBackup(raw);confirmAction('替换全部工作台数据？',`将恢复${data.books.length}本教材、${data.records.length}项活动及${data.files.length}份真实文件。当前完整数据先下载备份。`,async()=>{try{if(!await fullBackup())return;await StudyVault.replace(data);state=legacy;save();render();toast('完整备份已恢复，附件与进度已写入本地。');}catch(error){toast(error.message);}},'备份当前并恢复');}catch(error){toast(error.message);}
  });
  window.addEventListener('storage',e=>{if(e.key===KEY && e.newValue){try{state=readState(e.newValue);render();toast('已同步另一窗口保存的数据。');}catch{alertStorage('另一窗口保存的数据无法读取，请先备份本窗口内容。');}}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){completeTimer();if(ui.route==='today')render();}});
  setInterval(()=>{if(state.timer?.status==='running')completeTimer();const digits=$('#timer-digits');if(digits)digits.textContent=formatTimer(remaining());},1000);
  render();completeTimer();
})();
