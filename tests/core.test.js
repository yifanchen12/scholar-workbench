'use strict';
const assert = require('node:assert/strict');
const C = require('../core');
require('../content');
let checks = 0;
function check(fn) { fn(); checks++; }
check(() => { assert.deepEqual(C.parseTerms('0， 2 2; 8；10', 4), [0, 2, 8, 10]); assert.throws(() => C.parseTerms('2abc', 4)); assert.throws(() => C.parseTerms('16', 4)); assert.throws(() => C.parseTerms('1,,', 4)); assert.throws(() => C.parseTerms('-1', 4)); });
check(() => { assert.throws(() => C.minimize(4, [1], [1])); assert.throws(() => C.minimize(5, [])); assert.equal(C.minimize(4, [], [0]).expression, '0'); assert.equal(C.minimize(3, [0,1,2,3,4,5,6,7]).expression, '1'); assert.equal(C.minimize(4, [0,2,8,10]).expression, "B′·D′".replaceAll('′', "'")); });
// 独立穷举所有立方体，再用子集动态规划核对最优项数和文字数。
function oracle(n, ones, dc) {
  const allowed = new Set([...ones, ...dc]), full = Array.from({length: 2 ** n}, (_, i) => i), costs = new Map([[0,[0,0]]]);
  const cubes = [];
  for (let code = 0; code < 3 ** n; code++) {
    let v = code, fixed = 0, wanted = 0, literals = 0;
    for (let j = 0; j < n; j++) { const trit = v % 3; v = Math.floor(v / 3); if (trit < 2) { fixed |= 1 << j; wanted |= trit << j; literals++; } }
    const cells = full.filter(x => (x & fixed) === wanted);
    if (cells.some(x => !allowed.has(x))) continue;
    const mask = ones.reduce((m, x, i) => cells.includes(x) ? m | (1 << i) : m, 0);
    if (mask) cubes.push([mask, literals]);
  }
  for (let mask = 0; mask < 2 ** ones.length; mask++) if (costs.has(mask)) for (const [add, literals] of cubes) {
    const next = mask | add, cost = [costs.get(mask)[0]+1,costs.get(mask)[1]+literals], old = costs.get(next);
    if (!old || cost[0] < old[0] || cost[0] === old[0] && cost[1] < old[1]) costs.set(next,cost);
  }
  return costs.get((1 << ones.length)-1);
}
for (let mask = 0; mask < 256; mask++) check(() => {
  const ones = Array.from({length:8}, (_,i)=>i).filter(i=>mask & (1<<i));
  const r = C.minimize(3,ones); assert.ok(r.verified); assert.deepEqual([r.selected.length,r.literals],oracle(3,ones,[]));
});
let seed = 123456;
const random = () => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed / 2**32; };
for (let k = 0; k < 300; k++) check(() => {
  const n = k < 40 ? 2 : 4, ones = [], dc = [];
  for(let i=0;i<2**n;i++){const x=random();if(x<0.4)ones.push(i);else if(x<0.6)dc.push(i);}
  const r=C.minimize(n,ones,dc);assert.ok(r.verified);assert.deepEqual([r.selected.length,r.literals],oracle(n,ones,dc));
  assert.ok(r.selected.every(g=>g.cells.some(i=>ones.includes(i))));
});
for(const e of globalThis.StudyContent.examples)check(()=>assert.ok(C.minimize(e.n,e.ones,e.dc).verified));
check(()=>{ const map=C.kmap(4);assert.deepEqual(map.rows,['00','01','11','10']);assert.deepEqual(map.cells,[[0,1,3,2],[4,5,7,6],[12,13,15,14],[8,9,11,10]]); assert.match(C.toMarkdown(C.minimize(4,[0,2,8,10])),/①/); });
check(()=>{ assert.deepEqual(C.countText('北邮 AI😀\n'),{total:7,noWhitespace:5,chinese:2,words:1});assert.equal(C.dateKey(new Date(2026,9,2)), '2026-10-02'); assert.equal(C.validDate('2026-02-30'),false); });
check(()=>{const first=C.reviewNext(null,'good',1000);assert.equal(first.dueAt,1000+C.DAY);const again=C.reviewNext(first,'again',2000);assert.equal(again.dueAt,602000);assert.equal(again.lapses,1);assert.equal(C.reviewNext(first,'easy',1000).level,3);assert.throws(()=>C.reviewNext(null,'invalid'));});
check(()=>{const s=C.initialState();assert.deepEqual(C.validateState(s),s);assert.throws(()=>C.validateState({...s,version:2}));assert.throws(()=>C.validateState({...s,tasks:[{id:'x',title:'x',course:'',due:'2026-02-30',priority:'normal',done:false,createdAt:1}]}));assert.throws(()=>C.validateState({...s,reviews:{constructor:{}}}));assert.throws(()=>C.validateState({...s,drafts:'a'.repeat(30001)}));});
check(()=>{const p=C.parsePoints('0, 1\n1, 3\n2, 5');assert.deepEqual(C.leastSquares(p),{w:2,b:1,unique:true,loss:0});assert.throws(()=>C.parsePoints('x,y\n1,2'));assert.throws(()=>C.parsePoints('1, NaN\n2, 4'));assert.throws(()=>C.gradientStep(p,0,0,0));});
check(()=>{const p=[{x:0,y:1},{x:1,y:3},{x:2,y:5}],r=C.regression(p,0,0);assert.equal(r.dw,-13/3);assert.equal(r.db,-3);const next=C.gradientStep(p,0,0,.1);assert.ok(next.after.loss<next.before.loss);assert.equal(next.b,.3+.00000000000000004);});
check(()=>{const p=[{x:1,y:3},{x:1,y:5}];assert.deepEqual(C.leastSquares(p),{w:0,b:4,unique:false,loss:.5});});
check(()=>{const p=[{x:-2,y:-3},{x:-1,y:-1},{x:0,y:1},{x:1,y:3},{x:2,y:5}];let w=0,b=0;for(let i=0;i<200;i++){const s=C.gradientStep(p,w,b,.1);w=s.w;b=s.b;}assert.ok(Math.abs(w-2)<1e-8);assert.ok(Math.abs(b-1)<1e-8);assert.ok(C.regression(p,w,b).loss<1e-16);const q=p.map(x=>({...x,x:x.x*50}));assert.ok(C.learningRateBound(q)<C.learningRateBound(p));});
check(()=>{const p=[{x:-2,y:-3},{x:0,y:1},{x:2,y:5}],w=.7,b=-.1,epsilon=1e-5,r=C.regression(p,w,b);const finiteW=(C.regression(p,w+epsilon,b).loss-C.regression(p,w-epsilon,b).loss)/(2*epsilon),finiteB=(C.regression(p,w,b+epsilon).loss-C.regression(p,w,b-epsilon).loss)/(2*epsilon);assert.ok(Math.abs(finiteW-r.dw)<1e-8);assert.ok(Math.abs(finiteB-r.db)<1e-8);});
check(()=>{const svg=C.toSvg(C.minimize(4,[0,2,8,10]));assert.match(svg,/stroke-dasharray/);assert.match(svg,/真值验证通过/);assert.match(svg,/B&apos;/);assert.doesNotMatch(svg,/B&amp;apos;/);});
check(()=>{assert.deepEqual(C.expressionToTerms("AB+A'C",3).ones,[1,3,6,7]);assert.deepEqual(C.expressionToTerms('(A+B)\'C',3).ones,[1]);assert.deepEqual(C.expressionToTerms('A^B',2).ones,[1,2]);assert.deepEqual(C.expressionToTerms("!!A''",2).ones,[2,3]);assert.deepEqual(C.expressionToTerms('a(b+c)',3).ones,[5,6,7]);for(const s of ['A+','(A+B','A+B)','F=A','A;alert(1)','()','A&&B'])assert.throws(()=>C.expressionToTerms(s,3));assert.throws(()=>C.expressionToTerms('D',3));});
check(()=>{assert.equal(C.validateGroup(4,[0,2,8,10],[0,2,8,10]).text,"B'·D'");assert.throws(()=>C.validateGroup(4,[0,5],[0,5]));assert.throws(()=>C.validateGroup(3,[0,1,2],[0,1,2]));assert.throws(()=>C.validateGroup(3,[1],[0],[1]));assert.throws(()=>C.validateGroup(3,[0,1],[0],[]));const optimal=C.assessGroups(4,[{cells:[0,2,8,10]}],[0,2,8,10]);assert.ok(optimal.optimal);const redundant=C.assessGroups(4,[{cells:[0,2]},{cells:[8,10]}],[0,2,8,10]);assert.ok(redundant.complete);assert.equal(redundant.optimal,false);assert.deepEqual(C.assessGroups(4,[{cells:[0,2]}],[0,2,8,10]).missing,[8,10]);});
check(()=>{const r=C.minimize(4,[0,2,8,10]);assert.match(C.toVerilog(r),/assign F = \(~B & ~D\);/);const tb=C.toTestbench(C.minimize(3,[0,1,2,4],[5,6]));assert.doesNotMatch(tb,/3'd5:|3'd6:/);assert.match(tb,/logic_function dut/);assert.match(C.toVerilog(C.minimize(2,[])),/1'b0/);assert.match(C.toVerilog(C.minimize(2,[0,1,2,3])),/1'b1/);});
console.log(`${checks} checks passed: truth tables, optimal covers, parsing, review scheduling, Unicode counts, backup validation, regression, expressions, manual groups and HDL export structure.`);
