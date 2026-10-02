'use strict';
const assert=require('node:assert/strict');
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  for(const [file,type] of [['','text/html'],['core.js','text/javascript'],['ai-lab.js','text/javascript'],['digits-model.js','text/javascript'],['digits-lab.js','text/javascript'],['metrics-lab.js','text/javascript'],['card-import.js','text/javascript'],['style.css','text/css'],['favicon.svg','image/svg+xml'],['output/pdf/数字逻辑与AI基础速练册.pdf','application/pdf'],['practice/output/从梯度到分类-实训讲义.pdf','application/pdf'],['examples/AI实训复习卡.txt','text/plain'],['docs/学习练习册.md','text/markdown'],['output/邮研-Python实训包.zip','application/zip']]){
    const r=await fetch(`${base}/${file}`);assert.equal(r.status,200);assert.ok(r.headers.get('content-type').startsWith(type));assert.equal(r.headers.get('x-study-workbench'),'youyan-local-v1');assert.equal(r.headers.get('x-content-type-options'),'nosniff');assert.ok(r.headers.get('content-security-policy').includes("connect-src 'self'"));assert.ok((await r.text()).length>0);
  }
  for(const route of ['README.md','docs/plans/study-workbench.md','%2e%2e%2fREADME.md','missing.html'])assert.equal((await fetch(`${base}/${route}`)).status,404);
  assert.equal((await fetch(base,{method:'POST',body:'unused'})).status,405);const head=await fetch(base,{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
  console.log('Server checks passed: correct asset types, static read-only methods and local API boundary, security headers, and private/document paths denied.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
