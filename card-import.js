(function(root){
  'use strict';
  const C=StudyCore,$=s=>document.querySelector(s);
  let deps,pending=null,fileVersion=0;
  const sample='问：为什么一次梯度更新要使用同一份旧参数？\n答：完整梯度应对应同一模型位置。先改某个权重再用它求另一项梯度，会混用新旧参数。\n---\n问：Softmax概率高为什么不保证实际识别正确？\n答：它归一化当前模型的分数；未校准的模型可能对分布外输入很自信地认错。';
  function invalidate(){pending=null;fileVersion++;$('#batch-preview').innerHTML='';$('#batch-error').textContent='';$('#batch-commit').disabled=true;$('#batch-commit').textContent='确认加入复习';}
  function preview(){
    invalidate();
    try{
      const topic=$('#batch-topic').value;
      // A selected existing direction keeps its exact stored value, including whitespace.
      const batch=C.parseCardBatch($('#batch-text').value,topic).map(card=>({...card,topic})),result=C.deduplicateCards(batch,deps.cards()),room=500-deps.count();
      if(result.fresh.length>room)throw new Error(`需新增${result.fresh.length}张，但还可保存${room}张。请先整理已有卡片或减少本批文本；本批尚未写入。`);
      pending=batch;$('#batch-preview').innerHTML=`<div class="notice-box"><strong>待新增 ${result.fresh.length} 张 · 跳过完全重复 ${result.duplicates} 张</strong><p>只有点击确认才会写入。下面预览前5张新卡，原卡和复习进度保留。</p></div>`+result.fresh.slice(0,5).map(c=>`<details class="batch-preview-card"><summary>${deps.h(c.question)}</summary><p>${deps.h(c.answer)}</p></details>`).join('');
      $('#batch-commit').disabled=!result.fresh.length;$('#batch-commit').textContent=`确认加入 ${result.fresh.length} 张`;
    }catch(error){$('#batch-error').textContent=error.message;}
  }
  function mount(){
    $('#batch-text').addEventListener('input',invalidate);$('#batch-topic').addEventListener('change',invalidate);
    $('#batch-file').addEventListener('change',async e=>{
      const file=e.target.files[0];e.target.value='';if(!file)return;
      const version=++fileVersion;
      try{
        if(file.size>2*1024*1024)throw new Error('文件超过2MB，请分批录入。');
        const text=new TextDecoder('utf-8',{fatal:true}).decode(await file.arrayBuffer());if(version!==fileVersion)return;
        $('#batch-text').value=text;invalidate();preview();
      }catch(error){if(version===fileVersion){invalidate();$('#batch-error').textContent=error instanceof TypeError?'无法按UTF-8读取；请将文件保存为UTF-8纯文本。':error.message;}}
    });
  }
  function actions(helpers){deps=helpers;return {
    'batch-open':()=>{const topic=$('#batch-topic').value||'人工智能基础';$('#batch-topic').innerHTML=[...new Set([...deps.courses(),topic])].map(t=>`<option value="${deps.h(t)}">${deps.h(t)}</option>`).join('');$('#batch-topic').value=topic;invalidate();$('#batch-dialog').showModal();},
    'batch-sample':()=>{$('#batch-text').value=sample;invalidate();preview();},
    'batch-file':()=>$('#batch-file').click(),
    'batch-preview':preview,
    'batch-commit':()=>{if(!pending)return;const result=C.deduplicateCards(pending,deps.cards());if(result.fresh.length>500-deps.count()){invalidate();$('#batch-error').textContent='可用容量已变化，请重新预览后再加入。';return;}if(!result.fresh.length){preview();return;}deps.commit(result.fresh,result.duplicates);$('#batch-text').value='';$('#batch-dialog').close();pending=null;document.querySelector('[data-action="batch-open"]')?.focus();}
  };}
  root.StudyCardImport={actions,mount};
})(globalThis);
