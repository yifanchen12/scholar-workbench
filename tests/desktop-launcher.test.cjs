'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),net=require('node:net');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..');
for(const name of ['启动工作台.cmd','启动桌面工作台.cmd']){
  const source=fs.readFileSync(path.join(root,name),'utf8');
  assert(!source.startsWith('\uFEFF'),name+' must have no BOM');
  assert(source.includes('\r\n')&&!/(?<!\r)\n/.test(source),name+' must preserve Windows CRLF, including in GitHub ZIP downloads');
}
if(process.platform!=='win32'){console.log('Windows launcher byte-format checks passed; native window check requires Windows.');}
else (async()=>{
  require('electron'); // Install/download the runtime before timing the local entry.
  fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
  const profile=fs.mkdtempSync(path.join(root,'tmp','launcher-check-'));
  const reservation=net.createServer();await new Promise(resolve=>reservation.listen(0,'127.0.0.1',resolve));const port=reservation.address().port;await new Promise(resolve=>reservation.close(resolve));
  let ownerId;
  const inspect=()=>{
    const script=`$ownerId=(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1).OwningProcess; if($ownerId){$process=Get-Process -Id $ownerId; [pscustomobject]@{Id=$ownerId;VisibleWindow=([Int64]$process.MainWindowHandle -ne 0)} | ConvertTo-Json -Compress}`;
    const result=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{encoding:'utf8',windowsHide:true,timeout:10000});
    return result.status===0&&result.stdout.trim()?JSON.parse(result.stdout):null;
  };
  try{
    const launched=spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','启动桌面工作台.cmd'],{cwd:root,env:{...process.env,STUDY_DESKTOP_PROFILE:profile,STUDY_PORT:String(port)},encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(launched.status,0,'Double-click command failed: '+launched.stdout);
    let visible=false;
    for(let attempt=0;attempt<20&&!visible;attempt++){
      const status=inspect();if(status){ownerId=status.Id;visible=status.VisibleWindow;}
      if(!visible)await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert(visible,'Launcher started no visible desktop window');
    const response=await fetch(`http://127.0.0.1:${port}`,{method:'HEAD'});assert.equal(response.headers.get('x-study-workbench'),'youyan-local-v1');
    console.log('Actual Windows CMD launch passed: batch parsed, local service ready and native desktop window visible; isolated profile only.');
  }finally{
    if(!ownerId)ownerId=inspect()?.Id;
    if(ownerId)spawnSync('taskkill.exe',['/PID',String(ownerId),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
