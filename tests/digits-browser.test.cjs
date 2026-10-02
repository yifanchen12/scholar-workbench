'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
async function downloadJSON(page,action){const pending=page.waitForEvent('download');await page.locator(`[data-action="${action}"]`).click();return JSON.parse(fs.readFileSync(await (await pending).path(),'utf8'));}
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000},acceptDownloads:true}),errors=[],external=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith(base))external.push(r.url());});
    await page.goto(base+'/#ai');await page.getByRole('button',{name:'手写数字',exact:true}).click();
    assert.match(await page.locator('#digit-result').textContent(),/真实标签 0/);
    let data=await downloadJSON(page,'digit-export');assert.equal(data.pixels.length,64);assert.equal(data.model,'network');assert.equal(data.prediction.prediction,0);
    await page.getByRole('button',{name:'真实误判样例',exact:true}).click();await page.locator('[data-action="digit-sample"]').first().click();
    data=await downloadJSON(page,'digit-export');assert.notEqual(data.prediction.prediction,data.label);assert.match(await page.locator('#digit-result').textContent(),/预测错误/);
    const mistakes=await page.locator('[data-action="digit-sample"]').count();assert.equal(mistakes,8);
    await page.locator('#digit-model').selectOption('linear');data=await downloadJSON(page,'digit-export');assert.equal(data.model,'linear');
    await page.locator('summary').filter({hasText:'查看当前模型的混淆矩阵'}).click();assert.equal(await page.locator('.confusion-table tbody tr').count(),10);assert.equal(await page.locator('.confusion-table tbody td').count(),100);
    const report=await downloadJSON(page,'digit-report');assert.equal(report.models.linear.testErrors,9);assert.equal(report.testSamples,360);
    await page.locator('[data-action="digit-clear"]').click();assert.match(await page.locator('#digit-result').textContent(),/请画一个数字/);
    await page.locator('[data-action="digit-grid"]').click();const firstPixel=page.locator('[data-action="digit-pixel"]').first();await firstPixel.focus();await page.keyboard.press('Space');assert.equal(await firstPixel.getAttribute('aria-label'),'第1行第1列，值16.0，点击在0和16之间切换');assert.equal(await firstPixel.evaluate(el=>el===document.activeElement),true);
    data=await downloadJSON(page,'digit-export');assert.equal(data.pixels[0],16);
    await page.locator('[data-action="digit-right"]').click();data=await downloadJSON(page,'digit-export');assert.equal(data.pixels[0],0);assert.equal(data.pixels[1],16);
    await page.locator('[data-action="digit-left"]').click();data=await downloadJSON(page,'digit-export');assert.equal(data.pixels[0],16);
    await page.locator('[data-action="digit-clear"]').click();const box=await page.locator('#digit-canvas').boundingBox();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.15);await page.mouse.down();await page.mouse.move(box.x+box.width*.5,box.y+box.height*.85,{steps:20});await page.mouse.up();
    data=await downloadJSON(page,'digit-export');assert.equal(data.label,null);assert.equal(data.origin,'你绘制的笔迹');assert.ok(data.pixels.some(x=>x>0));assert.ok(data.pixels.every(x=>Number.isFinite(x)&&x>=0&&x<=16));assert.equal(await page.locator('.probability-row').count(),10);
    await page.locator('[data-action="digit-card"]').click();assert.equal(await page.locator('#card-dialog').evaluate(el=>el.open),true);assert.match(await page.locator('#card-form [name="answer"]').inputValue(),/没有按书写者隔离/);await page.locator('#card-dialog [data-close]').first().click();
    for(const width of [1440,1024,768,390,360,320]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,`digits overflow at ${width}`);}
    await page.setViewportSize({width:1440,height:1000});await page.locator('[data-action="digit-gallery"][data-mode="examples"]').click();await page.locator('[data-action="digit-sample"]').first().click();await page.locator('#digit-model').selectOption('network');
    await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:path.resolve(__dirname,'../docs/screenshots/06-digits-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:960});await page.screenshot({path:path.resolve(__dirname,'../docs/screenshots/mobile-digits.png'),fullPage:true});
    await page.getByRole('button',{name:'梯度下降',exact:true}).click();assert.equal(await page.getByRole('button',{name:'走 20 步',exact:true}).isVisible(),true);
    assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    const local=await browser.newPage();await local.goto('file:///'+path.resolve(__dirname,'../index.html').replaceAll('\\','/')+'#ai');await local.getByRole('button',{name:'手写数字',exact:true}).click();assert.equal(await local.locator('.probability-row').count(),10);
    console.log('Digits: real mistakes, both models, keyboard pixels, shifts, pointer preprocessing, downloads, model card, six widths and direct file passed.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
