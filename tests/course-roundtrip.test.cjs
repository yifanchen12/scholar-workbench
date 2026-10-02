'use strict';
const assert=require('node:assert/strict');
const C=require('../core');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const state=C.initialState(),topic=' 机器学习  （自定义） & "ML" ';
    const task=(id,title,course)=>({id,title,course,due:'',priority:'normal',done:false,createdAt:1});
    state.tasks=[task('custom-task','编辑后仍保留方向',topic),task('empty-task','未指定方向的任务',''),task('long-task','A'.repeat(300),'C'.repeat(100))];
    state.cards=[{id:'custom-card',question:'q'.repeat(1000),answer:'a'.repeat(4000),topic},{id:'long-card',question:'z'.repeat(1000),answer:'x'.repeat(4000),topic:'T'.repeat(100)},{id:'empty-card',question:'空方向也应保留',answer:'既有内容',topic:''}];
    state.experiences=[{id:'long-experience',title:'E'.repeat(300),category:'科研',date:'',detail:'D'.repeat(4000),evidence:'https://example.invalid/'+ 'x'.repeat(970)}];
    state.sessions=[{id:'long-session',endedAt:1,minutes:1,topic:'S'.repeat(300)}];C.validateState(state);
    const context=await browser.newContext();await context.addInitScript(value=>{if(!localStorage.getItem('youyan.study.v1'))localStorage.setItem('youyan.study.v1',JSON.stringify(value));},state);
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('youyan.study.v1')));
    await page.goto(base+'/#today');await page.locator('#task-course').selectOption(topic);assert.equal(await page.locator('.task-row').count(),1);
    await page.locator('[data-action="edit-task"][data-id="custom-task"]').click();assert.equal(await page.locator('#task-form [name="course"]').inputValue(),topic);await page.locator('#task-form [name="title"]').fill('仅改标题');await page.getByRole('button',{name:'保存任务',exact:true}).click();assert.equal((await saved()).tasks[0].course,topic);
    await page.locator('#task-course').selectOption('');await page.locator('[data-action="edit-task"][data-id="empty-task"]').click();assert.equal(await page.locator('#task-form [name="course"]').inputValue(),'');await page.getByRole('button',{name:'保存任务',exact:true}).click();assert.equal((await saved()).tasks[1].course,'');
    await page.goto(base+'/#review');await page.locator('#review-topic').selectOption(topic);assert.equal(await page.locator('.review-question').textContent(),'q'.repeat(1000));await page.locator('[data-action="edit-card"][data-id="custom-card"]').click();assert.equal(await page.locator('#card-form [name="topic"]').inputValue(),topic);await page.getByRole('button',{name:'加入复习',exact:true}).click();assert.equal((await saved()).cards[0].topic,topic);
    await page.getByRole('button',{name:'批量录入问答卡',exact:true}).click();await page.locator('#batch-topic').selectOption(topic);await page.getByRole('button',{name:'填入格式示例',exact:true}).click();await page.locator('#batch-commit').click();assert.ok((await saved()).cards.slice(-2).every(card=>card.topic===topic));
    await page.locator('#review-topic').selectOption('T'.repeat(100));await page.getByRole('button',{name:'查看答案',exact:true}).click();
    for(const width of [1440,390,320]){
      await page.setViewportSize({width,height:960});
      for(const route of ['today','review','materials','data']){
        await page.goto(base+'/#'+route);
        const overflow=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,items:[...document.querySelectorAll('main *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).slice(0,8).map(el=>el.className)}));
        assert.ok(overflow.scroll<=width,`${route} at ${width}: ${JSON.stringify(overflow)}`);
      }
    }
    const roundtrip=await saved();C.validateState(roundtrip);assert.equal(roundtrip.cards.find(card=>card.id==='empty-card').topic,'');assert.deepEqual(errors,[]);
    console.log('Course round-trip checks passed: existing custom/empty directions survive filtering and edits, batch cards retain the selected direction, and legal long text fits desktop/mobile layouts.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
