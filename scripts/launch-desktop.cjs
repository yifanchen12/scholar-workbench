'use strict';
const path=require('node:path'),{spawnSync,spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..');
const [major,minor]=process.versions.node.split('.').map(Number);
if(major<22||(major===22&&minor<12)){console.error('桌面入口需要 Node.js 22.12 或更新的受维护版本。');process.exit(1);}
let executable;
try{executable=require('electron');}catch{
  console.log('首次启动：正在安装桌面运行时，完成后会自动打开。');
  const install=process.platform==='win32'?spawnSync(process.env.ComSpec||'cmd.exe',['/d','/c','npm ci --include=dev --no-audit --no-fund'],{cwd:root,stdio:'inherit',windowsHide:true}):spawnSync('npm',['ci','--include=dev','--no-audit','--no-fund'],{cwd:root,stdio:'inherit'});
  if(install.status!==0){console.error('安装失败，请检查网络后重新双击启动。');process.exit(1);}
  executable=require('electron');
}
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
const child=spawn(executable,[path.join(root,'desktop/main.cjs')],{cwd:root,env,detached:true,stdio:'ignore',windowsHide:true});
child.on('error',()=>{console.error('桌面程序启动失败。');process.exitCode=1;});child.on('spawn',()=>child.unref());
