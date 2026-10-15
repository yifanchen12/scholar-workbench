'use strict';
const crypto=require('node:crypto'),path=require('node:path');
const {spawn}=require('node:child_process');
function launchDesktop(capability,origin){
  let executable;try{executable=process.versions.electron?process.execPath:require('electron');}catch{throw new Error('请先双击“启动桌面工作台.cmd”完成首次安装，再从此处自动迁移记录。');}
  return new Promise((resolve,reject)=>{
    const env={...process.env,STUDY_DESKTOP_HANDOFF:capability,STUDY_PORT:new URL(origin).port};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
    const child=spawn(executable,[path.join(__dirname,'desktop/main.cjs')],{cwd:__dirname,env,windowsHide:true,detached:true,stdio:'ignore'});
    child.once('error',()=>reject(new Error('桌面程序未能启动，请双击“启动桌面工作台.cmd”。')));child.once('spawn',()=>{child.unref();resolve();});
  });
}
function createHandler({launch=launchDesktop,ttlMs=120000}={}){
  let pending,receiving=false;
  const clear=()=>{if(pending)clearTimeout(pending.timer);pending=null;};
  return async(req,res,origin)=>{
    const send=(status,data)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));}};
    if(req.method!=='POST')return send(405,{error:'仅支持 POST。'});
    if(req.headers.host!==new URL(origin).host||req.headers['content-type']!=='application/json')return send(403,{error:'只接受本机工作台请求。'});
    const taking=new URL(req.url,origin).pathname==='/api/desktop/handoff';
    if(taking){
      const value=req.headers['x-study-handoff'];
      if(!pending||typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)||!crypto.timingSafeEqual(Buffer.from(value),Buffer.from(pending.capability)))return send(410,{error:'迁移已失效，请从原网页重试。'});
      const bytes=pending.bytes;clear();res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(bytes);return;
    }
    if(req.headers.origin!==origin)return send(403,{error:'只接受工作台页面发起的迁移。'});
    if(pending||receiving)return send(409,{error:'正在迁移，请稍候。'});
    receiving=true;
    try{
      let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>257*1024*1024)return send(413,{error:'迁移数据过大，请使用完整备份导入。'});chunks.push(chunk);}
      const bytes=Buffer.concat(chunks),payload=JSON.parse(bytes.toString('utf8'));
      if(!payload||!['youyan-workspace-v2','youyan-workspace-v3'].includes(payload.backup?.format)||!payload.backup.legacy)throw new Error('迁移数据无效。');
      const capability=crypto.randomBytes(32).toString('hex');
      pending={capability,bytes,timer:setTimeout(clear,ttlMs)};pending.timer.unref?.();
      await launch(capability,origin);send(202,{opened:true});
    }catch(error){clear();send(400,{error:error instanceof SyntaxError?'迁移数据 JSON 无效。':error.message});}
    finally{receiving=false;}
  };
}
module.exports={handle:createHandler(),createHandler};
