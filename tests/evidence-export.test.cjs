'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
const {validate,writeBundle}=require('../desktop/evidence-export.cjs');
const root=path.resolve(__dirname,'..');fs.mkdirSync(path.join(root,'tmp'),{recursive:true});
const directory=fs.mkdtempSync(path.join(root,'tmp','bundle-check-'));
const check=(archive,expected)=>{
  const fixture=path.join(directory,'expected.json');fs.writeFileSync(fixture,JSON.stringify(expected));
  const result=spawnSync(process.env.STUDY_PYTHON_PATH||'python',[path.join(__dirname,'check-evidence-bundle.py'),archive,fixture],{encoding:'utf8',windowsHide:true});assert.equal(result.status,0,result.stderr||result.error?.message);
};
(async()=>{
  for(const name of ['a','b'])fs.mkdirSync(path.join(directory,name));
  const first=path.join(directory,'a','同名证明.jpg'),second=path.join(directory,'b','同名证明.jpg'),missing=path.join(directory,'缺失证明.pdf');
  const a=Buffer.from([0,255,1,5]),b=Buffer.from('second synthetic original'),legacy=Buffer.from('legacy synthetic proof');fs.writeFileSync(first,a);fs.writeFileSync(second,b);
  const record={id:'activity-a',title:'=需转义活动',organizer:'测试单位',award:'参与',date:'2026-10-16',category:'学习',notes:'中文，逗号\n"引号"',evidencePaths:[first,second,missing],fileIds:['legacy-a']};
  const payload={records:[record],files:[{id:'legacy-a',owner:record.id,name:'../旧证明.pdf',data:legacy}]},destination=path.join(directory,'导出.zip');
  const result=await writeBundle(payload,destination);assert.deepEqual(result,{saved:true,records:1,attached:3,missing:1});check(destination,{titles:["'=需转义活动"],contents:[a,b,legacy].map(value=>value.toString('base64')),missingNames:['缺失证明.pdf']});
  assert(fs.readFileSync(first).equals(a));assert(fs.readFileSync(second).equals(b));
  await assert.rejects(writeBundle(payload,first),/不能覆盖原证明/);assert(fs.readFileSync(first).equals(a));
  assert.throws(()=>validate({records:[{...record,evidencePaths:['relative.txt']}],files:[]}),/证明引用/);
  assert.throws(()=>validate({records:[],files:payload.files}),/旧附件/);
  // A failure while reading preserves an already existing destination and removes scratch data.
  const old=fs.readFileSync(destination),createReadStream=fs.createReadStream;
  fs.createReadStream=()=>{const {Readable}=require('node:stream');return new Readable({read(){this.destroy(new Error('synthetic read failure'));}});};
  try{await assert.rejects(writeBundle(payload,destination),/原证明和已有导出包未更改/);}finally{fs.createReadStream=createReadStream;}
  assert(fs.readFileSync(destination).equals(old));assert(!fs.readdirSync(directory).some(name=>name.endsWith('.tmp')));
  const empty=path.join(directory,'空列表.zip');await writeBundle({records:[],files:[]},empty);check(empty,{titles:[],contents:[]});
  console.log('Evidence bundle checks passed: original and legacy bytes, duplicate basenames, Chinese/CSV escaping, missing list, path validation, no source overwrite and failure cleanup.');
})().catch(error=>{console.error(error.message);process.exitCode=1;});
