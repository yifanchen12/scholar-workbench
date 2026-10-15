(function(root){
  'use strict';
  const V=StudyVault,desktop=!!root.StudyDesktop;let ctx,records=[],files=[],editing=null,query='',year='',urls=[],draftProofs=[],formVersion=0,pickerController;
  const h=x=>ctx.h(x),categories=['学习','竞赛','学生工作','体育','志愿服务','科研','其他'];
  const pathsOf=r=>r.evidencePaths||[],baseName=p=>p.split(/[\\/]/).pop();
  function renderView(helpers){ctx=helpers;return ctx.heading('KEEP THE EVIDENCE','综测记录台','记录活动与证明原路径，文件留在原位置，不再复制存储。',(desktop?'':'<button class="button" id="record-desktop">启用直接拖入</button>')+'<button class="button primary" id="record-add">记录活动</button>')+'<div id="records-root"><p>正在打开本地记录…</p></div>';}
  async function mount(){const el=document.querySelector('#records-root');try{await V.migrate(ctx.getLegacy().experiences);[records,files]=await Promise.all([V.all('records'),V.all('files')]);if(!el?.isConnected)return;paint(el);document.querySelector('#record-add').onclick=()=>openForm();const launch=document.querySelector('#record-desktop');if(launch)launch.onclick=()=>ctx.openDesktop().catch(e=>ctx.toast(e.message));}catch(e){if(el?.isConnected)el.textContent=e.message;}}
  const selectedRecords=()=>records.filter(r=>(!query||[r.title,r.organizer,r.award,r.notes,r.category].join(' ').toLowerCase().includes(query.toLowerCase()))&&(!year||r.date.startsWith(year))).sort((a,b)=>b.date.localeCompare(a.date));
  function paint(el){
    for(const url of urls)URL.revokeObjectURL(url);urls=[];
    const years=[...new Set(records.map(r=>r.date.slice(0,4)).filter(Boolean))].sort().reverse();
    const count=r=>r.fileIds.length+pathsOf(r).length;
    el.innerHTML=`<div class="record-stats"><div><strong>${records.length}</strong><span>活动记录</span></div><div><strong>${records.filter(r=>count(r)).length}</strong><span>已附证明</span></div><div><strong>${records.reduce((n,r)=>n+count(r),0)}</strong><span>证明引用（含旧附件）</span></div></div><section class="panel"><div class="panel-body"><div class="record-filters"><label>搜索活动 / 单位 / 奖项<input id="record-query" type="search" value="${h(query)}" placeholder="例如：志愿服务、数学建模"></label><label>年份<select id="record-year"><option value="">所有年份</option>${years.map(y=>`<option ${year===y?'selected':''}>${h(y)}</option>`).join('')}</select></label><button class="button" id="record-csv">导出当前列表 CSV</button><button class="button" id="record-backup">完整备份（含路径与旧附件）</button></div><p class="source-note">新证明只保存原路径，不复制文件。移动或删除原文件后需更新路径；备份不包含路径指向的文件。旧附件仍保留，可编辑移除。</p><div id="record-list"></div></div></section><details class="panel legacy-draft"><summary>保留的旧申请草稿</summary><div class="panel-body"><p class="preserve-lines">${h(ctx.getLegacy().drafts||'没有旧草稿。')}</p><button class="button" id="record-draft-export">下载旧草稿</button></div></details><dialog id="record-dialog" aria-labelledby="record-heading"><form id="record-form"><div class="dialog-heading"><h2 id="record-heading">记录活动</h2><button type="button" class="icon-button" id="record-close" aria-label="关闭">×</button></div><label>活动名称<input name="title" maxlength="300" required placeholder="填写活动或比赛全称"></label><label>举办单位<input name="organizer" maxlength="300" required placeholder="例如：学院、学校、学会"></label><div class="form-row"><label>获奖等级<input name="award" maxlength="200" required placeholder="例如：校级一等奖 / 未获奖（参与）"></label><label>活动 / 获奖日期<input name="date" type="date" required></label></div><label>分类<select name="category">${categories.map(c=>`<option>${c}</option>`).join('')}</select></label><label>个人贡献 / 备注<textarea name="notes" rows="3" maxlength="6000"></textarea></label><div id="record-drop" class="evidence-drop" role="button" tabindex="0" aria-describedby="record-path-hint"><strong>拖拽文件或照片到这里</strong><span>或点击选择原文件 · 仅记录路径</span></div><p class="hint" id="record-path-hint">${desktop?'拖入即自动添加真实路径，不读取或复制文件内容。每项最多10份（含旧附件）。':'要拖入即完成，请启用桌面模式。当前记录和活动表单会自动带入，无需逐项重录。'}</p>${desktop?'':'<button type="button" class="button primary" id="record-desktop-start">启用直接拖入（自动带上记录）</button>'}<input id="record-native-files" type="file" multiple hidden><div id="record-proof-paths"></div><details class="proof-manual" ${desktop?'hidden':''}><summary>浏览器备用：手动填写原路径</summary><label>粘贴完整原路径（多份材料一行一个）<textarea id="record-paste-paths" rows="2" maxlength="41000" placeholder="粘贴“复制文件地址”的结果，也可将路径文字拖入上方区域。"></textarea></label><button type="button" class="button" id="record-add-paths">添加路径</button></details><div id="record-current-files"></div><p id="record-error" class="form-error" role="alert"></p><div class="dialog-actions"><button type="button" class="button" id="record-cancel">取消</button><button class="button primary" id="record-save">保存活动与路径</button></div></form></dialog>`;
    el.querySelector('#record-query').oninput=e=>{query=e.target.value;paintList(el);};el.querySelector('#record-year').onchange=e=>{year=e.target.value;paintList(el);};el.querySelector('#record-csv').onclick=exportCSV;el.querySelector('#record-backup').onclick=()=>ctx.fullBackup();el.querySelector('#record-draft-export').onclick=()=>V.download(new Blob([ctx.getLegacy().drafts],{type:'text/plain;charset=utf-8'}),'原申请草稿.txt');
    const dialog=el.querySelector('#record-dialog'),error=el.querySelector('#record-error'),drop=el.querySelector('#record-drop');
    for(const key of ['record-close','record-cancel'])el.querySelector('#'+key).onclick=()=>dialog.close();
    dialog.onclose=()=>{formVersion++;pickerController?.abort();draftProofs=[];};
    drop.onclick=choosePaths;drop.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choosePaths();}};
    drop.ondragover=e=>{e.preventDefault();e.dataTransfer.dropEffect='link';drop.classList.add('drag-over');};drop.ondragleave=()=>drop.classList.remove('drag-over');
    drop.ondrop=e=>{e.preventDefault();drop.classList.remove('drag-over');error.textContent='';try{if(e.dataTransfer.files.length){const files=[...e.dataTransfer.files];if(desktop)addPaths(StudyDesktop.pathsForFiles(files));else addNames(files.map(file=>file.name));}else addPaths(e.dataTransfer.getData('text/plain').split(/\r?\n/).filter(x=>x.trim()));}catch(e){error.textContent=e.message;}};
    dialog.ondragover=e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();};dialog.ondrop=e=>{if([...e.dataTransfer.types].includes('Files'))e.preventDefault();};
    el.querySelector('#record-native-files').onchange=e=>{try{addPaths(StudyDesktop.pathsForFiles([...e.target.files]));error.textContent='';}catch(errorValue){error.textContent=errorValue.message;}finally{e.target.value='';}};
    const desktopStart=el.querySelector('#record-desktop-start');if(desktopStart)desktopStart.onclick=async()=>{desktopStart.disabled=true;try{await ctx.openDesktop({id:editing,fields:Object.fromEntries(new FormData(el.querySelector('#record-form'))),proofs:draftProofs});}catch(e){error.textContent=e.message;}finally{desktopStart.disabled=false;}};
    el.querySelector('#record-add-paths').onclick=()=>{error.textContent='';try{const field=el.querySelector('#record-paste-paths'),values=field.value.split(/\r?\n/).filter(x=>x.trim());if(!values.length)throw new Error('请先粘贴完整原路径。');addPaths(values);field.value='';}catch(e){error.textContent=e.message;}};
    el.querySelector('#record-proof-paths').oninput=e=>{if(e.target.matches('[data-proof-path]'))draftProofs[Number(e.target.dataset.proofPath)].path=e.target.value;};
    el.querySelector('#record-proof-paths').onclick=e=>{const button=e.target.closest('[data-proof-remove]');if(button){draftProofs.splice(Number(button.dataset.proofRemove),1);paintDraftPaths();}};
    el.querySelector('#record-form').onsubmit=async e=>{
      e.preventDefault();const form=e.target,save=el.querySelector('#record-save');save.disabled=true;error.textContent='';
      try{
        const values=Object.fromEntries(new FormData(form));if(!values.title.trim()||!values.organizer.trim()||!values.award.trim()||!values.date)throw new Error('请完整填写活动、举办单位、获奖等级和日期。');
        const evidencePaths=draftProofs.map(p=>{if(!p.path.trim())throw new Error(`证明“${p.name}”尚未绑定原文件；请启用桌面模式后直接拖入，无需手填路径。`);return V.evidencePath(p.path);});
        const prior=records.find(r=>r.id===editing),remove=[...form.querySelectorAll('[data-remove-file]:checked')].map(e=>e.value),record={id:editing||V.id(),title:values.title.trim(),organizer:values.organizer.trim(),award:values.award.trim(),date:values.date,category:values.category,notes:values.notes.trim(),fileIds:prior?.fileIds||[],evidencePaths};
        if(!StudyCore.validDate(record.date))throw new Error('日期无效。');await V.saveRecord(record,remove);dialog.close();ctx.toast('活动与原路径已保存，未复制证明文件。');await mount();
      }catch(e){error.textContent=e.message;}finally{save.disabled=false;}
    };
    el.querySelector('#record-list').onclick=async e=>{
      const btn=e.target.closest('[data-record]');if(!btn)return;
      try{
        if(btn.dataset.record==='edit')openForm(records.find(r=>r.id===btn.dataset.id));
        if(btn.dataset.record==='copy-path'){const record=records.find(r=>r.id===btn.dataset.id),value=pathsOf(record)[Number(btn.dataset.index)];if(!value)throw new Error('证明路径不存在。');await navigator.clipboard.writeText(value);ctx.toast('原路径已复制。');}
        if(btn.dataset.record==='file')await V.openFile(btn.dataset.id);
        if(btn.dataset.record==='delete'&&confirm('删除此活动、路径引用及旧附件？原位置的文件不会被删除。')){await V.deleteOwner('records',btn.dataset.id);await mount();ctx.toast('记录已删除，原位置文件不受影响。');}
      }catch(error){ctx.toast(error.message);}
    };
    paintList(el);
  }
  function remainingLegacy(){const record=records.find(r=>r.id===editing);return (record?.fileIds.length||0)-document.querySelectorAll('#record-form [data-remove-file]:checked').length;}
  function checkCount(values){if(values.length+remainingLegacy()>10)throw new Error('每项活动最多10份证明材料（含旧附件）。');}
  function addNames(names){const next=draftProofs.map(p=>({...p}));for(const name of names)next.push({name,path:''});checkCount(next);draftProofs=next;paintDraftPaths();}
  function addPaths(values){
    const next=draftProofs.map(p=>({...p}));for(const value of values.map(V.evidencePath)){if(next.some(p=>p.path===value))continue;const name=baseName(value),pending=next.find(p=>p.name===name&&!p.path);if(pending)pending.path=value;else next.push({name,path:value});}
    checkCount(next);draftProofs=next;paintDraftPaths();
  }
  function paintDraftPaths(){document.querySelector('#record-proof-paths').innerHTML=draftProofs.map((p,i)=>`<div class="proof-path-row"><label>${h(p.name)}${desktop?`<small class="proof-bound-path">${h(p.path||'请在此桌面窗口重新拖入原文件，即可自动绑定')}</small>`:`<input data-proof-path="${i}" value="${h(p.path)}" maxlength="4096" placeholder="完整原路径（不会复制文件）" autocomplete="off" spellcheck="false">`}</label><button class="icon-button" type="button" data-proof-remove="${i}" aria-label="移除引用：${h(p.name)}">×</button></div>`).join('');}
  async function choosePaths(){
    if(desktop){document.querySelector('#record-native-files').click();return;}
    if(pickerController)return;const version=formVersion,controller=new AbortController();pickerController=controller;
    const drop=document.querySelector('#record-drop'),error=document.querySelector('#record-error');drop.setAttribute('aria-busy','true');error.textContent='';
    try{if(location.protocol==='file:')throw new Error('请启动本地服务使用系统选择器，或手动粘贴完整路径。');const response=await fetch('/api/evidence/pick',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',signal:controller.signal});const data=await response.json();if(!response.ok)throw new Error(data.error||'未能获取原路径，请手动粘贴。');if(version===formVersion&&document.querySelector('#record-dialog')?.open)addPaths(data.paths);}
    catch(e){if(version===formVersion&&e.name!=='AbortError')error.textContent=e.message;}
    finally{drop.removeAttribute('aria-busy');if(pickerController===controller)pickerController=null;}
  }
  function paintList(el){
    for(const url of urls)URL.revokeObjectURL(url);urls=[];const list=selectedRecords();
    el.querySelector('#record-list').innerHTML=list.length?list.map(r=>`<article class="record-card"><div class="record-card-heading"><div><span class="pill">${h(r.category)}</span><h3>${h(r.title)}</h3><p>${h(r.organizer||'举办单位待补充')} · ${h(r.date||'日期待补充')}</p></div><strong class="award-badge">${h(r.award||'奖级待补充')}</strong></div>${r.notes?`<p class="preserve-lines">${h(r.notes)}</p>`:''}<div class="evidence-grid">${pathsOf(r).map((p,i)=>`<button class="evidence-file evidence-reference" data-record="copy-path" data-id="${h(r.id)}" data-index="${i}"><span>${h(baseName(p))}</span><code>${h(p)}</code><small>仅路径 · 点击复制</small></button>`).join('')}${r.fileIds.map(key=>{
      const f=files.find(x=>x.id===key);if(!f)return '<p>旧证明缺失，请恢复备份。</p>';let image='';if(['image/png','image/jpeg','image/webp','image/gif'].includes(f.type)){const url=URL.createObjectURL(f.blob);urls.push(url);image=`<img src="${url}" alt="${h(f.name)}" loading="lazy" width="160" height="100">`;}
      return `<button class="evidence-file" data-record="file" data-id="${h(key)}">${image||'<span class="evidence-icon" aria-hidden="true">▤</span>'}<span>${h(f.name)}</span><small>旧版存储副本 · ${(f.blob.size/1024).toFixed(1)} KB · 下载</small></button>`;
    }).join('')}${r.fileIds.length||pathsOf(r).length?'':'<p class="muted">还没有证明路径。</p>'}</div><div class="data-buttons"><button class="button" data-record="edit" data-id="${h(r.id)}">编辑与补充证明</button><button class="button ghost" data-record="delete" data-id="${h(r.id)}">删除活动</button></div></article>`).join(''):'<div class="empty"><h3>暂无匹配的活动记录</h3><p>活动结束后记下名称、举办单位、奖级和日期，再记录证明文件原路径。</p></div>';
  }
  function openForm(record=null){
    const form=document.querySelector('#record-form');if(!form)return;form.reset();formVersion++;editing=record?.id||null;draftProofs=pathsOf(record||{}).map(path=>({name:baseName(path),path}));
    if(record)for(const key of ['title','organizer','award','date','category','notes'])form.elements[key].value=record[key];document.querySelector('#record-heading').textContent=record?'编辑活动与证明':'记录活动';document.querySelector('#record-error').textContent='';
    document.querySelector('#record-current-files').innerHTML=(record?.fileIds||[]).map(key=>`<label class="remove-file"><input type="checkbox" data-remove-file value="${h(key)}">移除旧副本：${h(files.find(f=>f.id===key)?.name||'缺失附件')}（不影响原文件）</label>`).join('');paintDraftPaths();document.querySelector('#record-dialog').showModal();
  }
  function exportCSV(){const safe=x=>{let value=String(x);if(/^[=+\-@\t\r]/.test(value))value="'"+value;return '"'+value.replace(/"/g,'""')+'"';};const rows=[['活动名称','举办单位','获奖等级','日期','分类','备注','证明原路径','旧存储附件'],...selectedRecords().map(r=>[r.title,r.organizer,r.award,r.date,r.category,r.notes,pathsOf(r).join('；'),r.fileIds.map(k=>files.find(f=>f.id===k)?.name||'缺失').join('；')])];V.download(new Blob(['\uFEFF'+rows.map(r=>r.map(safe).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),'综测活动记录.csv');}
  function restoreDraft(draft){
    if(!draft||typeof draft!=='object')return;openForm(records.find(r=>r.id===draft.id)||null);
    const form=document.querySelector('#record-form'),limits={title:300,organizer:300,award:200,date:10,category:50,notes:6000};
    for(const [key,max] of Object.entries(limits))if(typeof draft.fields?.[key]==='string')form.elements[key].value=draft.fields[key].slice(0,max);
    if(Array.isArray(draft.proofs)&&draft.proofs.length<=10){draftProofs=draft.proofs.filter(p=>p&&typeof p.name==='string'&&typeof p.path==='string').map(p=>({name:p.name.slice(0,300),path:p.path?V.evidencePath(p.path):''}));paintDraftPaths();}
  }
  root.StudyRecords={renderView,mount,openForm,restoreDraft};
})(globalThis);
