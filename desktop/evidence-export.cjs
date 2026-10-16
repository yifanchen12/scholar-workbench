'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const fields={id:120,title:300,organizer:300,award:200,date:10,category:50,notes:6000};
const validPath=value=>typeof value==='string'&&value.length<=4096&&!/[\\/]$/.test(value)&&!/[\u0000-\u001f\u007f]/.test(value)&&!/^c:[\\/]fakepath[\\/]/i.test(value)&&(/^[a-z]:[\\/].+/i.test(value)||/^\\\\[^\\/]+[\\/][^\\/]+[\\/].+/.test(value)||/^\/[^/].*/.test(value));
const filename=(value,max=100)=>Array.from(value.replace(/[<>:"/\\|?*\u0000-\u001f\u007f]/g,'_').replace(/[. ]+$/,'')).slice(0,max).join('')||'未命名';
const csvCell=value=>'"'+(/^[\s]*[=+\-@]|^[\t\r\n]/.test(value)?"'":'')+String(value).replace(/"/g,'""')+'"';
function validate(payload){
  if(!payload||!Array.isArray(payload.records)||payload.records.length>1000||!Array.isArray(payload.files)||payload.files.length>10000)throw new Error('导出记录格式无效。');
  const ids=new Set();
  const records=payload.records.map(record=>{
    if(Object.entries(fields).some(([key,max])=>typeof record?.[key]!=='string'||record[key].length>max)||!record.title.trim()||!/^[\w-]+$/.test(record.id)||ids.has(record.id))throw new Error('导出活动字段无效。');ids.add(record.id);
    const paths=record.evidencePaths||[],fileIds=record.fileIds;
    if(!Array.isArray(paths)||!Array.isArray(fileIds)||paths.length+fileIds.length>10||paths.some(p=>!validPath(p))||fileIds.some(id=>typeof id!=='string'||!/^[\w-]{1,100}$/.test(id)))throw new Error('导出证明引用无效。');
    return {...Object.fromEntries(Object.keys(fields).map(key=>[key,record[key]])),evidencePaths:paths,fileIds};
  });
  let total=0;const files=new Map(),references=new Set(records.flatMap(record=>record.fileIds));
  for(const file of payload.files){
    if(!file||typeof file.id!=='string'||!references.has(file.id)||files.has(file.id)||typeof file.owner!=='string'||typeof file.name!=='string'||file.name.length>300||!(file.data instanceof Uint8Array))throw new Error('旧附件格式无效。');
    total+=file.data.byteLength;if(total>120*1024*1024)throw new Error('旧附件总量超过120 MB。');files.set(file.id,file);
  }
  return {records,files};
}
async function writeBundle(payload,destination){
  const {records,files}=validate(payload),rows=[],entries=[],missing=[];
  const canonical=async value=>{const result=await fs.promises.realpath(value).catch(()=>path.resolve(value));return process.platform==='win32'?result.toLowerCase():result;};
  const target=await canonical(destination);
  for(const [index,record] of records.entries()){
    const folder=`附件/${String(index+1).padStart(4,'0')}-${filename(record.title,50)}`,included=[],absent=[];let ordinal=0;
    for(const source of record.evidencePaths){
      if(await canonical(source)===target)throw new Error('导出位置不能覆盖原证明文件，请换一个文件名。');
      const name=source.split(/[\\/]/).pop(),entry=`${folder}/${String(++ordinal).padStart(2,'0')}-${filename(name)}`;
      try{
        const stats=await fs.promises.stat(source);if(!stats.isFile())throw new Error('not a regular file');await fs.promises.access(source,fs.constants.R_OK);
        entries.push({source,name:entry,size:stats.size,mtime:stats.mtime});included.push(entry);
      }catch(error){const reason=error.code==='ENOENT'?'文件不存在':error.code==='EACCES'||error.code==='EPERM'?'无读取权限':'不是可读取的普通文件';absent.push(name);missing.push({activity:record.title,name,source,reason});}
    }
    for(const id of record.fileIds){
      const file=files.get(id);if(!file||file.owner!==record.id){absent.push(file?.name||'旧附件缺失');missing.push({activity:record.title,name:file?.name||id,source:'旧版存储附件',reason:'旧附件缺失或归属不符'});continue;}
      const entry=`${folder}/${String(++ordinal).padStart(2,'0')}-${filename(file.name)}`;entries.push({name:entry,data:Buffer.from(file.data.buffer,file.data.byteOffset,file.data.byteLength)});included.push(entry);
    }
    rows.push([record.title,record.organizer,record.award,record.date,record.category,record.notes,included.join('\n'),absent.join('\n')]);
  }
  const csv='\uFEFF'+[['活动名称','举办单位','获奖等级','日期','分类','备注','附件（包内路径）','缺失附件'],...rows].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const temporary=path.join(path.dirname(destination),'.scholar-export-'+crypto.randomUUID()+'.tmp'),zip=new(require('yazl').ZipFile)(),streams=new Set();
  zip.on('error',error=>zip.outputStream.destroy(error));
  const writing=pipeline(zip.outputStream,fs.createWriteStream(temporary,{flags:'wx'}));writing.catch(()=>{});
  try{
    zip.addBuffer(Buffer.from(csv,'utf8'),'综测活动记录.csv');
    for(const entry of entries){
      if(entry.data)zip.addBuffer(entry.data,entry.name);
      else zip.addReadStreamLazy(entry.name,{size:entry.size,mtime:entry.mtime},callback=>{const stream=fs.createReadStream(entry.source);streams.add(stream);stream.once('close',()=>streams.delete(stream));stream.on('error',error=>zip.emit('error',error));callback(null,stream);});
    }
    const report=missing.length?'以下证明未能打包；CSV 的“缺失附件”列也已标明。\r\n\r\n'+missing.map(item=>`活动：${item.activity}\r\n文件：${item.name}\r\n原位置：${item.source}\r\n原因：${item.reason}`).join('\r\n\r\n'):null;
    if(report)zip.addBuffer(Buffer.from('\uFEFF'+report,'utf8'),'缺失附件清单.txt');
    zip.end();await writing;await fs.promises.rename(temporary,destination);
    return {saved:true,records:records.length,attached:entries.length,missing:missing.length};
  }catch{
    zip.outputStream.destroy();for(const stream of streams)stream.destroy();await writing.catch(()=>{});await fs.promises.unlink(temporary).catch(()=>{});
    throw new Error('附件打包失败，原证明和已有导出包未更改。请检查文件是否仍可读取及保存位置。');
  }
}
module.exports={validate,writeBundle};
