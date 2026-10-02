(function (root) {
  'use strict';
  const C=StudyCore;
  const presets = [
    {name:'有一点噪声的直线',description:'合成数据，用来观察参数怎样接近一条直线。',train:'-2, -3\n-1, -0.8\n0, 1\n1, 3.1\n2, 4.8\n3, 7.2',test:'-1.5, -2\n0.5, 2\n2.5, 6',eta:.1},
    {name:'同样规律，放大 x 50 倍',description:'y 不变而 x 放大 50 倍；相同学习率可能失稳。',train:'-100, -3\n-50, -0.8\n0, 1\n50, 3.1\n100, 4.8\n150, 7.2',test:'-75, -2\n25, 2\n125, 6',eta:.00005},
    {name:'一个离群点',description:'最后一个训练点被大幅上移，观察最小二乘直线受它影响。',train:'-2, -3\n-1, -1\n0, 1\n1, 3\n2, 5\n3, 16',test:'-1.5, -2\n0.5, 2\n2.5, 6',eta:.1}
  ];
  let lab={points:C.parsePoints(presets[0].train),test:C.parsePoints(presets[0].test),trainText:presets[0].train,testText:presets[0].test,w:0,b:0,eta:.1,steps:0,history:[],message:'先走一步，观察残差与损失如何变化。',description:presets[0].description};
  let helpers,draft=null;
  const $=s=>document.querySelector(s);
  const number=x=>Math.abs(x)>1e5 || (x!==0 && Math.abs(x)<.0001)?x.toExponential(3):Number(x.toFixed(5)).toString();
  function resetHistory() { lab.steps=0;lab.history=[{step:0,w:lab.w,b:lab.b,eta:null,loss:C.regression(lab.points,lab.w,lab.b).loss}]; }
  resetHistory();
  function pending(){
    const data=$('#ai-train').value!==lab.trainText || $('#ai-test').value!==lab.testText;
    const parameters=['w','b','eta'].some(key=>$('#ai-'+key).value.trim()==='' || Number($('#ai-'+key).value)!==lab[key]);
    return {data,parameters};
  }
  function updatePending(){
    const {data,parameters}=pending();
    $('#ai-pending').textContent=data?'数据文本尚未载入。图表仍对应上一次数据；先点击“载入数据并归零”。':parameters?'参数输入尚未应用。图表和指标仍对应上一次参数；应用参数或走一步后可导出。':'';
    for(const action of ['ai-step','ai-batch','ai-apply','ai-reset'])$(`[data-action="${action}"]`).disabled=data;
    for(const action of ['ai-export','ai-card'])$(`[data-action="${action}"]`).disabled=data || parameters;
  }
  function requireAppliedData(){if(pending().data)throw new Error('数据文本尚未载入，请先点击“载入数据并归零”。');}
  function requireCurrentRecord(){const p=pending();if(p.data || p.parameters)throw new Error('输入尚未应用，请先载入数据或应用参数，再导出当前实验。');}
  function renderApplied(){draft=null;helpers.render();}
  function renderView({heading,panelHeader,h}) {
    const r=C.regression(lab.points,lab.w,lab.b),best=C.leastSquares(lab.points),test=C.regression(lab.test,lab.w,lab.b),bound=C.learningRateBound(lab.points);
    return heading('LEARN BY CHANGING ONE THING','亲手走一步梯度下降。','调一条直线，看残差、梯度和训练损失怎样一起变化。', '<span class="pill blue">单变量线性回归 · 合成数据</span>') + `<div class="logic-layout ai-layout"><section class="panel">${panelHeader('实验设置','模型：ŷ = wx + b')}<div class="panel-body"><label>载入演示数据<select id="ai-preset"><option value="" disabled>当前为自定义数据</option>${presets.map((p,i)=>`<option value="${i}">${h(p.name)}</option>`).join('')}</select></label><p class="hint">${h(lab.description)}</p><div class="form-row"><label>斜率 w<input id="ai-w" type="number" step="any" value="${h(draft?.w??lab.w)}"></label><label>截距 b<input id="ai-b" type="number" step="any" value="${h(draft?.b??lab.b)}"></label></div><label>学习率 η<input id="ai-eta" type="number" min="0" max="10" step="any" value="${h(draft?.eta??lab.eta)}"></label><p class="hint">当前尺度的收敛界约为 η &lt; ${number(bound)}。${lab.eta>=bound?' 当前学习率超出此界，可能振荡或发散。':' 满足此界并不意味着几步内就收敛。'}</p><div class="ai-buttons"><button class="button primary" data-action="ai-step">走 1 步</button><button class="button" data-action="ai-batch">走 20 步</button><button class="button" data-action="ai-apply">应用手动参数</button><button class="button" data-action="ai-reset">参数归零</button></div><p id="ai-error" class="error-message" role="alert"></p><p id="ai-pending" class="hint" role="status"></p><div class="notes-callout"><strong>同步更新</strong><br>w ← w − η·∂L/∂w<br>b ← b − η·∂L/∂b<br>两个梯度都从同一组旧参数计算。<br><br>L = Σ(ŷ − y)² / (2m)，MSE = 2L。</div><details class="section-gap"><summary>编辑训练 / 测试数据</summary><label>训练点（每行 x, y）<textarea id="ai-train" rows="7">${h(draft?.train??lab.trainText)}</textarea></label><label>测试点（每行 x, y）<textarea id="ai-test" rows="4">${h(draft?.test??lab.testText)}</textarea></label><button class="button" data-action="ai-data">载入数据并归零</button><p class="source-note">每组 2–200 行，不接受表头。测试点只参与评估，不参与训练。</p></details></div></section><div class="stack"><section class="panel">${panelHeader('模型与观测点',h(lab.message),`<span class="pill">第 ${lab.steps} 步</span>`)}<div class="panel-body"><div class="formula-result"><span class="eyebrow">CURRENT MODEL</span><div class="formula">ŷ = ${number(lab.w)}x ${lab.b<0?'−':'+'} ${number(Math.abs(lab.b))}</div><div class="result-stats"><span>∂L/∂w = ${number(r.dw)}</span><span>∂L/∂b = ${number(r.db)}</span></div></div><div class="ai-metrics"><div><span>训练损失 L</span><strong id="ai-loss">${number(r.loss)}</strong></div><div><span>测试 MSE</span><strong>${number(test.mse)}</strong></div><div><span>最小二乘参考 L</span><strong>${number(best.loss)}</strong></div></div><canvas id="fit-canvas" class="plot-canvas" width="840" height="390" role="img" aria-label="蓝点为训练数据，橙色空心点为测试数据，蓝线为当前模型，虚线为最小二乘参考；灰色线段为训练残差。"></canvas><div class="kmap-legend"><span>● 训练点</span><span>○ 测试点</span><span>实线 · 当前模型</span><span>虚线 · 最小二乘参考</span></div><div class="ai-reference"><strong>最小二乘参考：</strong>w = ${number(best.w)}，b = ${number(best.b)}${best.unique?'':'（x 全相同，斜率无法唯一确定；显示 w=0 的一个最优解）'}</div></div></section><section class="panel">${panelHeader('损失轨迹','比较每一步，而不只比较最后一个答案。')}<div class="panel-body"><canvas id="loss-canvas" class="loss-canvas" width="840" height="230" role="img" aria-label="横轴为梯度下降步数，纵轴为训练损失；逐步训练后显示当前实验的损失轨迹。"></canvas><div class="result-actions"><button class="button primary" data-action="ai-export">导出实验记录</button><button class="button" data-action="ai-card">保存为回忆卡</button></div><details class="verification"><summary>查看逐点预测与残差</summary><div class="table-scroll"><table class="data-table"><thead><tr><th scope="col">x</th><th scope="col">y</th><th scope="col">ŷ</th><th scope="col">ŷ − y</th></tr></thead><tbody>${lab.points.map((p,i)=>`<tr><td>${number(p.x)}</td><td>${number(p.y)}</td><td>${number(lab.w*p.x+lab.b)}</td><td>${number(r.errors[i])}</td></tr>`).join('')}</tbody></table></div></details><div class="notes-callout"><strong>试三个问题</strong><br>① 学习率从 0.1 改为 0.8，会发生什么？<br>② 换成 x 放大 50 倍的样本，为什么学习率要变小？<br>③ 出现离群点时，训练最优是否仍代表好的测试表现？</div><p class="source-note">实验状态只保留在当前页面，刷新会重置；有用的结果可导出或存为复习卡。收敛界来自二次损失 Hessian 的最大特征值，使用当前训练数据计算。</p></div></section></div></div>`;
  }
  function drawPlot() {
    const canvas=$('#fit-canvas');if(!canvas)return;
    const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,pad={l:60,r:25,t:20,b:42},all=[...lab.points,...lab.test],xs=all.map(p=>p.x),ys=all.map(p=>p.y),best=C.leastSquares(lab.points);
    let xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);const dx=xmax-xmin||2,dy=ymax-ymin||2;xmin-=dx*.12;xmax+=dx*.12;ymin-=dy*.2;ymax+=dy*.2;
    ctx.font='16px Segoe UI, Microsoft YaHei';
    const yLabels=Array.from({length:5},(_,i)=>number(ymin+(ymax-ymin)*i/4));
    pad.l=Math.max(pad.l,Math.ceil(Math.max(...yLabels.map(label=>ctx.measureText(label).width)))+14,Math.ceil(ctx.measureText(number(xmin)).width/2)+12);
    pad.r=Math.max(pad.r,Math.ceil(ctx.measureText(number(xmax)).width/2)+12);
    const X=x=>pad.l+(x-xmin)/(xmax-xmin)*(W-pad.l-pad.r),Y=y=>H-pad.b-(y-ymin)/(ymax-ymin)*(H-pad.b-pad.t);
    ctx.clearRect(0,0,W,H);ctx.font='16px Segoe UI, Microsoft YaHei';ctx.lineWidth=1;ctx.textAlign='center';ctx.fillStyle='#64748b';
    for(let i=0;i<=4;i++){const x=xmin+(xmax-xmin)*i/4,y=ymin+(ymax-ymin)*i/4;ctx.strokeStyle='#e7edf5';ctx.beginPath();ctx.moveTo(X(x),pad.t);ctx.lineTo(X(x),H-pad.b);ctx.moveTo(pad.l,Y(y));ctx.lineTo(W-pad.r,Y(y));ctx.stroke();ctx.fillText(number(x),X(x),H-14);ctx.textAlign='right';ctx.fillText(number(y),pad.l-10,Y(y)+5);ctx.textAlign='center';}
    ctx.save();ctx.beginPath();ctx.rect(pad.l,pad.t,W-pad.l-pad.r,H-pad.t-pad.b);ctx.clip();
    function line(w,b,color,dash){
      let x1=xmin,x2=xmax,y1=w*xmin+b,y2=w*xmax+b;
      if(w===0){if(b<ymin || b>ymax)return;}
      else{
        const leftY=w>0?ymin:ymax,rightY=w>0?ymax:ymin,leftX=(leftY-b)/w,rightX=(rightY-b)/w;
        if(leftX>xmax || rightX<xmin)return;
        if(leftX>=xmin){x1=leftX;y1=leftY;}
        if(rightX<=xmax){x2=rightX;y2=rightY;}
      }
      ctx.strokeStyle=color;ctx.lineWidth=3;ctx.setLineDash(dash);ctx.beginPath();ctx.moveTo(X(x1),Y(y1));ctx.lineTo(X(x2),Y(y2));ctx.stroke();ctx.setLineDash([]);
    }
    line(best.w,best.b,'#99aecb',[7,7]);line(lab.w,lab.b,'#245cd8',[]);
    ctx.lineWidth=1.5;ctx.strokeStyle='#aebed4';for(const p of lab.points){ctx.beginPath();ctx.moveTo(X(p.x),Y(p.y));ctx.lineTo(X(p.x),Y(Math.max(ymin,Math.min(ymax,lab.w*p.x+lab.b))));ctx.stroke();}
    ctx.fillStyle='#245cd8';for(const p of lab.points){ctx.beginPath();ctx.arc(X(p.x),Y(p.y),6,0,Math.PI*2);ctx.fill();}
    ctx.strokeStyle='#b55b1b';ctx.lineWidth=3;for(const p of lab.test){ctx.beginPath();ctx.arc(X(p.x),Y(p.y),7,0,Math.PI*2);ctx.stroke();}
    ctx.restore();ctx.fillStyle='#64748b';ctx.textAlign='right';ctx.fillText('x',W-10,H-pad.b-5);ctx.textAlign='left';ctx.fillText('y',pad.l,14);
    drawLoss();
  }
  function drawLoss() {
    const canvas=$('#loss-canvas'),ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height,pad={l:74,r:25,t:20,b:38},max=Math.max(.001,...lab.history.map(x=>x.loss))*1.15,end=Math.max(1,lab.steps);
    ctx.font='16px Segoe UI';pad.l=Math.max(pad.l,Math.ceil(Math.max(...Array.from({length:4},(_,i)=>ctx.measureText(number(max*i/3)).width)))+14);
    const X=x=>pad.l+x/end*(W-pad.l-pad.r),Y=y=>H-pad.b-y/max*(H-pad.t-pad.b);
    ctx.clearRect(0,0,W,H);ctx.font='16px Segoe UI';ctx.fillStyle='#64748b';ctx.textAlign='right';ctx.lineWidth=1;
    for(let i=0;i<=3;i++){const y=max*i/3;ctx.strokeStyle='#e7edf5';ctx.beginPath();ctx.moveTo(pad.l,Y(y));ctx.lineTo(W-pad.r,Y(y));ctx.stroke();ctx.fillText(number(y),pad.l-9,Y(y)+5);}
    ctx.textAlign='center';for(const step of new Set(Array.from({length:5},(_,i)=>Math.round(end*i/4))))ctx.fillText(String(step),X(step),H-12);
    ctx.strokeStyle='#245cd8';ctx.lineWidth=3;ctx.beginPath();lab.history.forEach((p,i)=>{if(i)ctx.lineTo(X(p.step),Y(p.loss));else ctx.moveTo(X(p.step),Y(p.loss));});ctx.stroke();ctx.fillStyle='#245cd8';const p=lab.history[lab.history.length-1];ctx.beginPath();ctx.arc(X(p.step),Y(p.loss),4,0,Math.PI*2);ctx.fill();
  }
  function mount() {
    drawPlot();$('#ai-preset').selectedIndex=presets.findIndex(p=>p.train===lab.trainText)+1;
    for(const id of ['w','b','eta','train','test'])$('#ai-'+id).addEventListener('input',()=>{draft=Object.fromEntries(['w','b','eta','train','test'].map(key=>[key,$('#ai-'+key).value]));updatePending();});
    updatePending();
    $('#ai-preset').addEventListener('change',e=>{const p=presets[Number(e.target.value)];lab={...lab,points:C.parsePoints(p.train),test:C.parsePoints(p.test),trainText:p.train,testText:p.test,w:0,b:0,eta:p.eta,description:p.description,message:'已换一组数据；参数和轨迹归零。'};resetHistory();renderApplied();});
  }
  function params() {
    if(['ai-w','ai-b','ai-eta'].some(id=>!$('#'+id).value.trim()))throw new Error('w、b 和学习率均需填写数值。');
    const w=Number($('#ai-w').value),b=Number($('#ai-b').value),eta=learningRate();
    if(!Number.isFinite(w)||!Number.isFinite(b)||Math.abs(w)>1e8||Math.abs(b)>1e8)throw new Error('参数必须为有限数，绝对值不超过 1e8。');
    if(w!==lab.w||b!==lab.b){lab.w=w;lab.b=b;resetHistory();}lab.eta=eta;
  }
  function learningRate(){const raw=$('#ai-eta').value,eta=raw.trim()===''?NaN:Number(raw);if(!Number.isFinite(eta)||eta<=0||eta>10)throw new Error('学习率须大于 0 且不超过 10。');return eta;}
  function steps(count) {
    requireAppliedData();params();let completed=0;
    for(let i=0;i<count;i++){
      if(lab.steps>=2000){lab.message='已达到 2,000 步。导出记录后参数归零，可开始下一次比较。';break;}
      const next=C.gradientStep(lab.points,lab.w,lab.b,lab.eta);
      if(Math.abs(next.w)>1e8||Math.abs(next.b)>1e8||next.after.loss>1e12){lab.message='数值增长过大，本次更新未应用。请减小学习率，再走一步。';break;}
      lab.w=next.w;lab.b=next.b;lab.steps++;completed++;lab.history.push({step:lab.steps,w:lab.w,b:lab.b,eta:lab.eta,loss:next.after.loss});
      lab.message=next.after.loss>next.before.loss?'这一步损失上升了。检查学习率与特征尺度。':'这一步损失下降或保持不变。试着解释两个梯度的方向。';
    }
    renderApplied();if(!completed)helpers.toast(lab.message);
  }
  function record() {
    const r=C.regression(lab.points,lab.w,lab.b),best=C.leastSquares(lab.points),test=C.regression(lab.test,lab.w,lab.b);
    return ['# 单变量线性回归实验','',`模型：ŷ = ${number(lab.w)}x + (${number(lab.b)})`,`学习率 η = ${lab.eta}；步数 = ${lab.steps}`,'','损失定义：L = Σ(ŷ−y)²/(2m)；MSE = 2L。',`训练 L = ${number(r.loss)}；测试 MSE = ${number(test.mse)}`,`当前梯度：dw = ${number(r.dw)}，db = ${number(r.db)}`,`最小二乘参考：w=${number(best.w)}，b=${number(best.b)}，L=${number(best.loss)}`,'','## 训练数据','',...lab.points.map(p=>`${p.x}, ${p.y}`),'','## 测试数据（不用于训练）','',...lab.test.map(p=>`${p.x}, ${p.y}`),'','## 损失轨迹','', '| 步数 | w | b | 本步更新η | 训练 L |','|---:|---:|---:|---:|---:|',...lab.history.map(x=>`| ${x.step} | ${x.w} | ${x.b} | ${x.eta??'—'} | ${x.loss} |`),'','## 自己的解释','', '- 为什么本次学习率能收敛 / 不能收敛？','- 如果调整特征尺度，梯度和适用学习率怎样改变？','- 测试误差与训练最优是否一致？','', '数据为学习演示或用户输入，不用于真实决策。'].join('\n');
  }
  function actions(deps) {
    helpers=deps;
    const run=fn=>()=>{try{fn();}catch(e){if($('#ai-error'))$('#ai-error').textContent=e.message;helpers.toast(e.message);}};
    return {
      'ai-step':run(()=>steps(1)), 'ai-batch':run(()=>steps(20)),
      'ai-apply':run(()=>{requireAppliedData();params();lab.message='已应用手动参数，损失与残差已重新计算。';renderApplied();}),
      'ai-reset':run(()=>{requireAppliedData();const eta=learningRate();lab.w=0;lab.b=0;lab.eta=eta;lab.message='w、b和轨迹已归零，当前输入的学习率与训练数据保留。';resetHistory();renderApplied();}),
      'ai-data':run(()=>{const trainText=$('#ai-train').value,testText=$('#ai-test').value,points=C.parsePoints(trainText),test=C.parsePoints(testText),eta=learningRate();lab={...lab,points,test,trainText,testText,w:0,b:0,eta,description:'当前使用你输入的训练与测试数据。',message:'已载入新数据，w与b归零，当前输入的学习率保留。测试集没有参与训练。'};resetHistory();renderApplied();}),
      'ai-export':run(()=>{requireCurrentRecord();helpers.showText('线性回归实验记录',record(),'线性回归实验.md');}),
      'ai-card':run(()=>{requireCurrentRecord();helpers.addCard({question:'线性回归的梯度下降：同步更新 w、b 的公式是什么？学习率与特征尺度有什么关系？',answer:`L = Σ(wx+b−y)²/(2m)\ndw = Σ(wx+b−y)x/m；db = Σ(wx+b−y)/m。\n用同一组旧参数计算两个梯度，再同步更新。\n在本实验中，特征尺度与 Hessian 决定稳定学习率范围。当前界约为 ${number(C.learningRateBound(lab.points))}；η=${lab.eta}。\n最后训练 L=${number(C.regression(lab.points,lab.w,lab.b).loss)}，测试 MSE=${number(C.regression(lab.test,lab.w,lab.b).mse)}。`});})
    };
  }
  root.StudyAI={renderView,mount,actions};
})(globalThis);
