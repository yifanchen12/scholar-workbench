(function(root){
  'use strict';
  const DB='youyan.workspace.v2',STORES=['books','records','files','progress'],MAX_FILE=50*1024*1024,MAX_TOTAL=120*1024*1024;
  let database;
  const ready=new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{for(const name of STORES)request.result.createObjectStore(name,{keyPath:'id'});};request.onsuccess=()=>{database=request.result;database.onversionchange=()=>database.close();resolve();};request.onerror=()=>reject(new Error('浏览器无法打开附件存储，请退出隐私模式或检查站点存储权限。'));});
  // 注册拒绝处理，页面挂载时仍能看到原始失败。
  ready.catch(()=>{});
  async function transaction(names,mode,fn){await ready;return new Promise((resolve,reject)=>{const tx=database.transaction(names,mode);let result;tx.oncomplete=()=>resolve(result);tx.onerror=tx.onabort=()=>reject(new Error(tx.error?.name==='QuotaExceededError'?'存储空间不足，未保存；请先备份并清理附件。':'本地存储事务失败，当前改动未保存。'));try{result=fn(tx);}catch(e){tx.abort();reject(e);}});}
  async function all(name){let request;await transaction([name],'readonly',tx=>{request=tx.objectStore(name).getAll();});return request.result;}
  async function get(name,id){let request;await transaction([name],'readonly',tx=>{request=tx.objectStore(name).get(id);});return request.result;}
  const put=(name,value)=>transaction([name],'readwrite',tx=>tx.objectStore(name).put(value));
  const id=()=>crypto.randomUUID();
  function checkRecord(r){
    for(const [key,max] of [['id',120],['title',300],['organizer',300],['award',200],['date',10],['category',50],['notes',6000]])if(typeof r?.[key]!=='string'||r[key].length>max)throw new Error('综测记录字段格式无效。');
    if(!/^[\w-]+$/.test(r.id)||!r.title.trim()||!StudyCore.validDate(r.date)||!Array.isArray(r.fileIds)||r.fileIds.length>10||r.fileIds.some(x=>typeof x!=='string'||! /^[\w-]{1,100}$/.test(x))||new Set(r.fileIds).size!==r.fileIds.length)throw new Error('综测记录或附件引用无效。');
    return Object.fromEntries(['id','title','organizer','award','date','category','notes','fileIds'].map(k=>[k,r[k]]));
  }
  function fileRecord(file,owner){if(!file.size||file.size>20*1024*1024)throw new Error('证明文件须为非空文件，每份不超过20 MB。');return {id:id(),owner,name:file.name.slice(0,300),type:file.type.slice(0,100),blob:file};}
  async function saveRecord(record,files=[],remove=[]){
    const clean=checkRecord(record),add=files.map(f=>fileRecord(f,clean.id));clean.fileIds=[...clean.fileIds.filter(x=>!remove.includes(x)),...add.map(f=>f.id)];checkRecord(clean);
    const existing=await all('records');if(!existing.some(r=>r.id===clean.id)&&existing.length>=1000)throw new Error('活动最多1,000项，请先导出并整理。');
    const currentFiles=await all('files');if(currentFiles.filter(f=>!remove.includes(f.id)).reduce((sum,f)=>sum+f.blob.size,0)+add.reduce((sum,f)=>sum+f.blob.size,0)>MAX_TOTAL)throw new Error('本地文件总量不能超过120 MB，请先完整备份并整理。');
    await transaction(['records','files'],'readwrite',tx=>{const fs=tx.objectStore('files');for(const key of remove)fs.delete(key);for(const file of add)fs.put(file);tx.objectStore('records').put(clean);});return clean;
  }
  async function deleteOwner(name,owner){const item=await get(name,owner);if(!item)return;await transaction([name,'files'],'readwrite',tx=>{tx.objectStore(name).delete(owner);for(const key of name==='books'?[item.fileId]:item.fileIds)tx.objectStore('files').delete(key);});}
  async function saveBook(book,file){if(file.size>MAX_FILE)throw new Error('教材PDF最大50 MB。');if((await all('files')).reduce((sum,f)=>sum+f.blob.size,0)+file.size>MAX_TOTAL)throw new Error('本地文件总量不能超过120 MB，请先完整备份并整理。');const fileId=id();await transaction(['books','files'],'readwrite',tx=>{tx.objectStore('files').put({id:fileId,owner:book.id,name:file.name.slice(0,300),type:'application/pdf',blob:file});tx.objectStore('books').put({...book,fileId});});}
  async function migrate(experiences,force=false){const marker=await get('progress','legacy-migrated');if(marker&&!force)return;const existing=new Set((await all('records')).map(r=>r.id));if(existing.size+experiences.filter(x=>!existing.has('legacy-'+x.id)).length>1000)throw new Error('旧经历迁移后超过1,000项活动，请先整理记录。');await transaction(['records','progress'],'readwrite',tx=>{for(const x of experiences)if(!existing.has('legacy-'+x.id))tx.objectStore('records').put({id:'legacy-'+x.id,title:x.title,organizer:'',award:'',date:x.date,category:x.category,notes:[x.detail,x.evidence?'原证明位置：'+x.evidence:''].filter(Boolean).join('\n'),fileIds:[]});tx.objectStore('progress').put({id:'legacy-migrated',done:true});});}
  function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
  async function openFile(key){const file=await get('files',key);if(!file)throw new Error('附件不存在，请从完整备份恢复。');download(file.blob,file.name);}
  function base64(blob){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=()=>reject(new Error('附件读取失败。'));reader.readAsDataURL(blob);});}
  async function exportBackup(legacy){
    const [books,records,files,progress]=await Promise.all(STORES.map(all));const total=files.reduce((sum,f)=>sum+f.blob.size,0);if(total>MAX_TOTAL)throw new Error('附件总量超过120 MB，请分别下载原文件，删除不再需要的附件后备份。');
    const encoded=[];for(const file of files)encoded.push({id:file.id,owner:file.owner,name:file.name,type:file.type,size:file.blob.size,data:await base64(file.blob)});
    const blob=new Blob([JSON.stringify({format:'youyan-workspace-v2',exportedAt:new Date().toISOString(),legacy,books,records,files:encoded,progress})],{type:'application/json'});if(blob.size>256*1024*1024)throw new Error('完整备份超过256 MB，请先下载原文件及展示后整理教材与记录。');download(blob,`邮研完整备份-${StudyCore.dateKey()}.json`);
  }
  function validateBackup(input){
    if(input?.format!=='youyan-workspace-v2')throw new Error('请选择邮研完整备份。');
    if(!Array.isArray(input.books)||input.books.length>30||!Array.isArray(input.records)||input.records.length>1000||!Array.isArray(input.files)||input.files.length>10030||!Array.isArray(input.progress)||input.progress.length>200)throw new Error('备份数据量或结构无效。');
    const seen=new Set(),files=[];let total=0;
    for(const f of input.files){if(!f||! /^[\w-]{1,100}$/.test(f.id)||seen.has(f.id)||typeof f.owner!=='string'||typeof f.name!=='string'||f.name.length>300||typeof f.type!=='string'||f.type.length>100||typeof f.data!=='string'||!Number.isSafeInteger(f.size)||f.size<=0||f.size>MAX_FILE||f.data.length>Math.ceil(MAX_FILE/3)*4||! /^[A-Za-z0-9+/]*={0,2}$/.test(f.data))throw new Error('附件数据无效。');seen.add(f.id);total+=f.size;if(total>MAX_TOTAL)throw new Error('备份附件超过120 MB。');let bytes;try{bytes=Uint8Array.from(atob(f.data),c=>c.charCodeAt(0));}catch{throw new Error('附件编码损坏。');}if(bytes.length!==f.size)throw new Error('附件字节数不匹配。');files.push({id:f.id,owner:f.owner,name:f.name,type:f.type,blob:new Blob([bytes],{type:f.type})});}
    const records=input.records.map(checkRecord),owners=new Map();
    if(new Set(records.map(r=>r.id)).size!==records.length)throw new Error('记录ID重复。');
    for(const r of records)for(const key of r.fileIds){const f=files.find(f=>f.id===key);if(!f||f.owner!==r.id||owners.has(key)||f.blob.size>20*1024*1024)throw new Error('证明附件引用缺失或冲突。');owners.set(key,r.id);}
    const books=input.books.map(b=>{if(!b||! /^[\w-]{1,100}$/.test(b.id)||typeof b.title!=='string'||b.title.length>300||!Array.isArray(b.pages)||!b.pages.length||b.pages.length>1000||b.pages.some((p,i)=>!p||p.page!==i+1||typeof p.text!=='string'||p.text.length>30000)||b.pages.reduce((n,p)=>n+p.text.length,0)>8000000)throw new Error('教材页面数据无效。');const f=files.find(f=>f.id===b.fileId);if(!f||f.owner!==b.id||owners.has(b.fileId))throw new Error('教材PDF缺失或冲突。');owners.set(b.fileId,b.id);const pages=b.pages.map(p=>p.page),outline=b.outline?TextbookSchema.validate(b.outline,'outline',pages):null;const lessons={};if(b.lessons){if(typeof b.lessons!=='object'||Array.isArray(b.lessons)||Object.keys(b.lessons).length>100)throw new Error('教材展示数量无效。');for(const [key,value] of Object.entries(b.lessons)){if(! /^\d+-\d+$/.test(key))throw new Error('教材章节ID无效。');lessons[key]=TextbookSchema.validate(value,'lesson',pages);}}return {id:b.id,title:b.title,fileId:b.fileId,pages:b.pages,outline,lessons};});
    if(new Set(books.map(b=>b.id)).size!==books.length||files.some(f=>!owners.has(f.id)))throw new Error('教材ID重复或存在孤立附件。');
    const progress=input.progress.map(p=>{if(!p||typeof p.id!=='string'||! /^[\w-]{1,100}$/.test(p.id)||typeof p.done!=='boolean'||(p.notes!==undefined&&(typeof p.notes!=='string'||p.notes.length>4000)))throw new Error('学习进度格式无效。');return {id:p.id,done:p.done,notes:p.notes||''};});
    if(new Set(progress.map(p=>p.id)).size!==progress.length)throw new Error('学习进度ID重复。');
    return {books,records,files,progress};
  }
  async function replace(data){await transaction(STORES,'readwrite',tx=>{for(const name of STORES){const store=tx.objectStore(name);store.clear();for(const value of data[name])store.put(value);}});}
  root.StudyVault={ready,all,get,put,id,saveRecord,saveBook,deleteOwner,migrate,openFile,download,exportBackup,validateBackup,replace,MAX_TOTAL};
})(globalThis);
