'use strict';
const assert=require('node:assert/strict'),http=require('node:http');
const {createHandler}=require('../desktop-transfer.js');
(async()=>{
  let capability,calls=0,origin;
  const handle=createHandler({launch:async value=>{capability=value;calls++;},ttlMs:500});
  const server=http.createServer((req,res)=>handle(req,res,origin));await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));origin='http://127.0.0.1:'+server.address().port;
  const payload={backup:{format:'youyan-workspace-v3',legacy:{},records:[]},draft:{fields:{title:'synthetic draft'}}};
  const open=(headers={Origin:origin,'Content-Type':'application/json'})=>fetch(origin+'/api/desktop/open',{method:'POST',headers,body:JSON.stringify(payload)});
  const take=value=>fetch(origin+'/api/desktop/handoff',{method:'POST',headers:{'Content-Type':'application/json','X-Study-Handoff':value},body:'{}'});
  try{
    assert.equal((await open({'Content-Type':'application/json'})).status,403);assert.equal(calls,0);
    assert.equal((await open()).status,202);assert.equal((await open()).status,409);
    assert.equal((await take('invalid')).status,410);const response=await take(capability);assert.equal(response.status,200);assert.deepEqual(await response.json(),payload);assert.equal(response.headers.get('cache-control'),'no-store');assert.equal((await take(capability)).status,410);
    assert.equal((await open()).status,202);await new Promise(resolve=>setTimeout(resolve,550));assert.equal((await take(capability)).status,410);
    console.log('Desktop handoff origin, explicit launch, one-use capability, duplicate protection and expiry checks passed; no real user data or token values logged.');
  }finally{await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
