'use strict';
const fs=require('node:fs/promises'),path=require('node:path'),crypto=require('node:crypto');
const types={'image/png':'png','image/jpeg':'jpg','image/webp':'webp','image/gif':'gif','image/bmp':'bmp','image/avif':'avif','image/svg+xml':'svg'};
const validFolder=value=>typeof value==='string'&&value.length<=4096&&path.isAbsolute(value)&&!/[\u0000-\u001f\u007f]/.test(value);
async function loadFolder(config){try{const value=JSON.parse(await fs.readFile(config,'utf8'));return validFolder(value.folder)?value.folder:'';}catch{return '';}}
async function setFolder(config,folder){
  if(!validFolder(folder)||!(await fs.stat(folder)).isDirectory())throw new Error('请选择可用的照片保存文件夹。');
  const temporary=config+'.'+crypto.randomUUID()+'.tmp';
  try{await fs.writeFile(temporary,JSON.stringify({folder})+'\n',{flag:'wx',mode:0o600});await fs.rename(temporary,config);}catch{await fs.unlink(temporary).catch(()=>{});throw new Error('保存目录设置失败，请检查桌面配置目录权限。');}return folder;
}
async function writePhoto(folder,input){
  if(!validFolder(folder))throw new Error('请先选择照片保存文件夹。');
  if(!input||typeof input.name!=='string'||input.name.length>300||!Object.hasOwn(types,input.type)||!(input.data instanceof Uint8Array)||!input.data.byteLength||input.data.byteLength>20*1024*1024)throw new Error('照片格式无效或超过20 MB。');
  let target,handle;
  try{
    const directory=await fs.realpath(folder);if(!(await fs.stat(directory)).isDirectory())throw new Error();
    const base=Array.from(path.parse(input.name.replace(/[/\\]/g,'_')).name.replace(/[<>:"|?*\u0000-\u001f\u007f]/g,'_')).slice(0,60).join('').replace(/[. ]+$/,'')||'照片';
    const name=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'-'+base+'-'+crypto.randomBytes(6).toString('hex')+'.'+types[input.type];target=path.join(directory,name);
    handle=await fs.open(target,'wx',0o600);await handle.writeFile(input.data);await handle.close();handle=null;
    return {saved:true,path:target,name,type:input.type,folder};
  }catch{if(handle){await handle.close().catch(()=>{});await fs.unlink(target).catch(()=>{});}throw new Error('照片未能保存，请重新选择可写入的保存文件夹；原照片未更改。');}
}
module.exports={loadFolder,setFolder,writePhoto,types};
