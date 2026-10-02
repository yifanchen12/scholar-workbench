'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const C=require('../core');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179',screens=path.resolve(__dirname,'../docs/screenshots'),examples=path.resolve(__dirname,'../examples');
fs.mkdirSync(screens,{recursive:true});fs.mkdirSync(examples,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  const page=await browser.newPage({viewport:{width:1440,height:1000}});
  const fixtures=[['kmap-corners',4,[0,2,8,10],[]],['kmap-overlap',4,[5,6,7,10,11,14,15],[]],['kmap-parity',4,[1,2,4,7,8,11,13,14],[]],['kmap-two-variable',2,[1,2],[]],['kmap-constant',4,Array.from({length:16},(_,i)=>i),[]]];
  for(const [name,n,ones,dc]of fixtures){const r=C.minimize(n,ones,dc),svg=C.toSvg(r);fs.writeFileSync(path.join(examples,name+'.svg'),svg);fs.writeFileSync(path.join(examples,name+'.md'),C.toMarkdown(r));await page.setContent(svg);assert.ok(await page.evaluate(()=>{const svg=document.querySelector('svg'),box=svg.viewBox.baseVal;return [...svg.querySelectorAll('text')].every(t=>{const b=t.getBBox();return b.x>=0 && b.y>=0 && b.x+b.width<=box.width && b.y+b.height<=box.height;});}),`SVG text clipping in ${name}`);await page.locator('svg').screenshot({path:path.join(screens,name+'.png')});}
  await page.goto(base+'/#data');await page.getByRole('button',{name:'加入 3 项示例学习任务',exact:true}).click();
  await page.goto(base+'/#materials');await page.getByRole('button',{name:'录入已提到的两项学生工作',exact:true}).click();
  for(const [route,name]of [['today','01-today-desktop'],['logic','02-logic-desktop'],['ai','03-ai-desktop'],['review','04-review-desktop'],['materials','05-materials-desktop']]){
    await page.goto(base+'/#'+route);if(route==='ai')await page.getByRole('button',{name:'走 20 步',exact:true}).click();await page.evaluate(()=>{document.querySelector('#toast').hidden=true;window.scrollTo(0,0);document.activeElement.blur();});await page.screenshot({path:path.join(screens,name+'.png'),fullPage:true});
  }
  await page.setViewportSize({width:390,height:960});
  for(const route of ['today','logic','ai','review','materials','data']){await page.goto(base+'/#'+route);await page.evaluate(()=>{document.querySelector('#toast').hidden=true;window.scrollTo(0,0);document.activeElement.blur();});await page.screenshot({path:path.join(screens,'mobile-'+route+'.png'),fullPage:true});}
  await browser.close();console.log('Captured clean desktop/mobile previews and five SVG/Markdown examples; SVG text bounds all fit.');
})().catch(e=>{console.error(e.message);process.exit(1);});
