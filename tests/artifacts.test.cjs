'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('./browser-runtime.cjs').playwright;
const root=path.resolve(__dirname,'..');
(async()=>{
  const notebook=JSON.parse(fs.readFileSync(path.join(root,'practice/从梯度到分类.ipynb'),'utf8'));
  assert.equal(notebook.nbformat,4);assert.equal(new Set(notebook.cells.map(c=>c.id)).size,notebook.cells.length);
  const code=notebook.cells.filter(c=>c.cell_type==='code');assert.equal(code.length,7);assert.deepEqual(code.map(c=>c.execution_count),[1,2,3,4,5,6,7]);
  assert.equal(code.flatMap(c=>c.outputs).some(o=>o.output_type==='error'),false);
  for(const cell of notebook.cells){assert.equal(typeof cell.source.join(''),'string');assert.equal(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(cell.source.join('')),false,'Control character in notebook source');}
  assert.ok(notebook.cells.map(c=>c.source.join('')).join('\n').includes('\\frac'));
  const report=JSON.parse(fs.readFileSync(path.join(root,'practice/output/实验报告.json'),'utf8'));
  assert.deepEqual(report.split,{train:240,validation:80,test:80});
  for(const r of Object.values(report.classification)){assert.ok(r.gradientCheck.maxAbsoluteError<1e-6);assert.equal(r.test.confusion.flat().reduce((a,b)=>a+b),80);assert.equal(r.history[0].epoch,0);assert.equal(r.history.at(-1).epoch,600);}
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1100,height:680}});
    for(const name of ['linear','relu8']){
      const svg=fs.readFileSync(path.join(root,'practice/output',name+'.svg'),'utf8');await page.setContent(svg);
      assert.ok(await page.evaluate(()=>{const svg=document.querySelector('svg'),box=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].every(t=>{const b=t.getBBox();return b.x>=0&&b.y>=0&&b.x+b.width<=box.width&&b.y+b.height<=box.height;});}),name+' SVG clipping');
      await page.locator('svg').screenshot({path:path.join(root,'docs/screenshots','python-'+name+'.png')});
    }
  }finally{await browser.close();}
  console.log('Artifacts: notebook format/basic structure, seven completed cells, clean math escapes, training reports, and both SVG text bounds passed.');
})().catch(e=>{console.error(e.stack);process.exit(1);});
