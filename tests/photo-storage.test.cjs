'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path');
const storage=require('../desktop/photo-storage.cjs'),categories=require('../record-categories.js');
(async()=>{
  await fs.mkdir(path.resolve('tmp'),{recursive:true});const directory=await fs.mkdtemp(path.resolve('tmp/photo-storage-')),folder=path.join(directory,'照片'),config=path.join(directory,'photo-folder.json');await fs.mkdir(folder);
  assert.equal(await storage.loadFolder(config),'');await storage.setFolder(config,folder);assert.equal(await storage.loadFolder(config),folder);
  const input={name:'../../CON：证明.png',type:'image/png',data:new Uint8Array([137,80,78,71,13,10,26,10])},first=await storage.writePhoto(folder,input),second=await storage.writePhoto(folder,input);
  assert.notEqual(first.path,second.path);assert.equal(path.dirname(first.path),folder);assert.deepEqual([...await fs.readFile(first.path)],[...input.data]);
  await assert.rejects(storage.writePhoto(folder,{...input,type:'text/html'}));await assert.rejects(storage.writePhoto(folder,{...input,data:new Uint8Array(20*1024*1024+1)}));await assert.rejects(storage.writePhoto(path.join(folder,'missing'),input));assert.equal((await fs.readdir(folder)).length,2);
  assert.equal(categories.categories.length,7);assert.equal(categories.competitionLevel(undefined),'');assert.equal(categories.competitionLevel('A+'),'A+');assert.throws(()=>categories.competitionLevel('C'));assert.throws(()=>categories.competitionLevel({}));assert.equal(categories.activityLevel('校级'),'校级');assert.throws(()=>categories.activityLevel('不存在的级别'));
  console.log('Photo storage and categories passed: private preference reload, bounded unique writes, preserved bytes, traversal-safe names, failure protection and valid competition tiers.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
