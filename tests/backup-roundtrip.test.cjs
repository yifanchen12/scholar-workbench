'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const C=require('../core');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179';
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({acceptDownloads:true});await page.goto(base+'/#data');
    const s=C.initialState();s.cards=Array.from({length:350},(_,i)=>({id:'long-chinese-'+i,topic:'人工智能基础',question:`第${i+1}张：`+'题'.repeat(100),answer:'答'.repeat(3200)}));C.validateState(s);
    const bytes=Buffer.from(JSON.stringify(s,null,2));assert.ok(bytes.length>3*1024*1024 && bytes.length<C.BACKUP_FILE_LIMIT);
    await page.locator('#import-file').setInputFiles({name:'long-chinese.json',mimeType:'application/json',buffer:bytes});await page.getByRole('dialog',{name:'用这份备份替换当前数据？',exact:true}).waitFor();
    const previous=page.waitForEvent('download');await page.locator('#confirm-action').click();assert.deepEqual(JSON.parse(fs.readFileSync(await (await previous).path(),'utf8')).cards,[]);
    await page.reload();assert.equal(await page.locator('#storage-alert').isVisible(),false);assert.match(await page.locator('.data-counts').textContent(),/350 张自建卡/);
    const exported=page.waitForEvent('download');await page.getByRole('button',{name:'导出 JSON 备份',exact:true}).click();const recovered=JSON.parse(fs.readFileSync(await (await exported).path(),'utf8'));assert.deepEqual(C.validateState(recovered),s);
    console.log(`Chinese backup round-trip passed: ${bytes.length} bytes / 350 long cards import, survive reload, and export without changed content; the prior backup stays available.`);
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
