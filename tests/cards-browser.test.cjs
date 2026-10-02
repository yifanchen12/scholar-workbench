'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const C=require('../core');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/#review');await page.locator('[data-action="batch-open"]').click();
    await page.locator('#batch-text').fill('问：无答案');await page.locator('[data-action="batch-preview"]').click();assert.match(await page.locator('#batch-error').textContent(),/缺少/);assert.equal(await page.locator('#batch-commit').isDisabled(),true);assert.equal(await page.evaluate(()=>localStorage.getItem('youyan.study.v1')),null);
    await page.keyboard.press('Escape');await page.locator('[data-action="batch-open"]').click();assert.equal(await page.locator('#batch-text').inputValue(),'问：无答案');
    await page.locator('[data-action="batch-sample"]').click();assert.match(await page.locator('#batch-preview').textContent(),/待新增 2 张/);assert.equal(await page.evaluate(()=>localStorage.getItem('youyan.study.v1')),null);
    await page.locator('#batch-text').fill('问：<img src=x onerror="window.bad=1">\n答：<script>window.bad=1</script>');assert.equal(await page.locator('#batch-commit').isDisabled(),true);await page.locator('[data-action="batch-preview"]').click();await page.locator('.batch-preview-card summary').click();assert.equal(await page.locator('#batch-preview img,#batch-preview script').count(),0);assert.equal(await page.evaluate(()=>window.bad),undefined);
    await page.locator('[data-action="batch-sample"]').click();await page.locator('#batch-commit').click();let data=await page.evaluate(()=>JSON.parse(localStorage.getItem('youyan.study.v1')));assert.equal(data.cards.length,2);assert.equal(new Set(data.cards.map(c=>c.id)).size,2);C.validateState(data);
    await page.locator('[data-action="batch-open"]').click();await page.locator('[data-action="batch-sample"]').click();assert.match(await page.locator('#batch-preview').textContent(),/待新增 0 张 · 跳过完全重复 2 张/);assert.equal(await page.locator('#batch-commit').isDisabled(),true);
    await page.locator('#batch-file').setInputFiles(path.resolve(__dirname,'../examples/AI实训复习卡.txt'));assert.match(await page.locator('#batch-preview').textContent(),/待新增 12 张/);await page.locator('#batch-commit').click();await page.reload();data=await page.evaluate(()=>JSON.parse(localStorage.getItem('youyan.study.v1')));assert.equal(data.cards.length,14);assert.deepEqual(data.reviews,{});
    await page.locator('[data-action="batch-open"]').click();await page.locator('#batch-text').fill('问：保留输入\n答：保留答案');await page.locator('#batch-file').setInputFiles({name:'not-utf8.txt',mimeType:'text/plain',buffer:Buffer.from([255,254,254])});assert.match(await page.locator('#batch-error').textContent(),/UTF-8/);assert.equal(await page.locator('#batch-text').inputValue(),'问：保留输入\n答：保留答案');
    await page.locator('[data-action="batch-sample"]').click();for(const width of [1440,1024,768,390,360,320]){await page.setViewportSize({width,height:960});assert.ok(await page.locator('#batch-dialog').evaluate(el=>el.scrollWidth<=el.clientWidth),`dialog overflow at ${width}`);}
    assert.deepEqual(errors,[]);
    const state=C.initialState();state.cards=Array.from({length:499},(_,i)=>({id:`c-${i}`,question:`既有问题${i}`,answer:'既有答案',topic:'人工智能基础'}));
    const crowded=await browser.newContext();await crowded.addInitScript(value=>localStorage.setItem('youyan.study.v1',JSON.stringify(value)),state);const other=await crowded.newPage();await other.goto(base+'/#review');await other.locator('[data-action="batch-open"]').click();await other.locator('[data-action="batch-sample"]').click();assert.match(await other.locator('#batch-error').textContent(),/还可保存1张/);assert.equal(await other.locator('#batch-commit').isDisabled(),true);assert.equal(await other.evaluate(()=>JSON.parse(localStorage.getItem('youyan.study.v1')).cards.length),499);
    console.log('Card batch browser checks passed: previews before writes, malformed text rejection, draft preservation, safe text, complete duplicates, UTF-8 file, refresh persistence, capacity rejection and six dialog widths.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
