'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const {generate,validateInput,chatEndpoint,connectionErrorMessage}=require('../deepseek-api.js');
const schema=require('../textbook-schema.js');
const fakeKey='test-only-placeholder';
const input={key:fakeKey,model:'deepseek-flash',kind:'outline',title:'测试书',goal:'解释',pages:[{page:1,text:'第一章 概率'},{page:2,text:'第二章 学习'}]};
const outline={title:'测试书',sections:[{title:'概率',start:1,end:2,summary:'基础'}]};
(async()=>{
  assert.match(connectionErrorMessage(new TypeError('fetch failed',{cause:{code:'EACCES'}})),/没有联网权限/);
  assert.match(connectionErrorMessage(new TypeError('fetch failed',{cause:{errors:[{code:'EPERM'}]}})),/没有联网权限/);
  assert.match(connectionErrorMessage(new TypeError('fetch failed',{cause:{code:'ENOTFOUND'}})),/Base URL/);
  let body;
  const output=await generate(input,async(url,options)=>{assert.equal(url,'https://api.deepseek.com/chat/completions');assert.equal(options.headers.Authorization,'Bearer '+fakeKey);body=JSON.parse(options.body);return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outline)}}],usage:{prompt_tokens:100,completion_tokens:20}})};});
  assert.deepEqual(output.content,outline);assert.equal(body.response_format.type,'json_object');assert(!JSON.stringify(body).includes(fakeKey));
  for(const [baseUrl,expected] of [
    ['https://api.deepseek.com/v1/','https://api.deepseek.com/v1/chat/completions'],
    [' https://ai.example.org/campus/v1/// ','https://ai.example.org/campus/v1/chat/completions'],
    ['https://ai.example.org/v1/chat/completions/','https://ai.example.org/v1/chat/completions'],
    ['http://10.0.0.8:8080/v1','http://10.0.0.8:8080/v1/chat/completions'],
    ['http://[::1]:8080/v1','http://[::1]:8080/v1/chat/completions']
  ])assert.equal(chatEndpoint(baseUrl),expected);
  for(const baseUrl of ['',null,'ai.example.org/v1','https:ai.example.org','file:///tmp/model','ftp://ai.example.org','https://user:placeholder@ai.example.org','https://ai.example.org?token=placeholder','https://ai.example.org#fragment','https://ai.example.org?','https://ai.example.org\n','https://'+ 'x'.repeat(2048)])assert.throws(()=>validateInput({...input,baseUrl}),/Base URL/);
  await generate({...input,baseUrl:'https://ai.example.org/v1',model:'school/Qwen:instruct'},async(url,options)=>{assert.equal(url,'https://ai.example.org/v1/chat/completions');assert.equal(options.redirect,'manual');const payload=JSON.parse(options.body);assert.equal(payload.model,'school/Qwen:instruct');assert(!JSON.stringify(payload).includes('https://ai.example.org'));return {ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outline)}}]})};});
  await assert.rejects(generate(input,async()=>({status:307})),/重定向/);
  assert.throws(()=>validateInput({...input,key:''}));assert.throws(()=>validateInput({...input,model:'bad\nmodel'}));assert.throws(()=>validateInput({...input,pages:[...input.pages,input.pages[0]]}));assert.throws(()=>schema.validate({...outline,sections:[{...outline.sections[0],end:3}]},'outline',[1,2]));
  const lesson={title:'条件概率',summary:'概览',concepts:[{title:'概率',text:'解释',pages:[1]}],steps:[],comparisons:[],charts:[],questions:[]};
  assert.equal(schema.validate(lesson,'lesson',[1]).title,'条件概率');assert.throws(()=>schema.validate({...lesson,concepts:[{...lesson.concepts[0],pages:[99]}]},'lesson',[1]));assert.throws(()=>schema.validate({...lesson,charts:[{title:'错数',labels:['a'],values:[Infinity],pages:[1]}]},'lesson',[1]));
  await assert.rejects(generate(input,async()=>({ok:false,status:401})),/密钥无效/);
  await assert.rejects(generate(input,async()=>({ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'length',message:{content:'{}'}}]})})),/未完整/);
  await assert.rejects(generate(input,async()=>({ok:true,text:async()=>JSON.stringify({choices:[{finish_reason:'stop',message:{content:''}}]})})),/为空/);
  const server=process.env.STUDY_URL||'http://127.0.0.1:5179';
  let response=await fetch(server+'/api/textbook',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,403);
  response=await fetch(server+'/api/textbook',{method:'POST',headers:{'Content-Type':'application/json',Origin:server},body:JSON.stringify({...input,key:''})});assert.equal(response.status,400);assert(!JSON.stringify(await response.json()).includes(fakeKey));
  response=await fetch(server+'/api/textbook',{method:'POST',headers:{'Content-Type':'application/json',Origin:server},body:JSON.stringify({...input,baseUrl:'file:///tmp/model'})});assert.equal(response.status,400);assert.match((await response.json()).error,/Base URL/);
  // Actual transport through the local proxy to a synthetic campus gateway.
  let gatewayCalls=0,redirectedCalls=0;
  const gateway=http.createServer(async(req,res)=>{
    if(req.url==='/redirect/chat/completions'){res.writeHead(307,{Location:'/unexpected'});res.end();return;}
    if(req.url==='/unexpected'){redirectedCalls++;res.end('{}');return;}
    try{
      assert.equal(req.url,'/campus/v1/chat/completions');assert.equal(req.method,'POST');assert.equal(req.headers.authorization,'Bearer '+fakeKey);
      const chunks=[];for await(const chunk of req)chunks.push(chunk);const payload=JSON.parse(Buffer.concat(chunks));
      assert.equal(payload.model,'school/Qwen:instruct');assert.equal(payload.stream,false);assert.equal(payload.response_format.type,'json_object');assert(!JSON.stringify(payload).includes(fakeKey));gatewayCalls++;
      res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outline)}}]}));
    }catch{res.writeHead(500);res.end('{}');}
  });
  await new Promise(resolve=>gateway.listen(0,'127.0.0.1',resolve));
  try{
    const address='http://127.0.0.1:'+gateway.address().port;
    const call=baseUrl=>fetch(server+'/api/textbook',{method:'POST',headers:{'Content-Type':'application/json',Origin:server},body:JSON.stringify({...input,baseUrl,model:'school/Qwen:instruct'})});
    response=await call(address+'/campus/v1/');assert.equal(response.status,200);assert.deepEqual((await response.json()).content,outline);assert.equal(gatewayCalls,1);
    response=await call(address+'/redirect');assert.equal(response.status,400);assert.match((await response.json()).error,/重定向/);assert.equal(redirectedCalls,0);
  }finally{await new Promise(resolve=>gateway.close(resolve));}
  for(const asset of ['/vendor/pdfjs/pdf.mjs','/vendor/pdfjs/pdf.worker.mjs','/practice/tiny_llm.py'])assert.equal((await fetch(server+asset)).status,200);
  assert.equal((await fetch(server+'/deepseek-api.js')).status,404);
  console.log('Textbook schema, default/custom Base URL, actual local gateway transport, redirect rejection, secret exclusion and same-origin guard passed. No paid API request made.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
