'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179',output=path.resolve(__dirname,'../tmp/print');
fs.mkdirSync(output,{recursive:true});
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}});
    for(const variant of ['corners','parity','manual']){
      await page.goto(base+'/#logic');
      await page.locator('#logic-ones').fill(variant==='parity'?'1,2,4,7,8,11,13,14':'0,2,8,10');await page.getByRole('button',{name:'化简并验证',exact:true}).click();
      if(variant==='parity'){
        assert.equal(await page.locator('.group-item').count(),8);
      }
      if(variant==='manual'){
        await page.getByRole('button',{name:'我来圈组',exact:true}).click();
        for(const index of [0,2,8,10])await page.locator(`.kmap-cell[data-index="${index}"]`).click();
        await page.getByRole('button',{name:'加入这一组',exact:true}).click();await page.getByRole('button',{name:'我已圈完，检查覆盖',exact:true}).click();assert.match(await page.locator('.manual-feedback').textContent(),/覆盖完整/);
      }else{
        await page.getByText('展开 16 行真值验证',{exact:true}).click();assert.equal(await page.locator('.verification tbody tr').count(),16);
      }
      await page.emulateMedia({media:'print'});
      assert.equal(await page.locator('.sidebar').isVisible(),false);assert.equal(await page.locator('.logic-controls').isVisible(),false);assert.equal(await page.locator('#logic-result').isVisible(),true);
      assert.equal(await page.locator('.logic-mode').isVisible(),false);assert.equal(await page.locator('.circuit-section').isVisible(),false);assert.equal(await page.evaluate(()=>getComputedStyle(document.documentElement).backgroundColor),'rgb(255, 255, 255)');
      const map=await page.locator('.kmap-wrapper').boundingBox();assert.ok(map.width>0);
      await page.pdf({path:path.join(output,variant+'.pdf'),format:'A4',printBackground:true,margin:{top:'12mm',bottom:'12mm',left:'12mm',right:'12mm'}});
      await page.emulateMedia({media:'screen'});
    }
    console.log('Print-media checks passed: result remains visible, screen controls are hidden, complete truth tables and manual coverage included. Three browser-print PDFs saved for rendering.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
