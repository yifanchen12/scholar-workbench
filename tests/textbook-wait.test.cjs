'use strict';
const assert=require('node:assert/strict');
const http=require('node:http');
const {handle}=require('../deepseek-api.js');
const nativeTimeout=global.setTimeout;
const wait=ms=>new Promise(resolve=>nativeTimeout(resolve,ms));
const outline={title:'合成慢接口',sections:[{title:'概念',start:1,end:1,summary:'测试数据'}]};
const envelope=Buffer.from(JSON.stringify({choices:[{finish_reason:'stop',message:{content:JSON.stringify(outline)}}]}));
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const close=server=>new Promise(resolve=>{server.close(resolve);server.closeAllConnections?.();});
function post(origin,baseUrl){
  const payload=JSON.stringify({baseUrl,key:'test-only-placeholder',model:'school/model',kind:'outline',title:'合成测试',goal:'',pages:[{page:1,text:'Synthetic text only.'}]});
  let request;
  const result=new Promise((resolve,reject)=>{
    request=http.request(origin+'/api/textbook',{method:'POST',agent:false,headers:{Origin:origin,'Content-Type':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{
      const chunks=[];res.on('data',chunk=>chunks.push(chunk));res.on('error',reject);res.on('end',()=>resolve({status:res.statusCode,body:JSON.parse(Buffer.concat(chunks))}));
    });
    request.on('error',reject);request.end(payload);
  });
  return {result,cancel:()=>request.destroy(new Error('Manual cancellation'))};
}
(async()=>{
  let notifyCancelStarted,notifyCancelClosed;
  const cancelStarted=new Promise(resolve=>notifyCancelStarted=resolve);
  const cancelClosed=new Promise(resolve=>notifyCancelClosed=resolve);
  const gateway=http.createServer(async(req,res)=>{
    req.resume();res.on('error',()=>{});
    if(req.url==='/cancel/chat/completions'){
      res.on('close',()=>notifyCancelClosed());res.writeHead(200,{'Content-Type':'application/json'});res.write('{"choices":');notifyCancelStarted();return;
    }
    assert.equal(req.url,'/slow/chat/completions');
    await wait(80); // Queue delay before response headers.
    if(res.destroyed)return;
    res.writeHead(200,{'Content-Type':'application/json'});res.write(envelope.subarray(0,17));
    await wait(80); // Generation delay while the response body is incomplete.
    if(!res.destroyed)res.end(envelope.subarray(17));
  });
  let origin;
  const proxy=http.createServer((req,res)=>handle(req,res,origin));proxy.setTimeout(0);
  await listen(gateway);await listen(proxy);
  origin='http://127.0.0.1:'+proxy.address().port;
  const base='http://127.0.0.1:'+gateway.address().port;
  // Accelerate application deadlines, not fixture timing or socket I/O.
  // The former 180-second abort fires in 20 ms under this regression harness.
  global.setTimeout=(callback,delay,...args)=>nativeTimeout(callback,delay>1000?20:delay,...args);
  const guard=nativeTimeout(()=>{console.error('Slow gateway test did not complete.');process.exit(1);},8000);guard.unref();
  try{
    const response=await post(origin,base+'/slow').result;
    assert.equal(response.status,200,'Slow headers/body must not trigger an application deadline');assert.deepEqual(response.body.content,outline);
    const pending=post(origin,base+'/cancel');
    await cancelStarted;await wait(30);const rejection=assert.rejects(pending.result,/Manual cancellation/);pending.cancel();await rejection;await cancelClosed;
    console.log('Slow headers/body continue without an application deadline; manual cancellation closes the upstream request. No paid API request made.');
  }finally{
    global.setTimeout=nativeTimeout;clearTimeout(guard);await close(proxy);await close(gateway);
  }
})().catch(error=>{console.error(error.message);process.exitCode=1;});
