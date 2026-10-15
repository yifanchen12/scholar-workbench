'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {handle}=require('../evidence-picker.js');
(async()=>{
  let origin,platform='win32',calls=0;
  const selected=['R:\\Evidence\\photo.jpg','R:\\Evidence\\certificate.pdf'];
  const server=http.createServer((req,res)=>handle(req,res,origin,{platform,choose:async()=>{calls++;return selected;}}));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  const post=(body='{}',headers={Origin:origin,'Content-Type':'application/json'})=>fetch(origin+'/api/evidence/pick',{method:'POST',headers,body});
  try{
    assert.equal((await fetch(origin+'/api/evidence/pick')).status,405);
    assert.equal((await post('{}',{'Content-Type':'application/json'})).status,403);
    assert.equal((await post('not-json')).status,400);
    assert.equal((await post('{"command":"ignored"}')).status,400);
    assert.equal((await post('x'.repeat(1025))).status,413);assert.equal(calls,0);
    let response=await post();assert.equal(response.status,200);assert.deepEqual(await response.json(),{paths:selected});assert.equal(calls,1);assert.equal(response.headers.get('cache-control'),'no-store');
    platform='linux';response=await post();assert.equal(response.status,501);assert.equal(calls,1);
    console.log('Path picker contract passed: explicit same-origin selection, paths only, no custom commands, body limits and unsupported-platform fallback. Native dialog not opened.');
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
