(function(root){
  'use strict';
  const C=StudyCore,$=s=>document.querySelector(s);
  let result,input=0,helpers;
  const blue='#245cd8',off='#5b6b81',ink='#172b49';
  function svg(){
    const w=780,rows=Math.max(1,result.selected.length),height=Math.max(180,rows*90+52),center=height/2,variables='ABCD'.slice(0,result.n),active=result.selected.map(g=>C.matches(g.pattern,input,result.n)),output=active.some(Boolean)?1:0;
    const bits=C.binary(input,result.n),text=(x,y,s,size=16,color=ink,extra='')=>`<text x="${x}" y="${y}" font-family="Segoe UI,Microsoft YaHei,sans-serif" font-size="${size}" fill="${color}" ${extra}>${helpers.h(s)}</text>`,wire=(x1,y1,x2,y2,on,mid=(x1+x2)/2)=>`<path d="M${x1} ${y1}H${mid}V${y2}H${x2}" fill="none" stroke="${on?blue:off}" stroke-width="${on?3:2}"/>`;
    const parts=[`<svg viewBox="0 0 ${w} ${height}" role="img" aria-label="与或式组合电路，输入${bits}，输出${output}"><title>与或式的逻辑级组合电路</title>`];
    if(!result.selected.length){parts.push(`<rect x="230" y="${center-25}" width="130" height="50" rx="10" fill="#f1f5fa" stroke="${off}"/>`,text(295,center+6,'常量 0',18,ink,'text-anchor="middle"'),wire(360,center,680,center,false),text(700,center+7,'F=0',20));}
    else{
      for(let k=0;k<rows;k++){
        const group=result.selected[k],y=50+k*90,on=active[k],literals=[...group.pattern].flatMap((bit,i)=>bit==='-'?[]:[{bit,index:i,label:bit==='0'?variables[i]+"'":variables[i],value:bit==='0'?1-Number(bits[i]):Number(bits[i])}]);
        parts.push(text(20,y-15,literals.length?'字面值输入':'常量输入',12,'#64748b'));
        if(!literals.length)parts.push(text(55,y+12,'1',18,blue),wire(100,y+5,280,y+5,true));
        for(let j=0;j<literals.length;j++){const v=literals[j],ly=y+j*15;parts.push(text(35,ly+6,`${v.label}=${v.value}`,14,v.value?blue:off),wire(95,ly,280,ly,v.value));}
        const orInput=center+(k-(rows-1)/2)*(50/Math.max(1,rows-1));
        parts.push(`<rect x="280" y="${y-20}" width="145" height="80" rx="12" fill="${on?'#edf3ff':'#f7f9fc'}" stroke="${on?blue:off}" stroke-width="2"/>`,text(352,y+12,literals.length>1?'与 AND':literals.length===1?'直通':'常量1',16,ink,'text-anchor="middle"'),text(352,y+38,`项${k+1} = ${on?1:0}`,13,on?blue:off,'text-anchor="middle"'),wire(425,y+20,550,orInput,on,448+k*10));
      }
      parts.push(`<rect x="550" y="${center-32}" width="95" height="64" rx="13" fill="${output?'#edf3ff':'#f7f9fc'}" stroke="${output?blue:off}" stroke-width="2"/>`,text(597,center+5,rows>1?'或 OR':'直通',17,ink,'text-anchor="middle"'),wire(645,center,690,center,output),text(700,center+7,`F=${output}`,22,output?blue:off));
    }
    parts.push('</svg>');return {markup:parts.join(''),output,bits};
  }
  function update(){const diagram=svg();$('#circuit-diagram').innerHTML=diagram.markup;$('#circuit-status').textContent=`输入 ${'ABCD'.slice(0,result.n)}=${diagram.bits}，F=${diagram.output}${result.dontCares.includes(input)?'（这个输入是无关项，题目不约束输出）':''}。蓝线表示1，灰线表示0。`;for(const button of document.querySelectorAll('[data-action="circuit-toggle"]')){const i=Number(button.dataset.index),value=diagram.bits[i];button.textContent=`${'ABCD'[i]} = ${value}`;button.setAttribute('aria-pressed',String(value==='1'));}}
  function mount(r){result=r;if(input>=2**r.n)input=0;const details=document.createElement('details');details.className='circuit-section verification';details.innerHTML='<summary>看一看：从表达式到与或门</summary><p class="hint">点击输入按钮切换0/1。反号输入先取反，各乘积项做与，最后做或。</p><div class="circuit-inputs">'+'ABCD'.slice(0,result.n).split('').map((v,i)=>`<button class="button" data-action="circuit-toggle" data-index="${i}" aria-label="切换输入${v}">${v}=0</button>`).join('')+'</div><div id="circuit-diagram" class="circuit-diagram"></div><p id="circuit-status" class="circuit-status" role="status"></p><div class="result-actions"><button class="button" data-action="circuit-verilog">下载 Verilog</button><button class="button" data-action="circuit-testbench">下载自检 testbench</button><button class="button ghost" data-action="circuit-code">查看代码</button></div><p class="source-note">这是逻辑级示意，不分析传播时延、毛刺或电气特性。矩形表示逻辑运算；与门可有多个输入。HDL代码尚未在本机编译，testbench只断言非无关输入。</p>';$('#logic-result .panel-body').append(details);update();}
  function actions(deps){helpers=deps;return{
    'circuit-toggle':el=>{input ^= 1<<(result.n-1-Number(el.dataset.index));update();},
    'circuit-verilog':()=>helpers.download(C.toVerilog(result),'logic_function.v'),
    'circuit-testbench':()=>helpers.download(C.toTestbench(result),'logic_function_tb.v'),
    'circuit-code':()=>helpers.showText('组合逻辑 Verilog 与自检代码','```verilog\n'+C.toVerilog(result)+'```\n\n```verilog\n'+C.toTestbench(result)+'```\n\n可在安装了Icarus Verilog的环境中运行：\n\n```text\niverilog -o simulation logic_function.v logic_function_tb.v\nvvp simulation\n```\n\n本工作台没有自动执行HDL编译或仿真。','组合逻辑代码.md')
  };}
  root.StudyCircuit={mount,actions};
})(globalThis);
