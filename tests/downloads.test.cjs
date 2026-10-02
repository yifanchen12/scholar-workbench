'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {createHash}=require('node:crypto');
const {chromium}=require('./browser-runtime.cjs').playwright;
const base=process.env.STUDY_URL || 'http://127.0.0.1:5179',root=path.resolve(__dirname,'..');
(async()=>{
  const browser=await chromium.launch({headless:true,executablePath:process.env.BROWSER_PATH||undefined});
  try{
    const page=await browser.newPage({acceptDownloads:true});await page.goto(base+'/#data');
    for(const [label,relative]of [
      ['下载 Python 实训包','output/邮研-Python实训包.zip'],
      ['下载练习册 PDF','output/pdf/数字逻辑与AI基础速练册.pdf'],
      ['下载实训讲义 PDF','practice/output/从梯度到分类-实训讲义.pdf'],
      ['下载 Markdown','docs/学习练习册.md']
    ]){
      const pending=page.waitForEvent('download');await page.getByRole('link',{name:label,exact:true}).click();const download=await pending;
      assert.equal(download.suggestedFilename(),path.basename(relative));
      const received=fs.readFileSync(await download.path()),expected=fs.readFileSync(path.join(root,relative));
      assert.equal(createHash('sha256').update(received).digest('hex'),createHash('sha256').update(expected).digest('hex'),label);
      assert.equal(page.url(),base+'/#data');
    }
    console.log('Local-service downloads: both PDF files, practice ZIP and workbook Markdown have unchanged file hashes; the workbench stays open.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exit(1);});
