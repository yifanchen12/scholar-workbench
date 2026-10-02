'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/#ai');await page.getByRole('button',{name:'指标辨析',exact:true}).click();
    const value=k=>page.locator(`[data-metric="${k}"]`).textContent();assert.equal(await value('accuracy'),'99.00%');assert.equal(await value('recall'),'0.00%');assert.equal(await value('precision'),'未定义');assert.equal(await value('f1'),'0.00%');
    await page.getByRole('button',{name:'找回8个正类',exact:true}).click();assert.equal(await value('accuracy'),'98.60%');assert.equal(await value('precision'),'40.00%');assert.equal(await value('recall'),'80.00%');assert.equal(await value('f1'),'53.33%');
    await page.locator('[data-action="metric-export"]').click();assert.match(await page.locator('#export-text').inputValue(),/TP=8, FP=12, FN=2, TN=978/);await page.locator('#text-dialog [data-close]').click();
    await page.locator('#metric-tp').fill('');assert.match(await page.locator('#metric-error').textContent(),/不能留空/);assert.equal(await page.locator('[data-action="metric-export"]').isDisabled(),true);assert.equal(await page.locator('[data-metric]').count(),0);
    for(const key of ['tp','fp','fn','tn'])await page.locator('#metric-'+key).fill('0');assert.equal(await value('accuracy'),'未定义');assert.equal(await value('f1'),'未定义');assert.match(await page.locator('#metric-insight').textContent(),/没有样本/);
    await page.locator('#metric-tn').fill('100');assert.equal(await value('accuracy'),'100.00%');assert.equal(await value('recall'),'未定义');assert.equal(await value('balancedAccuracy'),'未定义');
    await page.getByRole('button',{name:'只预测多数类',exact:true}).click();await page.locator('[data-action="metric-card"]').click();assert.match(await page.locator('#card-form [name="answer"]').inputValue(),/F1: 0.00%/);await page.locator('#card-dialog [data-close]').first().click();
    for(const width of [1440,1024,768,390,360,320]){await page.setViewportSize({width,height:960});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'metrics overflow '+width);}
    await page.setViewportSize({width:1440,height:1000});await page.evaluate(()=>{document.activeElement.blur();window.scrollTo(0,0);});await page.screenshot({path:path.resolve(__dirname,'../docs/screenshots/07-metrics-desktop.png'),fullPage:true});await page.setViewportSize({width:390,height:960});await page.screenshot({path:path.resolve(__dirname,'../docs/screenshots/mobile-metrics.png'),fullPage:true});assert.deepEqual(errors,[]);
    console.log('Metrics browser checks passed: live counts, rare-class examples, undefined denominators, stale-output protection, export, recall card and six responsive widths.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
