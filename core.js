(function (root) {
  'use strict';
  const BACKUP_FILE_LIMIT = 64 * 1024 * 1024;
  const DAY = 86400000;
  const gray = bits => Array.from({ length: 2 ** bits }, (_, i) => i ^ (i >> 1));
  function checkVariables(n) {
    if (!Number.isInteger(n) || n < 2 || n > 4) throw new Error('请选择 2、3 或 4 个变量。');
  }
  function parseTerms(text, n) {
    checkVariables(n);
    if (typeof text !== 'string') throw new Error('最小项必须是文本。');
    if (!text.trim()) return [];
    if (!/^\s*\d+(?:[\s,，;；]+\d+)*\s*$/.test(text)) throw new Error('只接受非负整数，用逗号或空格分隔；不要输入表达式或区间。');
    const terms = text.trim().split(/[\s,，;；]+/).map(Number);
    if (terms.some(x => !Number.isSafeInteger(x) || x >= 2 ** n)) throw new Error(`编号须在 0 至 ${2 ** n - 1} 之间。`);
    return [...new Set(terms)].sort((a, b) => a - b);
  }
  const binary = (value, n) => value.toString(2).padStart(n, '0');
  const matches = (pattern, value, n) => [...pattern].every((c, i) => c === '-' || c === binary(value, n)[i]);
  function expressionToTerms(source,n) {
    checkVariables(n);
    if(typeof source!=='string' || !source.trim() || source.length>1000)throw new Error('请填写不超过1000字符的逻辑表达式。');
    const normalized=source.toUpperCase().replace(/[′’]/g,"'").replace(/\s/g,'');
    const tokens=[...normalized];let at=0,depth=0;
    if(tokens.length>256)throw new Error('表达式过长，请拆成较小的部分。');
    if(tokens.some(x=>!"ABCD01+|^⊕·*&!~()'".includes(x)))throw new Error("不支持的符号。可用 A–D、0/1、与·或+、取反!或'、异或^、括号；无需输入F=。");
    const peek=()=>tokens[at],take=()=>tokens[at++];
    function primary(){
      let node;const t=take();
      if(t==='('){if(++depth>32)throw new Error('括号嵌套过深。');node=or();if(take()!==')')throw new Error('括号不匹配。');depth--;}
      else if('ABCD'.includes(t||'~')){const index='ABCD'.indexOf(t);if(index>=n)throw new Error(`当前仅有 ${'ABCD'.slice(0,n)}，表达式却使用了 ${t}。`);node={kind:'var',index};}
      else if(t==='0'||t==='1')node={kind:'const',value:Number(t)};
      else throw new Error('表达式缺少变量或括号内的内容。');
      while(peek()==="'"){take();node={kind:'not',a:node};}return node;
    }
    function unary(){if(peek()==='!'||peek()==='~'){take();return {kind:'not',a:unary()};}return primary();}
    function and(){let node=unary();while(['·','*','&'].includes(peek()) || ['A','B','C','D','0','1','(','!','~'].includes(peek())){if(['·','*','&'].includes(peek()))take();node={kind:'and',a:node,b:unary()};}return node;}
    function xor(){let node=and();while(peek()==='^'||peek()==='⊕'){take();node={kind:'xor',a:node,b:and()};}return node;}
    function or(){let node=xor();while(peek()==='+'||peek()==='|'){take();node={kind:'or',a:node,b:xor()};}return node;}
    const ast=or();if(at!==tokens.length)throw new Error('表达式含多余括号或运算符。');
    function evaluate(node,value){switch(node.kind){case'var':return (value>>(n-1-node.index))&1;case'const':return node.value;case'not':return 1-evaluate(node.a,value);case'and':return evaluate(node.a,value)&evaluate(node.b,value);case'xor':return evaluate(node.a,value)^evaluate(node.b,value);case'or':return evaluate(node.a,value)|evaluate(node.b,value);}}
    const ones=Array.from({length:2**n},(_,i)=>i).filter(i=>evaluate(ast,i)===1);
    return {ones,normalized,ast};
  }
  function validateGroup(n,cells,ones,dc=[]) {
    checkVariables(n);
    if(!Array.isArray(cells)||!cells.length)throw new Error('先选中一个或多个格子。');
    if(cells.some(x=>!Number.isInteger(x)||x<0||x>=2**n))throw new Error('分组编号无效。');
    cells=[...new Set(cells)].sort((a,b)=>a-b);
    if((cells.length & (cells.length-1))!==0)throw new Error('组的格数必须是2的幂，不能圈3格或6格。');
    if(cells.some(x=>!ones.includes(x)&&!dc.includes(x)))throw new Error('这个组包含0，只能使用1和题目允许的无关项。');
    if(!cells.some(x=>ones.includes(x)))throw new Error('这个组没有实际的1；只含无关项的组不需要加入表达式。');
    const patterns=cells.map(x=>binary(x,n)),pattern=Array.from({length:n},(_,i)=>patterns.every(x=>x[i]===patterns[0][i])?patterns[0][i]:'-').join('');
    const implied=Array.from({length:2**n},(_,i)=>i).filter(i=>matches(pattern,i,n));
    if(implied.length!==cells.length || implied.some(x=>!cells.includes(x)))throw new Error('选中的格子不是一个合法相邻组；应只让完整的变量组合变化。注意首尾相邻，但不能只圈对角线。');
    return {pattern,cells,text:termText(pattern),literals:[...pattern].filter(x=>x!=='-').length};
  }
  function assessGroups(n,groups,ones,dc=[]) {
    if(!Array.isArray(groups)||groups.length>32)throw new Error('最多保留32个组。');
    const validated=groups.map(g=>validateGroup(n,g.cells,ones,dc)),covered=new Set(validated.flatMap(g=>g.cells)),missing=ones.filter(i=>!covered.has(i)),best=minimize(n,ones,dc),literals=validated.reduce((s,g)=>s+g.literals,0);
    return {groups:validated,missing,complete:missing.length===0,optimal:missing.length===0 && validated.length===best.selected.length && literals===best.literals,literals,terms:validated.length,bestTerms:best.selected.length,bestLiterals:best.literals,expression:validated.map(g=>g.text).join(' + ') || '0'};
  }
  function termText(pattern, latex = false) {
    const chars = [...pattern].flatMap((bit, i) => bit === '-' ? [] : [bit === '1' ? 'ABCD'[i] : latex ? `\\overline{${'ABCD'[i]}}` : `${'ABCD'[i]}'`]);
    return chars.join(latex ? '' : '·') || '1';
  }
  function minimize(n, ones, dontCares = []) {
    checkVariables(n);
    for (const list of [ones, dontCares]) {
      if (!Array.isArray(list) || list.some(x => !Number.isInteger(x) || x < 0 || x >= 2 ** n)) throw new Error('最小项或无关项编号无效。');
    }
    ones = [...new Set(ones)].sort((a, b) => a - b);
    dontCares = [...new Set(dontCares)].sort((a, b) => a - b);
    if (ones.some(x => dontCares.includes(x))) throw new Error('最小项与无关项不能重叠，请先移除重复编号。');
    const full = Array.from({ length: 2 ** n }, (_, i) => i);
    const allowed = new Set([...ones, ...dontCares]);
    const cubes = [];
    function enumerate(pattern) {
      if (pattern.length < n) { for (const c of ['-', '0', '1']) enumerate(pattern + c); return; }
      const cells = full.filter(x => matches(pattern, x, n));
      if (!cells.every(x => allowed.has(x)) || !cells.some(x => ones.includes(x))) return;
      cubes.push({ pattern, cells, mask: cells.reduce((m, x) => m | (1 << x), 0), onMask: cells.filter(x => ones.includes(x)).reduce((m, x) => m | (1 << x), 0), literals: [...pattern].filter(x => x !== '-').length, text: termText(pattern), latex: termText(pattern, true) });
    }
    enumerate('');
    const primes = cubes.filter(c => !cubes.some(d => c !== d && d.literals < c.literals && (c.mask & d.mask) === c.mask));
    const memo = new Map([[0, []]]);
    const score = list => [list.length, list.reduce((s, i) => s + primes[i].literals, 0), list.map(i => primes[i].pattern).sort().join('|')];
    const better = (a, b) => { if (b === null) return true; const x = score(a), y = score(b); return x[0] < y[0] || (x[0] === y[0] && (x[1] < y[1] || (x[1] === y[1] && x[2] < y[2]))); };
    function cover(remaining) {
      if (memo.has(remaining)) return memo.get(remaining);
      let choices = null;
      for (const x of ones) if (remaining & (1 << x)) {
        const indices = primes.map((p, i) => p.onMask & (1 << x) ? i : -1).filter(i => i >= 0);
        if (choices === null || indices.length < choices.length) choices = indices;
      }
      let best = null;
      for (const i of choices) {
        const candidate = [...cover(remaining & ~primes[i].onMask), i].sort((a, b) => a - b);
        if (better(candidate, best)) best = candidate;
      }
      memo.set(remaining, best); return best;
    }
    const selected = cover(ones.reduce((m, x) => m | (1 << x), 0)).map(i => primes[i]);
    const table = full.map(value => ({ value, bits: binary(value, n), expected: dontCares.includes(value) ? '×' : ones.includes(value) ? 1 : 0, actual: selected.some(c => matches(c.pattern, value, n)) ? 1 : 0 }));
    return { n, ones, dontCares, primes, selected, expression: selected.map(x => x.text).join(' + ') || '0', latex: selected.map(x => x.latex).join('+') || '0', literals: selected.reduce((s, x) => s + x.literals, 0), table, verified: table.every(x => x.expected === '×' || x.expected === x.actual) };
  }
  function kmap(n) {
    checkVariables(n);
    const rowBits = Math.floor(n / 2), colBits = n - rowBits;
    const rows = gray(rowBits), cols = gray(colBits);
    return { rowLabel: 'ABCD'.slice(0, rowBits), colLabel: 'ABCD'.slice(rowBits, n), rows: rows.map(x => binary(x, rowBits)), cols: cols.map(x => binary(x, colBits)), cells: rows.map(r => cols.map(c => (r << colBits) | c)) };
  }
  function toMarkdown(result) {
    const map = kmap(result.n);
    const badges = '①②③④⑤⑥⑦⑧⑨⑩';
    const value = i => result.dontCares.includes(i) ? '×' : result.ones.includes(i) ? '1' : '0';
    const rows = map.cells.map((row, r) => `| ${map.rows[r]} | ${row.map(i => `${value(i)}${result.selected.map((g, k) => g.cells.includes(i) ? badges[k] || `[${k + 1}]` : '').join('')}`).join(' | ')} |`);
    return [`# 卡诺图化简`, '', `变量顺序：${'ABCD'.slice(0, result.n)}（左侧为高位）`, '', `F = Σm(${result.ones.join(', ') || '空集'})${result.dontCares.length ? `，无关项 d = Σd(${result.dontCares.join(', ')})` : ''}`, '', `| ${map.rowLabel} \\ ${map.colLabel} | ${map.cols.join(' | ')} |`, `|---|${map.cols.map(() => '---:|').join('')}`, ...rows, '', '## 分组', '', ...(result.selected.length ? result.selected.map((g, k) => `${badges[k] || k + 1}：(${g.cells.map(x => `m${x}${result.dontCares.includes(x) ? '(无关项)' : ''}`).join(', ')}) → ${g.text}`) : ['无值为 1 的最小项，取 F = 0。']), '', `## 最简与或式`, '', `F = ${result.expression}`, '', `$$F = ${result.latex}$$`, '', `真值验证：${result.verified ? '通过' : '失败'}（无关项不参与一致性要求）。`, '优化顺序：先最少乘积项，再最少文字数；等价最简式可能不唯一。', '编号标记表示分组，重复标记表示该格参与多个组。'].join('\n');
  }
  function toSvg(result) {
    const map=kmap(result.n),colors=['#245cd8','#ab5919','#007b70','#914bc2','#b53b66','#45754f','#6655b5','#466881'];
    const cw=128,ch=100,gap=8,left=112,width=left+map.cols.length*(cw+gap)+48;
    const formulaLines=['F = '],limit=Math.floor((width-64)/13);
    for(const term of result.selected.length?result.selected.map(g=>g.text):['0']){const last=formulaLines.length-1,addition=(formulaLines[last]==='F = '? '':' + ')+term;if(formulaLines[last].length+addition.length>limit)formulaLines.push('+ '+term);else formulaLines[last]+=addition;}
    const top=130+(formulaLines.length-1)*36,legendTop=top+map.rows.length*(ch+gap)+48,height=legendTop+result.selected.length*34+105;
    const xml=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
    const text=(x,y,value,size=18,color='#172b49',extra='')=>`<text x="${x}" y="${y}" font-size="${size}" fill="${color}" ${extra}>${xml(value)}</text>`;
    const svg=[`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img"><title>卡诺图分组与化简结果</title><desc>每种颜色表示一个卡诺组。同色分段框表示跨边界相邻，格子中的编号表示参与的组。</desc><rect width="100%" height="100%" fill="#fff"/><g font-family="Segoe UI,Microsoft YaHei,sans-serif">`,text(32,42,'卡诺图 · 分组与化简',26),...formulaLines.map((line,i)=>text(32,78+i*36,line,24,'#245cd8')),text(left-12,top-18,`${map.rowLabel} \\ ${map.colLabel}`,16,'#64748b','text-anchor="end"')];
    map.cols.forEach((col,c)=>svg.push(text(left+c*(cw+gap)+cw/2,top-18,col,18,'#64748b','text-anchor="middle"')));
    map.cells.forEach((row,r)=>{
      svg.push(text(left-24,top+r*(ch+gap)+ch/2+6,map.rows[r],18,'#64748b','text-anchor="end"'));
      row.forEach((i,c)=>{
        const x=left+c*(cw+gap),y=top+r*(ch+gap),value=result.dontCares.includes(i)?'×':result.ones.includes(i)?'1':'0',groups=result.selected.map((g,k)=>g.cells.includes(i)?k:-1).filter(k=>k>=0);
        svg.push(`<rect x="${x}" y="${y}" width="${cw}" height="${ch}" rx="8" fill="${value==='1'?'#f0f5ff':value==='×'?'#fff7ed':'#fafcff'}" stroke="#dce5f1"/>`,text(x+13,y+23,`m${i}`,13,'#64748b'),text(x+cw/2,y+60,value,30,'#172b49','text-anchor="middle"'));
        groups.forEach((k,j)=>svg.push(text(x+cw/2+(j-(groups.length-1)/2)*23,y+84,String(k+1),15,colors[k%8],'text-anchor="middle" font-weight="700"')));
      });
    });
    function runs(values){const out=[];for(const v of values){const last=out[out.length-1];if(last && v===last[last.length-1]+1)last.push(v);else out.push([v]);}return out;}
    result.selected.forEach((group,k)=>{
      const rowIds=map.cells.map((row,r)=>row.some(i=>group.cells.includes(i))?r:-1).filter(r=>r>=0),colIds=map.cols.map((_,c)=>map.cells.some(row=>group.cells.includes(row[c]))?c:-1).filter(c=>c>=0),rr=runs(rowIds),cc=runs(colIds),inset=3+(k%4)*3;
      for(const row of rr)for(const col of cc){const x=left+col[0]*(cw+gap)+inset,y=top+row[0]*(ch+gap)+inset,w=col.length*(cw+gap)-gap-2*inset,h=row.length*(ch+gap)-gap-2*inset;svg.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="15" fill="none" stroke="${colors[k%8]}" stroke-width="2.7" ${rr.length>1||cc.length>1?'stroke-dasharray="8 4"':''}/>`);}
      svg.push(text(32,legendTop+k*34,`${k+1}  m(${group.cells.join(', ')}) → ${group.text}`,17,colors[k%8]));
    });
    svg.push(text(32,height-57,'同色虚线框：跨边界同一组；数字：组号。',14,'#64748b'),text(32,height-29,`最少项数 → 最少文字数 · ${result.verified?'真值验证通过':'验证失败'}`,14,'#64748b'),'</g></svg>');
    return svg.join('\n');
  }
  function toVerilog(result) {
    checkVariables(result.n);
    const variables='ABCD'.slice(0,result.n).split('');
    const terms=result.selected.map(g=>{const literals=[...g.pattern].flatMap((bit,i)=>bit==='-'?[]:[bit==='0'?`~${variables[i]}`:variables[i]]);return literals.length?'('+literals.join(' & ')+')':"1'b1";});
    return [`// Generated combinational logic; A is the most significant input.`, `// Don't-care inputs are allowed to take either output value.`, '// This file has not been compiled automatically by the workbench.', 'module logic_function(',...variables.map(v=>`  input wire ${v},`),'  output wire F',');',`  assign F = ${terms.join(' | ') || "1'b0"};`,'endmodule',''].join('\n');
  }
  function toTestbench(result) {
    const variables='ABCD'.slice(0,result.n).split(''),vector='{'+variables.join(', ')+'}';
    return ['`timescale 1ns / 1ps','module logic_function_tb;',`  reg ${variables.join(', ')};`,'  wire F;','  integer i;','  integer failures;',`  logic_function dut (${variables.map(v=>'.'+v+'('+v+')').join(', ')}, .F(F));`,'  initial begin','    failures = 0;',`    for (i = 0; i < ${2**result.n}; i = i + 1) begin`,`      ${vector} = i;`,'      #1;',`      case (${vector})`,...result.table.filter(x=>x.expected!=='×').map(x=>`        ${result.n}'d${x.value}: if (F !== 1'b${x.expected}) begin failures = failures + 1; $display("Mismatch at input %0d", i); end`),'        default: ; // Don\'t-care inputs are not asserted.','      endcase','    end','    if (failures == 0) $display("PASS: all constrained inputs match");','    else $display("FAIL: %0d mismatches", failures);','    $finish;','  end','endmodule',''].join('\n');
  }
  function dateKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }
  function reviewNext(previous, rating, now = Date.now()) {
    if (!['again', 'hard', 'good', 'easy'].includes(rating)) throw new Error('复习评分无效。');
    const level = previous?.level || 0;
    const nextLevel = rating === 'again' ? 0 : rating === 'hard' ? Math.max(0, level - 1) : Math.min(6, level + (rating === 'easy' ? 2 : 1));
    const days = rating === 'hard' ? 1 : [0, 1, 3, 7, 14, 30, 60][nextLevel];
    return { level: nextLevel, dueAt: now + (rating === 'again' ? 600000 : days * DAY), lastAt: now, attempts: (previous?.attempts || 0) + 1, lapses: (previous?.lapses || 0) + (rating === 'again' ? 1 : 0) };
  }
  function countText(text) {
    const chars = Array.from(text);
    return { total: chars.length, noWhitespace: chars.filter(x => !/\s/u.test(x)).length, chinese: chars.filter(x => /\p{Script=Han}/u.test(x)).length, words: (text.match(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g) || []).length };
  }
  function checkPoints(points) {
    if(!Array.isArray(points) || points.length < 2 || points.length > 200 || points.some(p=>!p || !Number.isFinite(p.x) || !Number.isFinite(p.y) || Math.abs(p.x)>100000 || Math.abs(p.y)>100000))throw new Error('请输入 2–200 行有限的 x、y 数值，每个数的绝对值不超过 100000。');
  }
  function parsePoints(text) {
    if(typeof text!=='string')throw new Error('数据必须为文本。');
    const rows=text.trim().split(/\r?\n/).filter(x=>x.trim());
    const points=rows.map((row,i)=>{const pair=row.trim().split(/[,，\s]+/);if(pair.length!==2 || pair.some(x=>!/^[-+]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[-+]?\d+)?$/i.test(x)))throw new Error(`第 ${i+1} 行格式无效，请写两个数：x, y。`);return {x:Number(pair[0]),y:Number(pair[1])};});
    checkPoints(points);return points;
  }
  function regression(points, w, b) {
    checkPoints(points);
    if(!Number.isFinite(w) || !Number.isFinite(b))throw new Error('模型参数必须是有限数值。');
    const errors=points.map(p=>w*p.x+b-p.y), m=points.length;
    const loss=errors.reduce((s,e)=>s+e*e,0)/(2*m), dw=errors.reduce((s,e,i)=>s+e*points[i].x,0)/m, db=errors.reduce((s,e)=>s+e,0)/m;
    if(![loss,dw,db].every(Number.isFinite))throw new Error('计算溢出，请缩小学习率或数据尺度。');
    return {loss,mse:loss*2,dw,db,errors};
  }
  function gradientStep(points, w, b, eta) {
    if(!Number.isFinite(eta)||eta<=0||eta>10)throw new Error('学习率须大于 0 且不超过 10。');
    const before=regression(points,w,b), nw=w-eta*before.dw, nb=b-eta*before.db;
    const after=regression(points,nw,nb);
    return {w:nw,b:nb,before,after};
  }
  function leastSquares(points) {
    checkPoints(points);const m=points.length, mx=points.reduce((s,p)=>s+p.x,0)/m,my=points.reduce((s,p)=>s+p.y,0)/m;
    const xx=points.reduce((s,p)=>s+(p.x-mx)**2,0),xy=points.reduce((s,p)=>s+(p.x-mx)*(p.y-my),0);
    const w=xx===0?0:xy/xx,b=my-w*mx;
    return {w,b,unique:xx!==0,loss:regression(points,w,b).loss};
  }
  function learningRateBound(points) {
    checkPoints(points);const m=points.length,a=points.reduce((s,p)=>s+p.x*p.x,0)/m,c=points.reduce((s,p)=>s+p.x,0)/m;
    const largest=(a+1+Math.sqrt((a-1)**2+4*c*c))/2;
    return 2/largest;
  }
  function classifyDigit(pixels,models,kind='network') {
    if(!Array.isArray(pixels)||pixels.length!==64||pixels.some(x=>!Number.isFinite(x)||x<0||x>16))throw new Error('数字图像必须是64个0–16范围内的数值。');
    if(!['linear','network'].includes(kind))throw new Error('分类模型无效。');
    const x=pixels.map(p=>p/16);let scores,hidden=[];
    if(kind==='linear')scores=models.linear.weights.map((row,k)=>row.reduce((s,v,i)=>s+v*x[i],models.linear.bias[k]));
    else{const model=models.network;hidden=model.bias1.map((b,j)=>Math.max(0,x.reduce((s,v,i)=>s+v*model.weights1[i][j],b)));scores=model.bias2.map((b,j)=>hidden.reduce((s,v,i)=>s+v*model.weights2[i][j],b));}
    if(scores.length!==10 || scores.some(x=>!Number.isFinite(x)))throw new Error('模型权重或前向计算无效。');
    const max=Math.max(...scores),exp=scores.map(x=>Math.exp(x-max)),sum=exp.reduce((a,b)=>a+b,0),probabilities=exp.map(x=>x/sum),prediction=probabilities.indexOf(Math.max(...probabilities));
    return {prediction,probabilities,scores,hidden};
  }
  function initialState() {
    return { version: 1, tasks: [], reviews: {}, cards: [], sessions: [], experiences: [], drafts: '', settings: { focusMinutes: 25, name: '北邮 AI 2025' }, timer: null };
  }
  function parseCardBatch(text,topic) {
    if(typeof text!=='string'||!text.trim())throw new Error('请先填写问答文本。');
    if(text.length>500000)throw new Error('文本过长，请分批录入。');
    if(typeof topic!=='string'||!topic.trim()||topic.length>100)throw new Error('请选择有效的课程方向。');
    const blocks=text.replace(/\r\n?/g,'\n').trim().split(/^\s*---\s*$/m);
    if(blocks.length>100)throw new Error('每次最多100张卡，请分批录入。');
    return blocks.map((block,index)=>{
      const lines=block.trim().split('\n'),error=message=>{throw new Error(`第${index+1}张：${message}`);};
      if(!/^问[：:]/.test(lines[0]))error('第一行应以“问：”开始。');
      const answerAt=lines.findIndex(line=>/^答[：:]/.test(line));
      if(answerAt<1)error('缺少单独以“答：”开始的答案行。');
      if(lines.slice(1).some(line=>/^问[：:]/.test(line))||lines.filter(line=>/^答[：:]/.test(line)).length!==1)error('一个分隔块只能有一组“问：/答：”。');
      const question=[lines[0].replace(/^问[：:]/,''),...lines.slice(1,answerAt)].join('\n').trim(),answer=[lines[answerAt].replace(/^答[：:]/,''),...lines.slice(answerAt+1)].join('\n').trim();
      if(!question||!answer)error('问题和答案均不能为空。');
      if(question.length>1000||answer.length>4000)error('问题或答案过长，请精简或拆成多张卡。');
      return {question,answer,topic:topic.trim()};
    });
  }
  function classificationMetrics(counts){
    for(const key of ['tp','fp','fn','tn'])if(!Number.isSafeInteger(counts?.[key])||counts[key]<0||counts[key]>1e9)throw new Error('四格均请输入0–10亿之间的整数，不能留空。');
    const {tp,fp,fn,tn}=counts,total=tp+fp+fn+tn,ratio=(a,b)=>b===0?null:a/b;
    const recall=ratio(tp,tp+fn),specificity=ratio(tn,tn+fp);
    return {total,actualPositive:tp+fn,actualNegative:tn+fp,predictedPositive:tp+fp,predictedNegative:tn+fn,
      accuracy:ratio(tp+tn,total),precision:ratio(tp,tp+fp),recall,f1:ratio(2*tp,2*tp+fp+fn),specificity,
      balancedAccuracy:recall===null||specificity===null?null:(recall+specificity)/2,
      prevalence:ratio(tp+fn,total),majorityBaseline:ratio(Math.max(tp+fn,tn+fp),total)};
  }
  function deduplicateCards(batch,existing) {
    const key=card=>JSON.stringify([card.topic,card.question,card.answer]),seen=new Set(existing.map(key)),fresh=[];
    let duplicates=0;
    for(const card of batch){const value=key(card);if(seen.has(value))duplicates++;else{seen.add(value);fresh.push(card);}}
    return {fresh,duplicates};
  }
  function validDate(x) {
    if (x === '') return true;
    if (typeof x !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(x)) return false;
    const [y, m, d] = x.split('-').map(Number), date = new Date(y, m - 1, d);
    return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
  }
  function validateState(input) {
    const fail = () => { throw new Error('备份格式或字段不合法，当前数据未修改。请使用本工作台导出的 JSON 文件。'); };
    const str = (x, max = 4000) => typeof x === 'string' && x.length <= max;
    const num = x => typeof x === 'number' && Number.isFinite(x) && x >= 0;
    const time = x => num(x) && Number.isInteger(x) && x <= 8640000000000000;
    const id = x => str(x, 100) && /^[\w-]+$/.test(x) && x!=='prototype' && !Object.hasOwn(Object.prototype,x);
    const list = (x, max, check) => Array.isArray(x) && x.length <= max && x.every(check) && new Set(x.map(v => v.id)).size === x.length;
    if (!input || input.version !== 1 || !str(input.drafts, 30000) || !input.settings || !str(input.settings.name, 100) || !Number.isInteger(input.settings.focusMinutes) || input.settings.focusMinutes < 1 || input.settings.focusMinutes > 180) fail();
    if (!list(input.tasks, 1000, x => x && id(x.id) && str(x.title, 300) && x.title.trim() && str(x.course, 100) && validDate(x.due) && ['high', 'normal', 'low'].includes(x.priority) && typeof x.done === 'boolean' && time(x.createdAt))) fail();
    if (!list(input.cards, 500, x => x && id(x.id) && str(x.question, 1000) && x.question.trim() && str(x.answer, 4000) && x.answer.trim() && str(x.topic, 100))) fail();
    if (!list(input.sessions, 5000, x => x && id(x.id) && time(x.endedAt) && Number.isInteger(x.minutes) && x.minutes >= 1 && x.minutes <= 180 && str(x.topic, 300))) fail();
    if (!list(input.experiences, 1000, x => x && id(x.id) && str(x.title, 300) && x.title.trim() && ['学习', '竞赛', '学生工作', '体育', '志愿服务', '科研'].includes(x.category) && validDate(x.date) && str(x.detail, 4000) && str(x.evidence, 1000))) fail();
    if (!input.reviews || typeof input.reviews !== 'object' || Array.isArray(input.reviews) || Object.keys(input.reviews).length > 1000) fail();
    for (const [key, x] of Object.entries(input.reviews)) {
      if (!id(key) || !x || !Number.isInteger(x.level) || x.level < 0 || x.level > 6 || !time(x.dueAt) || !time(x.lastAt) || !Number.isInteger(x.attempts) || x.attempts < 0 || x.attempts > 1000000 || !Number.isInteger(x.lapses) || x.lapses < 0 || x.lapses > x.attempts) fail();
    }
    if (input.timer !== null) {
      const t = input.timer;
      if (!t || !id(t.id) || !['running', 'paused'].includes(t.status) || !time(t.endsAt) || !Number.isInteger(t.remainingSeconds) || t.remainingSeconds < 0 || t.remainingSeconds > t.minutes*60 || !Number.isInteger(t.minutes) || t.minutes < 1 || t.minutes > 180 || !str(t.topic, 300)) fail();
    }
    // 只保留已定义字段，导入数据不携带可执行内容或原型属性。
    const clean = initialState();
    const fields = { tasks: ['id', 'title', 'course', 'due', 'priority', 'done', 'createdAt'], cards: ['id', 'question', 'answer', 'topic'], sessions: ['id', 'endedAt', 'minutes', 'topic'], experiences: ['id', 'title', 'category', 'date', 'detail', 'evidence'] };
    for (const [key, names] of Object.entries(fields)) clean[key] = input[key].map(x => Object.fromEntries(names.map(n => [n, x[n]])));
    clean.drafts = input.drafts;
    clean.settings = { name: input.settings.name, focusMinutes: input.settings.focusMinutes };
    clean.reviews = Object.fromEntries(Object.entries(input.reviews).map(([key, x]) => [key, { level: x.level, dueAt: x.dueAt, lastAt: x.lastAt, attempts: x.attempts, lapses: x.lapses }]));
    clean.timer = input.timer ? Object.fromEntries(['id', 'status', 'endsAt', 'remainingSeconds', 'minutes', 'topic'].map(k => [k, input.timer[k]])) : null;
    return clean;
  }
  const api = { gray, binary, matches, termText, expressionToTerms, validateGroup, assessGroups, parseTerms, minimize, kmap, toMarkdown, toSvg, toVerilog, toTestbench, dateKey, reviewNext, countText, parsePoints, regression, gradientStep, leastSquares, learningRateBound, classifyDigit, classificationMetrics, parseCardBatch, deduplicateCards, initialState, validateState, validDate, DAY, BACKUP_FILE_LIMIT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.StudyCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
