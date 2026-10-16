'use strict';
const {app,BrowserWindow,ipcMain,shell,dialog}=require('electron');
const path=require('node:path'),fs=require('node:fs'),http=require('node:http');
const root=path.resolve(__dirname,'..');
const profile=process.env.STUDY_DESKTOP_PROFILE||path.join(root,'.desktop-user-data');
fs.mkdirSync(profile,{recursive:true});app.setPath('userData',profile);app.setName('Scholar Workbench');
let pending=process.env.STUDY_DESKTOP_HANDOFF||'',window,server;
delete process.env.STUDY_DESKTOP_HANDOFF;
const port=Number(process.env.STUDY_PORT||5179),origin=`http://127.0.0.1:${port}`;
const trusted=url=>{try{const parsed=new URL(url);return parsed.origin===origin&&['/','/index.html'].includes(parsed.pathname);}catch{return false;}};
const gotLock=app.requestSingleInstanceLock({handoff:pending});
if(!gotLock){app.quit();}else{
  let exporting=false;
  const verifySender=event=>{if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame||!trusted(event.senderFrame.url))throw new Error('Untrusted desktop request');};
  app.on('second-instance',(_event,_argv,_cwd,data)=>{if(typeof data?.handoff==='string'&&data.handoff){pending=data.handoff;window?.webContents.send('study:handoff-ready');}if(window){if(window.isMinimized())window.restore();window.show();window.focus();}});
  ipcMain.handle('study:export-evidence',async(event,payload)=>{
    verifySender(event);if(exporting)throw new Error('正在打包附件，请等待当前导出完成。');exporting=true;
    try{
      const exporter=require('./evidence-export.cjs');exporter.validate(payload);
      const result=await dialog.showSaveDialog(window,{title:'导出当前列表 CSV 与对应附件',defaultPath:'综测活动与附件-'+new Date().toISOString().slice(0,10)+'.zip',filters:[{name:'CSV 与附件压缩包',extensions:['zip']}],properties:['showOverwriteConfirmation']});
      if(result.canceled||!result.filePath)return {saved:false};
      return await exporter.writeBundle(payload,result.filePath);
    }finally{exporting=false;}
  });
  ipcMain.handle('study:save-backup',async(event,json)=>{
    verifySender(event);
    if(typeof json!=='string'||Buffer.byteLength(json)>256*1024*1024)throw new Error('备份内容无效或过大。');
    let data;try{data=JSON.parse(json);}catch{throw new Error('备份 JSON 无效。');}
    if(!['youyan-workspace-v2','youyan-workspace-v3'].includes(data?.format)||!data.legacy)throw new Error('不是完整工作台备份。');
    const result=await dialog.showSaveDialog(window,{title:'保存完整工作台备份',defaultPath:'scholar-workbench-backup-'+new Date().toISOString().slice(0,10)+'.json',filters:[{name:'工作台备份',extensions:['json']}],properties:['showOverwriteConfirmation']});
    if(result.canceled||!result.filePath)return false;
    try{await fs.promises.writeFile(result.filePath,json,'utf8');}catch{throw new Error('备份写入失败，未替换当前桌面记录。');}return true;
  });
  ipcMain.handle('study:take-handoff',async event=>{
    verifySender(event);
    if(!pending)return null;const capability=pending;pending='';
    return new Promise((resolve,reject)=>{
      const request=http.request(origin+'/api/desktop/handoff',{method:'POST',headers:{'Content-Type':'application/json','Content-Length':2,'X-Study-Handoff':capability},agent:false},response=>{
        const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>257*1024*1024)response.destroy(new Error('Migration payload too large'));else chunks.push(chunk);});response.on('error',()=>reject(new Error('记录迁移连接失败，原网页数据仍保留。')));response.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks));if(response.statusCode!==200)throw new Error();resolve(value);}catch{reject(new Error('迁移已失效，请从原网页重新打开桌面模式。'));}});
      });request.on('error',()=>reject(new Error('无法连接本机迁移服务，原网页数据仍保留。')));request.end('{}');
    });
  });
  app.whenReady().then(async()=>{
    server=require('../server.js');
    let ready=false;
    for(let i=0;i<100&&!ready;i++){
      ready=await new Promise(resolve=>{const request=http.get(origin,{method:'HEAD'},response=>{response.resume();resolve(response.statusCode===200&&response.headers['x-study-workbench']==='youyan-local-v1');});request.on('error',()=>resolve(false));request.setTimeout(1000,()=>request.destroy());});
      if(!ready)await new Promise(resolve=>setTimeout(resolve,100));
    }
    if(!ready)throw new Error('无法启动本机工作台，请检查端口是否被其他程序占用。');
    window=new BrowserWindow({width:1440,height:1000,minWidth:760,minHeight:600,title:'邮研 · 桌面工作台',show:!process.argv.includes('--desktop-test'),webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true,additionalArguments:['--study-origin='+origin]}});
    window.setMenuBarVisibility(false);
    window.webContents.on('will-navigate',(event,url)=>{if(!trusted(url))event.preventDefault();});
    window.webContents.setWindowOpenHandler(({url})=>{try{const parsed=new URL(url);if(parsed.protocol==='https:'&&!parsed.username&&!parsed.password)shell.openExternal(parsed.href);}catch{}return {action:'deny'};});
    window.webContents.session.setPermissionRequestHandler((contents,permission,callback)=>callback(contents===window.webContents&&permission==='clipboard-sanitized-write'&&trusted(contents.getURL())));
    window.webContents.session.setPermissionCheckHandler((contents,permission)=>contents===window.webContents&&permission==='clipboard-sanitized-write'&&trusted(contents.getURL()));
    await window.loadURL(origin+'/#materials');
  }).catch(error=>{dialog.showErrorBox('工作台未能启动',error.message);app.quit();});
  app.on('window-all-closed',()=>app.quit());
  app.on('before-quit',()=>{if(server?.listening){server.close();server.closeAllConnections?.();}});
}
