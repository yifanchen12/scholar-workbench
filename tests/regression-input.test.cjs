'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/#ai');
    const button=action=>page.locator(`[data-action="${action}"]`);
    const loss=await page.locator('#ai-loss').textContent();await page.locator('#ai-w').fill('2');
    assert.equal(await page.locator('#ai-loss').textContent(),loss);assert.equal(await button('ai-export').isDisabled(),true);assert.match(await page.locator('#ai-pending').textContent(),/参数输入尚未应用/);
    await page.getByRole('button',{name:'指标辨析',exact:true}).click();await page.getByRole('button',{name:'梯度下降',exact:true}).click();assert.equal(await page.locator('#ai-w').inputValue(),'2');assert.equal(await button('ai-card').isDisabled(),true);
    await button('ai-apply').click();assert.equal(await button('ai-export').isEnabled(),true);assert.notEqual(await page.locator('#ai-loss').textContent(),loss);
    await page.locator('#ai-eta').fill('.8');await button('ai-reset').click();assert.equal(await page.locator('#ai-eta').inputValue(),'0.8');assert.equal(await page.locator('#ai-w').inputValue(),'0');
    await page.locator('#ai-eta').fill('');assert.equal(await button('ai-export').isDisabled(),true);await button('ai-reset').click();assert.match(await page.locator('#ai-error').textContent(),/学习率/);assert.equal(await page.locator('#ai-eta').inputValue(),'');
    await page.locator('#ai-eta').fill('.1');await button('ai-apply').click();
    await page.locator('details:has(#ai-train) summary').click();const original=await page.locator('#ai-train').inputValue();await page.locator('#ai-train').fill('0,1\n1,3\n2,5');
    for(const action of ['ai-step','ai-batch','ai-apply','ai-reset','ai-export','ai-card'])assert.equal(await button(action).isDisabled(),true,action);
    await page.getByRole('link',{name:'复习与错题',exact:true}).click();await page.getByRole('link',{name:'AI 小实验',exact:true}).click();assert.equal(await page.locator('#ai-train').inputValue(),'0,1\n1,3\n2,5');
    await page.locator('details:has(#ai-train) summary').click();await page.locator('#ai-train').fill('not a point');await button('ai-data').click();assert.equal(await page.locator('#ai-train').inputValue(),'not a point');assert.ok((await page.locator('#ai-error').textContent()).length>0);assert.equal(await button('ai-export').isDisabled(),true);
    await page.locator('#ai-train').fill(original);assert.equal(await button('ai-step').isEnabled(),true);
    await page.locator('#ai-train').fill('0,1\n1,3\n2,5');await page.locator('#ai-test').fill('0.5,2\n1.5,4');await page.locator('#ai-eta').fill('.1');await button('ai-data').click();assert.equal(await page.locator('#ai-preset').inputValue(),'');
    await button('ai-step').click();await page.locator('#ai-eta').fill('.2');await button('ai-step').click();await button('ai-export').click();
    const record=await page.locator('#export-text').inputValue();const rows=record.split('\n').filter(line=>/^\| \d+ \|/.test(line)).map(line=>line.split('|').slice(1,-1).map(x=>x.trim()));
    assert.equal(rows.length,3);assert.equal(rows[0][3],'—');assert.equal(Number(rows[1][3]),.1);assert.equal(Number(rows[2][3]),.2);
    let w=0,b=0;const points=[[0,1],[1,3],[2,5]];
    for(const row of rows.slice(1)){const eta=Number(row[3]),residuals=points.map(([x,y])=>w*x+b-y),dw=residuals.reduce((sum,r,i)=>sum+r*points[i][0],0)/3,db=residuals.reduce((sum,r)=>sum+r,0)/3;w-=eta*dw;b-=eta*db;assert.ok(Math.abs(Number(row[1])-w)<1e-12);assert.ok(Math.abs(Number(row[2])-b)<1e-12);}
    assert.deepEqual(errors,[]);console.log('Regression input checks passed: unapplied drafts survive navigation, old exports blocked, invalid data remains editable, reset preserves requested learning rate, and exported per-step parameters replay both learning rates.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
