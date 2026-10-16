'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{once}=require('node:events');
const {spawnSync}=require('node:child_process');
const {_electron}=require('./browser-runtime.cjs').playwright;
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const directory=fs.mkdtempSync(path.join(root,'tmp','desktop-check-'));
const original=path.join(directory,'original-photo.png'),bytes=Buffer.from('synthetic original; must not be copied');fs.writeFileSync(original,bytes);
const transfer=require('../desktop-transfer.js');let capability;
transfer.handle=transfer.createHandler({launch:async value=>{capability=value;}});
process.env.STUDY_PORT=process.env.STUDY_DESKTOP_TEST_PORT||'5183';
const origin='http://127.0.0.1:'+process.env.STUDY_PORT;
const server=require('../server.js');
let application;
(async()=>{
  if(!server.listening)await once(server,'listening');
  const legacy=require('../core.js').initialState();legacy.tasks=[{id:'migration-task',title:'Synthetic existing task',course:'学习',due:'',priority:'normal',done:false,createdAt:Date.UTC(2026,9,15)}];
  const backup={format:'youyan-workspace-v3',legacy,books:[],records:[{id:'existing-record',title:'合成已有活动',organizer:'测试单位',award:'参与',date:'2026-10-15',category:'学习',notes:'Synthetic migration only',fileIds:[],evidencePaths:[]}],files:[],progress:[]};
  const draft={id:null,fields:{title:'合成未保存活动',organizer:'测试举办单位',award:'参与',date:'2026-10-15',category:'学习',notes:'Unsubmitted draft must survive handoff'},proofs:[{name:path.basename(original),path:''}]};
  const opened=await fetch(origin+'/api/desktop/open',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({backup,draft})});assert.equal(opened.status,202);
  const env={...process.env,STUDY_DESKTOP_PROFILE:path.join(directory,'profile'),STUDY_DESKTOP_HANDOFF:capability};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
  application=await _electron.launch({executablePath:require('electron'),args:[path.join(root,'desktop/main.cjs'),'--desktop-test'],cwd:root,env,timeout:30000});
  const page=await application.firstWindow();await page.locator('#record-dialog[open]').waitFor();
  assert.equal(await page.locator('#record-form [name=title]').inputValue(),draft.fields.title);assert.equal(await page.locator('#record-form [name=notes]').inputValue(),draft.fields.notes);
  assert.equal(await page.locator('[data-proof-path]').count(),0);assert.equal(await page.locator('#record-paste-paths').isVisible(),false);
  const isolation=await page.evaluate(()=>({hasBridge:!!window.StudyDesktop,noNode:typeof window.require==='undefined'}));assert.deepEqual(isolation,{hasBridge:true,noNode:true});
  assert.equal(await page.evaluate(async()=> (await StudyVault.all('records')).length),1);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('youyan.study.v1')).tasks.length),1);
  // CDP sets an actual disk-backed File; a JS-created File cannot prove native paths.
  await page.evaluate(()=>{const input=document.createElement('input');input.id='desktop-test-source';input.type='file';input.hidden=true;document.body.append(input);});
  await page.locator('#desktop-test-source').setInputFiles(original);
  await page.locator('#record-drop').evaluate(el=>{const data=new DataTransfer();data.items.add(document.querySelector('#desktop-test-source').files[0]);el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});
  await page.waitForFunction(expected=>document.querySelector('.proof-bound-path')?.textContent===expected,original);
  assert.equal(await page.locator('.proof-path-row').count(),1);assert.equal(await page.locator('#record-error').textContent(),'');
  // Repeated drops deduplicate; a memory-only image must never invent a path.
  await page.locator('#record-drop').evaluate(el=>{const data=new DataTransfer();data.items.add(document.querySelector('#desktop-test-source').files[0]);el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});assert.equal(await page.locator('.proof-path-row').count(),1);
  await page.locator('#record-drop').evaluate(el=>{const data=new DataTransfer();data.items.add(new File(['memory only'],'unsaved.png'));el.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:data}));});assert.match(await page.locator('#record-error').textContent(),/内存图片/);assert.equal(await page.locator('.proof-path-row').count(),1);
  await page.screenshot({path:path.join(directory,'native-drop.png')});
  await page.locator('#record-save').click();await page.waitForFunction(async()=> (await StudyVault.all('records')).length===2);
  assert.deepEqual(await page.evaluate(async()=> (await StudyVault.all('records')).find(r=>r.title==='合成未保存活动').evidencePaths),[original]);assert.equal(await page.evaluate(async()=> (await StudyVault.all('files')).length),0);assert(fs.readFileSync(original).equals(bytes));
  await page.reload();await page.locator('.record-card').first().waitFor();assert.equal(await page.locator('.record-card').count(),2);
  assert(await page.evaluate(expected=>document.querySelector('.evidence-reference code')?.textContent===expected,original));
  assert.equal((await fetch(origin+'/api/desktop/handoff',{method:'POST',headers:{'Content-Type':'application/json','X-Study-Handoff':capability},body:'{}'})).status,410);
  // Export the filtered record with actual originals, duplicate names and one old stored file.
  fs.mkdirSync(path.join(directory,'other'));const duplicate=path.join(directory,'other','original-photo.png'),missing=path.join(directory,'missing-proof.pdf'),excluded=path.join(directory,'excluded.txt');
  const duplicateBytes=Buffer.from('different original with same basename'),legacyBytes=Buffer.from('synthetic legacy evidence');fs.writeFileSync(duplicate,duplicateBytes);fs.writeFileSync(excluded,'excluded activity evidence');
  await page.evaluate(async({original,duplicate,missing,excluded,legacy})=>{
    const records=await StudyVault.all('records'),record=records.find(item=>item.title==='合成未保存活动');record.evidencePaths=[original,duplicate,missing];record.fileIds=['legacy-export'];await StudyVault.put('records',record);
    await StudyVault.put('files',{id:'legacy-export',owner:record.id,name:'旧证明.pdf',type:'application/pdf',blob:new Blob([new Uint8Array(legacy)])});
    const other=records.find(item=>item.id==='existing-record');other.evidencePaths=[excluded];await StudyVault.put('records',other);
  },{original,duplicate,missing,excluded,legacy:[...legacyBytes]});
  await page.reload();await page.locator('#record-query').fill('合成未保存活动');
  await application.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});await page.locator('#record-csv').click();await page.waitForFunction(()=>document.querySelector('#record-export-status').textContent==='已取消导出。');
  const bundle=path.join(directory,'selected-evidence.zip');await application.evaluate(({dialog},destination)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});},bundle);
  await page.locator('#record-csv').click();await page.waitForFunction(()=>document.querySelector('#record-export-status').textContent.includes('3份附件；1份缺失'));
  const expected=path.join(directory,'bundle-expected.json');fs.writeFileSync(expected,JSON.stringify({titles:['合成未保存活动'],contents:[bytes,duplicateBytes,legacyBytes].map(value=>value.toString('base64')),missingNames:['missing-proof.pdf']}));
  const checked=spawnSync(process.env.STUDY_PYTHON_PATH||'python',[path.join(__dirname,'check-evidence-bundle.py'),bundle,expected],{encoding:'utf8',windowsHide:true});assert.equal(checked.status,0,checked.stderr||checked.error?.message);
  assert(fs.readFileSync(original).equals(bytes));assert(fs.readFileSync(duplicate).equals(duplicateBytes));assert.equal(await page.evaluate(async()=> (await StudyVault.all('files')).length),1);
  // A subsequent transfer from another route must retain its draft after rendering.
  await page.goto(origin+'/#ai');await page.locator('#course-notes').waitFor();
  assert.equal((await fetch(origin+'/api/desktop/open',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({backup,draft})})).status,202);
  await application.evaluate(({app},value)=>app.emit('second-instance',{},[],process.cwd(),{handoff:value}),capability);
  await page.locator('#confirm-action').waitFor();assert.equal(await page.evaluate(async()=> (await StudyVault.all('records')).length),2);
  await application.evaluate(({dialog})=>{dialog.showSaveDialog=async()=>({canceled:true});});await page.locator('#confirm-action').click();await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('已取消备份'));assert.equal(await page.evaluate(async()=> (await StudyVault.all('records')).length),2);
  assert.equal((await fetch(origin+'/api/desktop/open',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({backup,draft})})).status,202);await application.evaluate(({app},value)=>app.emit('second-instance',{},[],process.cwd(),{handoff:value}),capability);await page.locator('#confirm-action').waitFor();
  await application.evaluate(({dialog},destination)=>{dialog.showSaveDialog=async()=>({canceled:false,filePath:destination});},path.join(directory,'before-replacement.json'));
  await page.locator('#confirm-action').click();
  await page.locator('#record-dialog[open]').waitFor();assert.equal(await page.locator('#record-form [name=title]').inputValue(),draft.fields.title);assert.equal(await page.evaluate(async()=> (await StudyVault.all('records')).length),1);
  assert.equal(JSON.parse(fs.readFileSync(path.join(directory,'before-replacement.json'),'utf8')).records.length,2);
  console.log('Actual Electron passed: native drop, migration/backup protection, filtered CSV+ZIP with exact original and legacy bytes, duplicate names, missing report and canceled export.');
})().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(async()=>{if(application)await application.close();await new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});});
