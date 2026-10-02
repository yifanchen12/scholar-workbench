(function(root){
  'use strict';
  const C=StudyCore,$=s=>document.querySelector(s);
  let mode='auto',selected=new Set(),groups=[],key='',source="AB + A'C",feedback='',current,helpers;
  function clean(){selected=new Set();groups=[];feedback='';}
  function mount(result){
    current=result;const next=`${result.n}|${result.ones}|${result.dontCares}`;if(next!==key){key=next;clean();}
    const h=helpers.h;
    const details=document.createElement('details');details.className='section-gap expression-import';details.innerHTML=`<summary>从逻辑表达式导入</summary><label>逻辑表达式<input id="logic-expression" maxlength="1000" value="${h(source)}" placeholder="例如：AB + A'C"></label><p class="hint">相邻字母表示与；+ 表示或，' 或 ! 表示取反，^ 表示异或。可用括号。无需输入 F=。</p><button class="button" data-action="practice-expression">转换并化简</button><p id="expression-error" class="error-message" role="alert"></p>`;$('.logic-controls .panel-body').append(details);
    const buttons=document.createElement('div');buttons.className='segmented logic-mode';buttons.setAttribute('aria-label','卡诺图学习方式');buttons.innerHTML=[['auto','系统化简'],['manual','我来圈组']].map(([m,t])=>`<button data-action="practice-mode" data-mode="${m}" class="${mode===m?'active':''}" aria-pressed="${mode===m}">${t}</button>`).join('');$('#logic-result .panel-body').prepend(buttons);
    const panel=$('#logic-result');panel.classList.toggle('practice-active',mode==='manual');
    if(mode==='manual'){
      panel.querySelector('.circuit-section').hidden=true;
      for(const selector of ['.formula-result','.group-list','.result-actions','.verification'])panel.querySelector(selector).hidden=true;
      panel.querySelector('.panel-header .pill').className='pill blue';panel.querySelector('.panel-header .pill').textContent='自主练习 · 先圈组';
      panel.querySelector('.panel-header h2').textContent='你的分组过程';panel.querySelector('.panel-header p').textContent='点击1或×选格子；一个格子可以被不同组重复使用。';
      const consoleBox=document.createElement('div');consoleBox.className='practice-console';consoleBox.innerHTML=`<p class="manual-selection">当前选中：${selected.size?[...selected].sort((a,b)=>a-b).map(i=>'m'+i).join(', '):'还没有选中格子'}</p><div class="result-actions"><button class="button primary" data-action="practice-add-group">加入这一组</button><button class="button" data-action="practice-clear">取消选中</button></div><div class="manual-groups">${groups.map((g,i)=>`<div class="manual-group"><div><strong>组 ${i+1} · ${h(g.text)}</strong><small>m(${g.cells.join(', ')}) · ${g.cells.length} 格</small></div><button class="icon-button" data-action="practice-remove" data-index="${i}" aria-label="移除第${i+1}组">×</button></div>`).join('') || '<p class="hint">你加入的分组会显示在这里，系统暂时不展示最简答案。</p>'}</div><div class="result-actions"><button class="button primary" data-action="practice-assess">我已圈完，检查覆盖</button><button class="button" data-action="practice-export">导出我的过程</button><button class="button ghost" data-action="practice-reset">重新圈组</button></div><p class="manual-feedback" role="status">${h(feedback)}</p>`;panel.querySelector('.kmap-legend').after(consoleBox);
      for(const button of panel.querySelectorAll('.kmap-cell')){
        const i=Number(button.dataset.index),td=button.closest('td');td.classList.remove('dim','highlight');td.removeAttribute('style');td.classList.toggle('manual-selected',selected.has(i));td.classList.toggle('manual-covered',groups.some(g=>g.cells.includes(i)));
        button.setAttribute('aria-label',`m${i}，值${result.dontCares.includes(i)?'×':result.ones.includes(i)?'1':'0'}，${selected.has(i)?'已选中，点击取消':'点击选中分组'}`);button.setAttribute('aria-pressed',String(selected.has(i)));
        button.querySelector('.cell-groups').innerHTML=groups.flatMap((g,k)=>g.cells.includes(i)?[`<span class="group-dot">${k+1}</span>`]:[]).join('');
      }
      const legend=panel.querySelector('.kmap-legend');legend.innerHTML='<span>蓝色边框 · 正在选中</span><span>绿色底色 · 已有组覆盖</span><span>数字 · 你的分组编号</span>';
    }
  }
  function toggle(index){if(!current.ones.includes(index)&&!current.dontCares.includes(index)){helpers.toast('这格是0，不能加入分组。');return;}if(selected.has(index))selected.delete(index);else selected.add(index);feedback='';helpers.render();}
  function actions(deps){helpers=deps;const run=fn=>()=>{try{fn();}catch(e){feedback=e.message;helpers.render();helpers.toast(e.message);}};return{
    'practice-mode':el=>{mode=el.dataset.mode;helpers.render();},
    'practice-expression':()=>{source=$('#logic-expression').value;try{helpers.solveExpression(source);helpers.toast('表达式已转换，最小项与真值已重新计算。');}catch(e){$('#expression-error').textContent=e.message;}},
    'practice-add-group':run(()=>{if(groups.length>=32)throw new Error('分组已达32个，请移除冗余组。');const g=C.validateGroup(current.n,[...selected],current.ones,current.dontCares);if(groups.some(x=>x.pattern===g.pattern))throw new Error('相同的组已经加入，不必重复。');groups.push(g);selected=new Set();feedback=`已加入 ${g.cells.length} 格组，保留 ${g.text}；${current.n-g.literals} 个变量被消去。`;helpers.render();}),
    'practice-clear':()=>{selected=new Set();feedback='';helpers.render();},
    'practice-remove':el=>{groups.splice(Number(el.dataset.index),1);feedback='';helpers.render();},
    'practice-reset':()=>{clean();helpers.render();},
    'practice-assess':run(()=>{const r=C.assessGroups(current.n,groups,current.ones,current.dontCares);feedback=!r.complete?`还漏了 m(${r.missing.join(', ')})。已加入的组都合法，继续覆盖这些1。`:r.optimal?`覆盖完整，且达到最少 ${r.bestTerms} 项、${r.bestLiterals} 个文字。你的式子：F = ${r.expression}`:`覆盖完整且真值等价，但有 ${r.terms} 项、${r.literals} 个文字；最优成本为 ${r.bestTerms} 项、${r.bestLiterals} 个文字。尝试扩大或减少冗余组。`;helpers.render();}),
    'practice-export':run(()=>{const report=C.assessGroups(current.n,groups,current.ones,current.dontCares);if(!report.complete)throw new Error('还有最小项未覆盖，请完成后再导出。');const rows=current.table.map(x=>({...x,actual:groups.some(g=>C.matches(g.pattern,x.value,current.n))?1:0})),result={...current,selected:groups,expression:report.expression,latex:groups.map(g=>C.termText(g.pattern,true)).join('+')||'0',literals:report.literals,table:rows,verified:true};let markdown=C.toMarkdown(result).replace('## 最简与或式','## 我的与或式').replace('优化顺序：先最少乘积项，再最少文字数；等价最简式可能不唯一。',report.optimal?'成本验证：达到最少项数与最少文字数；等价最简式可能不唯一。':`成本验证：当前 ${report.terms} 项、${report.literals} 文字；最优成本 ${report.bestTerms} 项、${report.bestLiterals} 文字，尚可优化。`);helpers.showText('我的卡诺图分组过程',markdown,'我的卡诺图过程.md');})
  };}
  root.StudyPractice={mount,toggle,actions,active:()=>mode==='manual'};
})(globalThis);
