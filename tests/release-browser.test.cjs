'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {pathToFileURL}=require('node:url');
const {chromium}=require('./browser-runtime.cjs').playwright;
const root=JSON.parse(fs.readFileSync(path.resolve(__dirname,'../tmp/release-folder.json'),'utf8')).directory;
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({acceptDownloads:true}),errors=[],remote=[];
    page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('file:'))remote.push(r.url());});
    const url=pathToFileURL(path.join(root,'index.html')).href;
    await page.goto(url);
    for(const route of ['today','logic','ai','logic-tools','review','materials','data']){await page.goto(url+'#'+route);assert.ok((await page.locator('h1').textContent()).length>0);}
    for(const [label,relative]of [['下载 Python 实训包','output/邮研-Python实训包.zip']]){
      const pending=page.waitForEvent('download');await page.getByRole('link',{name:label,exact:true}).click();const download=await pending;
      assert.equal(await download.suggestedFilename(),path.basename(relative));
      const received=fs.readFileSync(await download.path()),expected=fs.readFileSync(path.join(root,relative));
      assert.ok(received.length>1000);assert.equal(createHash('sha256').update(received).digest('hex'),createHash('sha256').update(expected).digest('hex'),label);
    }
    for(const [label,relative]of [
      ['查看练习册 PDF','output/pdf/数字逻辑与AI基础速练册.pdf'],
      ['查看实训讲义 PDF','practice/output/从梯度到分类-实训讲义.pdf']
    ]){
      const link=page.getByRole('link',{name:label,exact:true});assert.equal(await link.getAttribute('target'),'_blank');assert.equal(await link.getAttribute('rel'),'noopener');
      const opened=page.context().waitForEvent('page');await link.click();const pdf=await opened;
      await pdf.waitForURL(pathToFileURL(path.join(root,relative)).href);assert.equal(page.url(),url+'#data');
      assert.equal(fs.readFileSync(path.join(root,relative)).subarray(0,5).toString(),'%PDF-');await pdf.close();
    }
    await page.goto(url+'#ai');await page.locator('[data-lesson=cnn]').first().click();await page.locator('#course-lab').click();assert.equal(await page.locator('.probability-row').count(),10);
    await page.locator('[data-lesson=evaluation]').first().click();await page.locator('#course-lab').click();assert.equal(await page.locator('[data-metric="accuracy"]').textContent(),'99.00%');
    await page.locator('[data-lesson=project]').first().click();await page.locator('#course-lab').click();assert.equal(await page.locator('.training-chart').count(),1);
    await page.goto(url+'#review');await page.getByRole('button',{name:'批量录入问答卡',exact:true}).click();assert.equal(await page.locator('#batch-dialog').evaluate(el=>el.open),true);await page.locator('#batch-dialog [data-close]').first().click();
    assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
    console.log('Portable release: seven routes, offline curriculum, training records, digit inference, metrics, batch-card dialog, practice ZIP download hash and both PDF links opening separately passed after fresh extraction.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
