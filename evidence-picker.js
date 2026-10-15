'use strict';
const {execFile}=require('node:child_process');
const path=require('node:path');
let busy=false;
const script=`$ErrorActionPreference='Stop';[Console]::OutputEncoding=New-Object System.Text.UTF8Encoding($false);Add-Type -AssemblyName System.Windows.Forms;$dialog=New-Object System.Windows.Forms.OpenFileDialog;$dialog.Title='Select original evidence files (paths only)';$dialog.Multiselect=$true;$dialog.CheckFileExists=$true;$dialog.RestoreDirectory=$true;$dialog.DereferenceLinks=$false;try{$paths=@();if($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK){$paths=@($dialog.FileNames)};ConvertTo-Json -InputObject $paths -Compress}finally{$dialog.Dispose()}`;
function pickPaths(signal){
  return new Promise((resolve,reject)=>{
    const executable=path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe');
    execFile(executable,['-NoLogo','-NoProfile','-NonInteractive','-STA','-Command',script],{windowsHide:true,encoding:'utf8',maxBuffer:128*1024,signal},(error,stdout)=>{
      if(error)return reject(new Error('无法打开本机文件选择器，请使用“复制文件地址”粘贴原路径。'));
      try{resolve(JSON.parse(stdout.replace(/^\uFEFF/,'').trim()));}catch{reject(new Error('未取得文件路径，请手动粘贴原路径。'));}
    });
  });
}
async function handle(req,res,origin,{platform=process.platform,choose=pickPaths}={}){
  const send=(status,body)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body));}};
  if(req.method!=='POST')return send(405,{error:'仅支持 POST。'});
  if(req.headers.origin!==origin||req.headers.host!==new URL(origin).host||req.headers['content-type']!=='application/json')return send(403,{error:'只接受工作台本地页面的 JSON 请求。'});
  try{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>1024)return send(413,{error:'请求过大。'});chunks.push(chunk);}const body=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length)return send(400,{error:'请选择原文件，不接受自定义命令或参数。'});}
  catch{return send(400,{error:'请求 JSON 无效。'});}
  if(res.destroyed)return;
  if(platform!=='win32')return send(501,{error:'自动获取路径目前支持 Windows；可拖入文件后手动粘贴原路径。'});
  if(busy)return send(409,{error:'文件选择器已经打开，请先完成或取消选择。'});
  const controller=new AbortController();res.on('close',()=>{if(!res.writableEnded)controller.abort();});busy=true;
  try{
    const paths=await choose(controller.signal);
    if(!Array.isArray(paths)||paths.length>10||paths.some(p=>typeof p!=='string'||!path.win32.isAbsolute(p)||p.length>4096||/[\u0000-\u001f]/.test(p)))throw new Error('每项最多10份证明，请重新选择有效文件。');
    send(200,{paths});
  }catch(error){send(400,{error:controller.signal.aborted?'文件选择已取消。':error.message});}
  finally{busy=false;}
}
module.exports={handle};
