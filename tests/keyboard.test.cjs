'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(base+'/#logic');
    await page.locator('#logic-ones').fill('1,3,5,7');
    await page.locator('.skip-link').focus();await page.keyboard.press('Enter');
    assert.equal(new URL(page.url()).hash,'#logic');assert.equal(await page.locator('#logic-ones').inputValue(),'1,3,5,7');assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
    await page.locator('#navigation a[href="#ai"]').focus();await page.keyboard.press('Enter');
    await page.waitForURL('**/#ai');await page.getByRole('heading',{name:'亲手走一步梯度下降。',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.activeElement.id),'main');
    for(const mode of ['digits','metrics','regression']){
      await page.locator(`[data-action="ai-workbench-mode"][data-mode="${mode}"]`).focus();await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(()=>document.activeElement.dataset.mode),mode);assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('aria-pressed')),'true');
    }
    await page.locator('[data-action="ai-batch"]').focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'ai-batch');
    await page.getByRole('button',{name:'导出实验记录',exact:true}).click();assert.equal(await page.getByRole('dialog',{name:'线性回归实验记录',exact:true}).count(),1);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.dataset.action),'ai-export');
    await page.goto(base+'/#today');
    for(const filter of ['all','done','pending']){await page.locator(`[data-action="task-filter"][data-filter="${filter}"]`).focus();await page.keyboard.press('Enter');assert.equal(await page.evaluate(()=>document.activeElement.dataset.filter),filter);}
    await page.locator('#task-course').focus();await page.locator('#task-course').selectOption('人工智能基础');assert.equal(await page.evaluate(()=>document.activeElement.id),'task-course');
    await page.locator('#quick-add').click();assert.equal(await page.getByRole('dialog',{name:'记录学习任务',exact:true}).count(),1);await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'quick-add');
    assert.deepEqual(errors,[]);console.log('Keyboard checks passed: skip preserves route and input, navigation focuses main, redraw retains the exact experiment/filter/control, named dialogs and Escape restore focus.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
